-- Allow confirmation with a plain SIM only when one unexpired offer exists for this arena and sender.
-- The same advisory lock in both functions serializes offers and confirmations per sender.
CREATE TABLE IF NOT EXISTS public.whatsapp_booking_confirmation_attempts (
  instance_name TEXT NOT NULL,
  message_id TEXT NOT NULL,
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  sender_phone TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('no_pending_offer', 'multiple_pending_offers')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_name, message_id)
);
ALTER TABLE public.whatsapp_booking_confirmation_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_booking_confirmation_attempts FROM PUBLIC, anon, authenticated, service_role;

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
  v_phone TEXT := regexp_replace(COALESCE(p_sender_phone, ''), '\D', '', 'g');
BEGIN
  SELECT c.arena_id, a.timezone, a.opening_time::time, a.closing_time::time
    INTO v_arena_id, v_timezone, v_open_time, v_close_time
  FROM public.arena_whatsapp_connections c
  JOIN public.arena_whatsapp_webhook_secrets s ON s.arena_id = c.arena_id
  JOIN public.arenas a ON a.id = c.arena_id AND a.status = 'ACTIVE'
  WHERE c.instance_name = p_instance_name AND s.token_hash = lower(p_token_hash)
    AND c.status = 'CONNECTED';
  IF v_arena_id IS NULL THEN RAISE EXCEPTION 'Conexão inválida.' USING ERRCODE = '42501'; END IF;
  IF length(v_phone) < 10
     OR length(trim(COALESCE(p_customer_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Nome e telefone do cliente são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  -- Serialize offers and confirmations for a sender so a plain SIM is unambiguous.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_arena_id::text || ':' || v_phone, 1));

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
    v_arena_id, p_instance_name, v_phone,
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
  v_pending_count INTEGER;
  v_attempt_reason TEXT;
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
  IF length(v_phone) < 10 THEN
    RAISE EXCEPTION 'Telefone do cliente inválido.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_arena_id::text || ':' || v_phone, 1));

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

  IF COALESCE(trim(p_confirmation_code), '') = '' THEN
    SELECT a.reason INTO v_attempt_reason
    FROM public.whatsapp_booking_confirmation_attempts a
    WHERE a.instance_name = p_instance_name AND a.message_id = p_message_id
      AND a.arena_id = v_arena_id AND a.sender_phone = v_phone;
    IF FOUND THEN
      RETURN jsonb_build_object('confirmed', false, 'reason', v_attempt_reason);
    END IF;

    SELECT count(*) INTO v_pending_count
    FROM public.whatsapp_booking_offers o
    WHERE o.instance_name = p_instance_name AND o.arena_id = v_arena_id
      AND o.sender_phone = v_phone AND o.status = 'PENDING'
      AND o.expires_at > now();

    IF v_pending_count = 0 THEN
      INSERT INTO public.whatsapp_booking_confirmation_attempts
        (instance_name, message_id, arena_id, sender_phone, reason)
      VALUES (p_instance_name, p_message_id, v_arena_id, v_phone, 'no_pending_offer')
      ON CONFLICT (instance_name, message_id) DO NOTHING;
      SELECT a.reason INTO v_attempt_reason
      FROM public.whatsapp_booking_confirmation_attempts a
      WHERE a.instance_name = p_instance_name AND a.message_id = p_message_id
        AND a.arena_id = v_arena_id AND a.sender_phone = v_phone;
      RETURN jsonb_build_object('confirmed', false, 'reason', COALESCE(v_attempt_reason, 'no_pending_offer'));
    ELSIF v_pending_count > 1 THEN
      INSERT INTO public.whatsapp_booking_confirmation_attempts
        (instance_name, message_id, arena_id, sender_phone, reason)
      VALUES (p_instance_name, p_message_id, v_arena_id, v_phone, 'multiple_pending_offers')
      ON CONFLICT (instance_name, message_id) DO NOTHING;
      SELECT a.reason INTO v_attempt_reason
      FROM public.whatsapp_booking_confirmation_attempts a
      WHERE a.instance_name = p_instance_name AND a.message_id = p_message_id
        AND a.arena_id = v_arena_id AND a.sender_phone = v_phone;
      RETURN jsonb_build_object('confirmed', false, 'reason', COALESCE(v_attempt_reason, 'multiple_pending_offers'));
    END IF;

    SELECT o.* INTO v_offer
    FROM public.whatsapp_booking_offers o
    WHERE o.instance_name = p_instance_name AND o.arena_id = v_arena_id
      AND o.sender_phone = v_phone AND o.status = 'PENDING'
      AND o.expires_at > now()
    ORDER BY o.created_at DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT o.* INTO v_offer
    FROM public.whatsapp_booking_offers o
    WHERE o.instance_name = p_instance_name AND o.arena_id = v_arena_id
      AND o.sender_phone = v_phone
      AND o.confirmation_code = upper(trim(p_confirmation_code))
      AND o.status = 'PENDING'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Código de confirmação não encontrado. Solicite uma nova cotação.'; END IF;
    IF v_offer.expires_at <= now() THEN
      UPDATE public.whatsapp_booking_offers SET status = 'EXPIRED', updated_at = now() WHERE id = v_offer.id;
      RAISE EXCEPTION 'A oferta expirou. Consulte os horários novamente.';
    END IF;
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
