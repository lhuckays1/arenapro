-- Pause the ArenaPro AI for a specific WhatsApp conversation after a human replies.
-- Only short-lived message hashes and Evolution message IDs are retained; message text is never stored.

CREATE TABLE IF NOT EXISTS public.whatsapp_bot_outbound_markers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  message_id TEXT,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 day'),
  CHECK (sender_phone ~ '^[0-9]{6,24}$'),
  CHECK (message_id IS NULL OR length(message_id) <= 160)
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_bot_outbound_markers_message_uidx
  ON public.whatsapp_bot_outbound_markers (instance_name, message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_bot_outbound_markers_lookup_idx
  ON public.whatsapp_bot_outbound_markers (instance_name, sender_phone, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_handoffs (
  instance_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL CHECK (sender_phone ~ '^[0-9]{6,24}$'),
  paused_until TIMESTAMPTZ NOT NULL,
  last_human_message_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_name, sender_phone),
  CHECK (last_human_message_id IS NULL OR length(last_human_message_id) <= 160)
);

ALTER TABLE public.whatsapp_bot_outbound_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_bot_outbound_markers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.whatsapp_handoffs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_begin_bot_outbound(
  p_instance_name TEXT,
  p_token_hash TEXT,
  p_sender_phone TEXT,
  p_content_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_authorize_instance(p_instance_name, lower(p_token_hash))
  ) THEN
    RAISE EXCEPTION 'Conexão do WhatsApp não autorizada.' USING ERRCODE = '42501';
  END IF;
  IF p_sender_phone !~ '^[0-9]{6,24}$' OR p_content_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Dados inválidos para a mensagem automática.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.whatsapp_bot_outbound_markers WHERE expires_at <= now();
  INSERT INTO public.whatsapp_bot_outbound_markers (
    instance_name, sender_phone, content_hash, expires_at
  ) VALUES (
    p_instance_name, p_sender_phone, lower(p_content_hash), now() + interval '1 day'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_complete_bot_outbound(
  p_instance_name TEXT,
  p_token_hash TEXT,
  p_outbound_id UUID,
  p_message_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_authorize_instance(p_instance_name, lower(p_token_hash))
  ) THEN
    RETURN FALSE;
  END IF;
  IF p_message_id IS NOT NULL AND length(p_message_id) > 160 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.whatsapp_bot_outbound_markers
  SET message_id = COALESCE(message_id, NULLIF(p_message_id, ''))
  WHERE id = p_outbound_id AND instance_name = p_instance_name;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_cancel_bot_outbound(
  p_instance_name TEXT,
  p_token_hash TEXT,
  p_outbound_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_authorize_instance(p_instance_name, lower(p_token_hash))
  ) THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.whatsapp_bot_outbound_markers
  WHERE id = p_outbound_id AND instance_name = p_instance_name;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_classify_outbound_event(
  p_instance_name TEXT,
  p_token_hash TEXT,
  p_sender_phone TEXT,
  p_message_id TEXT DEFAULT NULL,
  p_content_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_bot BOOLEAN;
  v_paused_until TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_authorize_instance(p_instance_name, lower(p_token_hash))
  ) THEN
    RAISE EXCEPTION 'Conexão do WhatsApp não autorizada.' USING ERRCODE = '42501';
  END IF;
  IF p_sender_phone !~ '^[0-9]{6,24}$'
     OR (p_message_id IS NOT NULL AND length(p_message_id) > 160)
     OR (p_content_hash IS NOT NULL AND p_content_hash !~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'Dados inválidos para classificar a mensagem.' USING ERRCODE = '22023';
  END IF;

  SELECT TRUE INTO v_is_bot
  FROM public.whatsapp_bot_outbound_markers m
  WHERE m.instance_name = p_instance_name
    AND m.sender_phone = p_sender_phone
    AND m.expires_at > now()
    AND (
      (p_message_id IS NOT NULL AND m.message_id = p_message_id)
      OR (
        m.message_id IS NULL
        AND p_content_hash IS NOT NULL
        AND m.content_hash = lower(p_content_hash)
        AND m.created_at >= now() - interval '10 seconds'
      )
    )
  ORDER BY (m.message_id = p_message_id) DESC NULLS LAST, m.created_at DESC
  LIMIT 1;

  IF COALESCE(v_is_bot, FALSE) THEN
    RETURN jsonb_build_object('isBotMessage', TRUE, 'paused', FALSE);
  END IF;

  DELETE FROM public.whatsapp_handoffs
  WHERE instance_name = p_instance_name AND paused_until <= now();

  INSERT INTO public.whatsapp_handoffs (
    instance_name, sender_phone, paused_until, last_human_message_id, updated_at
  ) VALUES (
    p_instance_name,
    p_sender_phone,
    now() + interval '8 hours',
    NULLIF(p_message_id, ''),
    now()
  )
  ON CONFLICT (instance_name, sender_phone) DO UPDATE SET
    paused_until = EXCLUDED.paused_until,
    last_human_message_id = EXCLUDED.last_human_message_id,
    updated_at = now()
  RETURNING paused_until INTO v_paused_until;

  RETURN jsonb_build_object(
    'isBotMessage', FALSE,
    'paused', TRUE,
    'pausedUntil', v_paused_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_get_handoff_status(
  p_instance_name TEXT,
  p_token_hash TEXT,
  p_sender_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_paused_until TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_authorize_instance(p_instance_name, lower(p_token_hash))
  ) THEN
    RAISE EXCEPTION 'Conexão do WhatsApp não autorizada.' USING ERRCODE = '42501';
  END IF;
  IF p_sender_phone !~ '^[0-9]{6,24}$' THEN
    RAISE EXCEPTION 'Telefone de conversa inválido.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.whatsapp_handoffs
  WHERE instance_name = p_instance_name
    AND sender_phone = p_sender_phone
    AND paused_until <= now();

  SELECT h.paused_until INTO v_paused_until
  FROM public.whatsapp_handoffs h
  WHERE h.instance_name = p_instance_name
    AND h.sender_phone = p_sender_phone
    AND h.paused_until > now();

  RETURN jsonb_build_object(
    'paused', v_paused_until IS NOT NULL,
    'pausedUntil', v_paused_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_begin_bot_outbound(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_complete_bot_outbound(TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_cancel_bot_outbound(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_classify_outbound_event(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_get_handoff_status(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.whatsapp_begin_bot_outbound(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_complete_bot_outbound(TEXT, TEXT, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_cancel_bot_outbound(TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_classify_outbound_event(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_get_handoff_status(TEXT, TEXT, TEXT) TO anon;
