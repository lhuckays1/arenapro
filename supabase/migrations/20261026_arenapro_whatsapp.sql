-- Per-arena WhatsApp connections and guarded booking tools for the n8n agent.
-- The Evolution webhook token is stored only as a SHA-256 hash and is never
-- readable through the client-facing connection table.

CREATE TABLE IF NOT EXISTS public.arena_whatsapp_connections (
  arena_id UUID PRIMARY KEY REFERENCES public.arenas(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'DISCONNECTED'
    CHECK (status IN ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'ERROR')),
  phone_number TEXT,
  connected_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arena_whatsapp_webhook_secrets (
  arena_id UUID PRIMARY KEY REFERENCES public.arena_whatsapp_connections(arena_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL CHECK (length(token_hash) = 64),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_booking_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  confirmation_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED', 'UNAVAILABLE')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  confirmation_message_id TEXT,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_booking_offer_confirmation_message_uidx
  ON public.whatsapp_booking_offers (instance_name, confirmation_message_id)
  WHERE confirmation_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_booking_offers_sender_pending_idx
  ON public.whatsapp_booking_offers (instance_name, sender_phone, created_at DESC)
  WHERE status = 'PENDING';

ALTER TABLE public.arena_whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_whatsapp_webhook_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_booking_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arena admins view WhatsApp connection" ON public.arena_whatsapp_connections;
CREATE POLICY "Arena admins view WhatsApp connection"
  ON public.arena_whatsapp_connections FOR SELECT TO authenticated
  USING (public.is_arena_admin(arena_id));

-- No client policies are defined for secret hashes or pending booking offers.
REVOKE ALL ON public.arena_whatsapp_connections FROM anon, authenticated;
GRANT SELECT ON public.arena_whatsapp_connections TO authenticated;
REVOKE ALL ON public.arena_whatsapp_webhook_secrets FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_booking_offers FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_arena_whatsapp_connection(
  p_arena_id UUID,
  p_instance_name TEXT,
  p_token_hash TEXT
)
RETURNS public.arena_whatsapp_connections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved public.arena_whatsapp_connections;
BEGIN
  IF NOT public.is_arena_admin(p_arena_id) THEN
    RAISE EXCEPTION 'Apenas administradores da arena podem conectar o WhatsApp.' USING ERRCODE = '42501';
  END IF;
  IF p_instance_name !~ '^arenapro-[a-f0-9]{32}$' OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Dados inválidos para conexão do WhatsApp.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.arena_whatsapp_connections (arena_id, instance_name, status, created_by, updated_at)
  VALUES (p_arena_id, p_instance_name, 'CONNECTING', auth.uid(), now())
  ON CONFLICT (arena_id) DO UPDATE SET
    instance_name = EXCLUDED.instance_name,
    status = 'CONNECTING',
    last_error = NULL,
    updated_at = now()
  RETURNING * INTO saved;

  INSERT INTO public.arena_whatsapp_webhook_secrets (arena_id, token_hash, updated_at)
  VALUES (p_arena_id, p_token_hash, now())
  ON CONFLICT (arena_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, updated_at = now();

  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_arena_whatsapp_connection(
  p_arena_id UUID,
  p_status TEXT,
  p_phone_number TEXT DEFAULT NULL,
  p_last_error TEXT DEFAULT NULL
)
RETURNS public.arena_whatsapp_connections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved public.arena_whatsapp_connections;
BEGIN
  IF NOT public.is_arena_admin(p_arena_id) THEN
    RAISE EXCEPTION 'Apenas administradores da arena podem alterar a conexão do WhatsApp.' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'ERROR') THEN
    RAISE EXCEPTION 'Status de conexão inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.arena_whatsapp_connections
  SET status = p_status,
      phone_number = CASE WHEN p_status = 'DISCONNECTED' THEN NULL ELSE COALESCE(p_phone_number, phone_number) END,
      connected_at = CASE WHEN p_status = 'CONNECTED' THEN now()
                          WHEN p_status = 'DISCONNECTED' THEN NULL ELSE connected_at END,
      last_event_at = now(),
      last_error = p_last_error,
      updated_at = now()
  WHERE arena_id = p_arena_id
  RETURNING * INTO saved;

  IF NOT FOUND THEN RAISE EXCEPTION 'Conexão do WhatsApp não encontrada.'; END IF;
  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_arena_whatsapp_connection(p_arena_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_arena_admin(p_arena_id) THEN
    RAISE EXCEPTION 'Apenas administradores da arena podem desconectar o WhatsApp.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.arena_whatsapp_connections WHERE arena_id = p_arena_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_authorize_instance(
  p_instance_name TEXT,
  p_token_hash TEXT
)
RETURNS TABLE (arena_id UUID, arena_name TEXT, city TEXT, state TEXT, timezone TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.name, a.city, a.state, a.timezone
  FROM public.arena_whatsapp_connections c
  JOIN public.arena_whatsapp_webhook_secrets s ON s.arena_id = c.arena_id
  JOIN public.arenas a ON a.id = c.arena_id
  WHERE c.instance_name = p_instance_name
    AND s.token_hash = lower(p_token_hash)
    AND c.status IN ('CONNECTING', 'CONNECTED');
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_set_connection_status(
  p_instance_name TEXT,
  p_token_hash TEXT,
  p_status TEXT,
  p_phone_number TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_arena_id UUID;
BEGIN
  IF p_status NOT IN ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'ERROR') THEN RETURN FALSE; END IF;
  SELECT c.arena_id INTO v_arena_id
  FROM public.arena_whatsapp_connections c
  JOIN public.arena_whatsapp_webhook_secrets s ON s.arena_id = c.arena_id
  WHERE c.instance_name = p_instance_name AND s.token_hash = lower(p_token_hash);
  IF v_arena_id IS NULL THEN RETURN FALSE; END IF;

  UPDATE public.arena_whatsapp_connections
  SET status = p_status,
      phone_number = CASE WHEN p_status = 'DISCONNECTED' THEN NULL ELSE COALESCE(p_phone_number, phone_number) END,
      connected_at = CASE WHEN p_status = 'CONNECTED' THEN now()
                          WHEN p_status = 'DISCONNECTED' THEN NULL ELSE connected_at END,
      last_event_at = now(), updated_at = now(), last_error = NULL
  WHERE arena_id = v_arena_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_get_availability(
  p_instance_name TEXT,
  p_token_hash TEXT,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_arena_id UUID;
  v_timezone TEXT;
  result JSONB;
BEGIN
  SELECT c.arena_id, a.timezone INTO v_arena_id, v_timezone
  FROM public.arena_whatsapp_connections c
  JOIN public.arena_whatsapp_webhook_secrets s ON s.arena_id = c.arena_id
  JOIN public.arenas a ON a.id = c.arena_id
  WHERE c.instance_name = p_instance_name AND s.token_hash = lower(p_token_hash)
    AND c.status = 'CONNECTED' AND a.status = 'ACTIVE';
  IF v_arena_id IS NULL THEN RAISE EXCEPTION 'Conexão inválida ou inativa.' USING ERRCODE = '42501'; END IF;
  IF p_date < (now() AT TIME ZONE v_timezone)::date OR p_date > (now() AT TIME ZONE v_timezone)::date + 90 THEN
    RAISE EXCEPTION 'A data deve estar entre hoje e os próximos 90 dias.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'court_id', slots.court_id, 'court_name', slots.court_name,
    'modality', slots.modality, 'start_at', slots.start_at,
    'end_at', slots.end_at, 'price', slots.price
  ) ORDER BY slots.start_at, slots.court_name), '[]'::jsonb)
  INTO result
  FROM (
    SELECT c.id AS court_id, c.name AS court_name, m.name AS modality,
           (local_slot.slot_start AT TIME ZONE a.timezone) AS start_at,
           (local_slot.slot_start AT TIME ZONE a.timezone) + interval '1 hour' AS end_at,
           c.price
    FROM public.arenas a
    JOIN public.courts c ON c.arena_id = a.id AND c.status = 'ACTIVE'
    JOIN public.modalities m ON m.id = c.modality_id AND m.status = 'ACTIVE'
    CROSS JOIN LATERAL generate_series(
      p_date + a.opening_time::time,
      p_date + a.closing_time::time
        + CASE WHEN a.closing_time::time <= a.opening_time::time THEN interval '1 day' ELSE interval '0 day' END
        - interval '1 hour',
      interval '1 hour'
    ) AS local_slot(slot_start)
    WHERE a.id = v_arena_id
      AND (local_slot.slot_start AT TIME ZONE a.timezone) > now()
      AND NOT EXISTS (
        SELECT 1 FROM public.reservations r
        WHERE r.court_id = c.id AND r.status IN ('PENDING', 'CONFIRMED')
          AND (local_slot.slot_start AT TIME ZONE a.timezone) < r.end_at
          AND (local_slot.slot_start AT TIME ZONE a.timezone) + interval '1 hour' > r.start_at
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.court_blocks b
        WHERE b.court_id = c.id
          AND (local_slot.slot_start AT TIME ZONE a.timezone) < b.end_at
          AND (local_slot.slot_start AT TIME ZONE a.timezone) + interval '1 hour' > b.start_at
      )
  ) slots;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_create_booking_offer(
  p_instance_name TEXT,
  p_token_hash TEXT,
  p_sender_phone TEXT,
  p_customer_name TEXT,
  p_court_id UUID,
  p_start_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_arena_id UUID;
  v_price NUMERIC(10,2);
  v_timezone TEXT;
  v_open_time TIME;
  v_close_time TIME;
  v_local_start TIMESTAMP;
  v_local_open TIMESTAMP;
  v_local_close TIMESTAMP;
  v_offer public.whatsapp_booking_offers;
  v_end_at TIMESTAMPTZ := p_start_at + interval '1 hour';
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT c.arena_id, a.timezone, a.opening_time::time, a.closing_time::time
    INTO v_arena_id, v_timezone, v_open_time, v_close_time
  FROM public.arena_whatsapp_connections c
  JOIN public.arena_whatsapp_webhook_secrets s ON s.arena_id = c.arena_id
  JOIN public.arenas a ON a.id = c.arena_id AND a.status = 'ACTIVE'
  WHERE c.instance_name = p_instance_name AND s.token_hash = lower(p_token_hash)
    AND c.status = 'CONNECTED';
  IF v_arena_id IS NULL THEN RAISE EXCEPTION 'Conexão inválida.' USING ERRCODE = '42501'; END IF;
  IF length(regexp_replace(COALESCE(p_sender_phone, ''), '\D', '', 'g')) < 10
     OR length(trim(COALESCE(p_customer_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Nome e telefone do cliente são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF p_start_at <= v_now OR p_start_at < v_now + interval '30 minutes' THEN
    RAISE EXCEPTION 'O horário precisa começar com pelo menos 30 minutos de antecedência.' USING ERRCODE = '22023';
  END IF;
  v_local_start := p_start_at AT TIME ZONE v_timezone;
  v_local_open := v_local_start::date + v_open_time;
  v_local_close := v_local_start::date + v_close_time
    + CASE WHEN v_close_time <= v_open_time THEN interval '1 day' ELSE interval '0 day' END;
  IF v_local_start::date > (now() AT TIME ZONE v_timezone)::date + 90
     OR v_local_start < v_local_open
     OR v_local_start + interval '1 hour' > v_local_close
     OR date_trunc('hour', v_local_start) <> v_local_start THEN
    RAISE EXCEPTION 'O horário solicitado está fora do período de funcionamento da arena.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_court_id::text, 0));
  SELECT c.price INTO v_price FROM public.courts c
  WHERE c.id = p_court_id AND c.arena_id = v_arena_id AND c.status = 'ACTIVE';
  IF v_price IS NULL THEN RAISE EXCEPTION 'Quadra não encontrada ou indisponível.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.court_id = p_court_id AND r.status IN ('PENDING', 'CONFIRMED')
      AND p_start_at < r.end_at AND v_end_at > r.start_at
  ) OR EXISTS (
    SELECT 1 FROM public.court_blocks b
    WHERE b.court_id = p_court_id AND p_start_at < b.end_at AND v_end_at > b.start_at
  ) THEN
    RAISE EXCEPTION 'Esse horário acabou de ficar indisponível. Consulte os horários novamente.';
  END IF;

  INSERT INTO public.whatsapp_booking_offers (
    arena_id, instance_name, sender_phone, customer_name, court_id,
    start_at, end_at, amount, confirmation_code
  ) VALUES (
    v_arena_id, p_instance_name, regexp_replace(p_sender_phone, '\D', '', 'g'),
    trim(p_customer_name), p_court_id, p_start_at, v_end_at, v_price,
    upper(substr(md5(random()::text || clock_timestamp()::text || p_sender_phone), 1, 8))
  ) RETURNING * INTO v_offer;

  RETURN jsonb_build_object(
    'offer_id', v_offer.id, 'confirmation_code', v_offer.confirmation_code,
    'court_id', v_offer.court_id, 'start_at', v_offer.start_at,
    'end_at', v_offer.end_at, 'amount', v_offer.amount,
    'expires_at', v_offer.expires_at, 'status', v_offer.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_confirm_booking(
  p_instance_name TEXT,
  p_token_hash TEXT,
  p_sender_phone TEXT,
  p_confirmation_code TEXT,
  p_message_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_arena_id UUID;
  v_offer public.whatsapp_booking_offers;
  v_customer_id UUID;
  v_reservation public.reservations;
  v_phone TEXT := regexp_replace(COALESCE(p_sender_phone, ''), '\D', '', 'g');
BEGIN
  SELECT c.arena_id INTO v_arena_id
  FROM public.arena_whatsapp_connections c
  JOIN public.arena_whatsapp_webhook_secrets s ON s.arena_id = c.arena_id
  WHERE c.instance_name = p_instance_name AND s.token_hash = lower(p_token_hash)
    AND c.status = 'CONNECTED';
  IF v_arena_id IS NULL THEN RAISE EXCEPTION 'Conexão inválida.' USING ERRCODE = '42501'; END IF;
  IF COALESCE(trim(p_message_id), '') = '' THEN
    RAISE EXCEPTION 'Identificador da mensagem ausente.' USING ERRCODE = '22023';
  END IF;

  -- Idempotent response for Evolution webhook retries.
  SELECT o.* INTO v_offer FROM public.whatsapp_booking_offers o
  WHERE o.instance_name = p_instance_name AND o.confirmation_message_id = p_message_id
    AND o.status = 'CONFIRMED' AND o.reservation_id IS NOT NULL;
  IF FOUND THEN
    SELECT r.* INTO v_reservation FROM public.reservations r WHERE r.id = v_offer.reservation_id;
    RETURN jsonb_build_object('confirmed', true, 'reservation_id', v_reservation.id,
      'court_id', v_reservation.court_id, 'start_at', v_reservation.start_at,
      'end_at', v_reservation.end_at, 'amount', v_reservation.amount,
      'customer_name', v_offer.customer_name);
  END IF;

  SELECT o.* INTO v_offer
  FROM public.whatsapp_booking_offers o
  WHERE o.instance_name = p_instance_name AND o.arena_id = v_arena_id
    AND o.sender_phone = v_phone AND o.confirmation_code = upper(trim(p_confirmation_code))
    AND o.status = 'PENDING'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código de confirmação não encontrado. Solicite uma nova cotação.'; END IF;
  IF v_offer.expires_at <= now() THEN
    UPDATE public.whatsapp_booking_offers SET status = 'EXPIRED', updated_at = now() WHERE id = v_offer.id;
    RAISE EXCEPTION 'A oferta expirou. Consulte os horários novamente.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_offer.court_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.court_id = v_offer.court_id AND r.status IN ('PENDING', 'CONFIRMED')
      AND v_offer.start_at < r.end_at AND v_offer.end_at > r.start_at
  ) OR EXISTS (
    SELECT 1 FROM public.court_blocks b
    WHERE b.court_id = v_offer.court_id
      AND v_offer.start_at < b.end_at AND v_offer.end_at > b.start_at
  ) THEN
    UPDATE public.whatsapp_booking_offers SET status = 'UNAVAILABLE', updated_at = now() WHERE id = v_offer.id;
    RAISE EXCEPTION 'Esse horário não está mais disponível. Consulte os horários novamente.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_arena_id::text || ':' || v_phone, 1));
  SELECT c.id INTO v_customer_id FROM public.customers c
  WHERE c.arena_id = v_arena_id AND regexp_replace(c.phone, '\D', '', 'g') = v_phone
  ORDER BY c.created_at LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (arena_id, full_name, phone, status)
    VALUES (v_arena_id, v_offer.customer_name, v_phone, 'ACTIVE')
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers SET full_name = v_offer.customer_name, updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  INSERT INTO public.reservations (
    arena_id, court_id, customer_id, start_at, end_at, status, amount,
    payment_status, notes, created_by
  ) VALUES (
    v_arena_id, v_offer.court_id, v_customer_id, v_offer.start_at, v_offer.end_at,
    'CONFIRMED', v_offer.amount, 'PENDING', 'Reserva confirmada via WhatsApp.', NULL
  ) RETURNING * INTO v_reservation;

  UPDATE public.whatsapp_booking_offers
  SET status = 'CONFIRMED', confirmation_message_id = p_message_id,
      reservation_id = v_reservation.id, updated_at = now()
  WHERE id = v_offer.id;

  RETURN jsonb_build_object('confirmed', true, 'reservation_id', v_reservation.id,
    'court_id', v_reservation.court_id, 'start_at', v_reservation.start_at,
    'end_at', v_reservation.end_at, 'amount', v_reservation.amount,
    'customer_name', v_offer.customer_name);
END;
$$;

REVOKE ALL ON FUNCTION public.register_arena_whatsapp_connection(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_arena_whatsapp_connection(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_arena_whatsapp_connection(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_authorize_instance(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_set_connection_status(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_get_availability(TEXT, TEXT, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_create_booking_offer(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_confirm_booking(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_arena_whatsapp_connection(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_arena_whatsapp_connection(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_arena_whatsapp_connection(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_authorize_instance(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_set_connection_status(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_get_availability(TEXT, TEXT, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_create_booking_offer(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_confirm_booking(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


