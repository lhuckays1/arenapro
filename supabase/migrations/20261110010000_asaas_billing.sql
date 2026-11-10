-- Additive Asaas support. Existing Pagar.me records and tables stay intact.
ALTER TABLE public.arena_subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider text,
  ADD COLUMN IF NOT EXISTS external_checkout_id text;

ALTER TABLE public.arena_subscriptions
  DROP CONSTRAINT IF EXISTS arena_subscriptions_billing_provider_check;
ALTER TABLE public.arena_subscriptions
  ADD CONSTRAINT arena_subscriptions_billing_provider_check
  CHECK (billing_provider IS NULL OR billing_provider IN ('ASAAS', 'PAGARME'));

-- Tag old checkout/recurrence records so the Asaas endpoint cannot silently
-- reuse a Pagar.me URL or create a second recurring charge during migration.
UPDATE public.arena_subscriptions
SET billing_provider = 'PAGARME'
WHERE billing_provider IS NULL
  AND (external_subscription_id IS NOT NULL OR external_plan_id IS NOT NULL OR checkout_url IS NOT NULL);

ALTER TABLE public.arena_subscription_payments
  DROP CONSTRAINT IF EXISTS arena_subscription_payments_provider_check;
ALTER TABLE public.arena_subscription_payments
  ADD CONSTRAINT arena_subscription_payments_provider_check
  CHECK (provider IN ('ASAAS', 'PAGARME', 'MANUAL'));

CREATE UNIQUE INDEX IF NOT EXISTS arena_subscription_payments_asaas_payment_uidx
  ON public.arena_subscription_payments(provider, provider_payment_id)
  WHERE provider = 'ASAAS' AND provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  subscription_id uuid REFERENCES public.arena_subscriptions(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asaas_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.asaas_webhook_events TO authenticated;
GRANT ALL ON public.asaas_webhook_events TO service_role;
DROP POLICY IF EXISTS "Super admins read Asaas webhook events" ON public.asaas_webhook_events;
CREATE POLICY "Super admins read Asaas webhook events"
ON public.asaas_webhook_events FOR SELECT TO authenticated
USING (public.is_super_admin());

-- Avoid a manual renewal while a provider checkout or recurring subscription
-- is linked. This also protects the new Asaas checkout from duplicate charges.
CREATE OR REPLACE FUNCTION public.record_manual_subscription_renewal(
  p_subscription_id uuid,
  p_actor_id uuid,
  p_payment_method text,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_subscription public.arena_subscriptions%ROWTYPE;
  v_start date;
  v_end date;
  v_payment_id uuid;
  v_notes text := left(trim(COALESCE(p_notes, '')), 500);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_actor_id AND p.role = 'SUPER_ADMIN'::public.user_role
  ) THEN
    RAISE EXCEPTION 'SUPER_ADMIN_REQUIRED';
  END IF;
  IF p_payment_method NOT IN ('PIX', 'CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'OTHER') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;
  IF length(v_notes) < 5 THEN
    RAISE EXCEPTION 'MANUAL_PAYMENT_NOTES_REQUIRED';
  END IF;

  SELECT * INTO v_subscription
  FROM public.arena_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;
  IF v_subscription.status IN ('SUSPENDED', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUBSCRIPTION_REQUIRES_REVIEW';
  END IF;
  IF v_subscription.external_subscription_id IS NOT NULL OR v_subscription.billing_provider IS NOT NULL THEN
    RAISE EXCEPTION 'RECURRING_SUBSCRIPTION_LINKED';
  END IF;
  IF v_subscription.monthly_price <= 0 THEN RAISE EXCEPTION 'SUBSCRIPTION_PRICE_NOT_CONFIGURED'; END IF;

  v_start := CASE
    WHEN v_subscription.current_period_end IS NULL OR v_subscription.current_period_end < CURRENT_DATE THEN CURRENT_DATE
    ELSE v_subscription.current_period_end
  END;
  v_end := CASE
    WHEN v_subscription.current_period_end IS NULL OR v_subscription.current_period_end < CURRENT_DATE THEN (CURRENT_DATE + interval '1 month')::date
    ELSE (v_subscription.current_period_end + interval '1 month')::date
  END;

  INSERT INTO public.arena_subscription_payments (
    subscription_id, provider, status, amount_cents, paid_at,
    description, recorded_by, payment_method, manual_reference
  ) VALUES (
    v_subscription.id, 'MANUAL', 'PAID',
    round(v_subscription.monthly_price * 100)::integer, now(),
    v_notes, p_actor_id, p_payment_method, nullif(left(trim(COALESCE(p_reference, '')), 120), '')
  ) RETURNING id INTO v_payment_id;

  UPDATE public.arena_subscriptions
  SET status = 'ACTIVE', current_period_start = v_start, current_period_end = v_end,
      paid_at = now(), checkout_url = NULL, checkout_url_created_at = NULL, updated_at = now()
  WHERE id = v_subscription.id;

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'status', 'ACTIVE',
    'current_period_start', v_start, 'current_period_end', v_end,
    'amount_cents', round(v_subscription.monthly_price * 100)::integer);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_asaas_billing_event(
  p_event_id text,
  p_event_type text,
  p_provider_subscription_id text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_provider_customer_id text DEFAULT NULL,
  p_external_reference text DEFAULT NULL,
  p_amount_cents integer DEFAULT 0,
  p_due_date date DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_subscription public.arena_subscriptions%ROWTYPE;
  v_inserted integer;
  v_processed_at timestamptz;
  v_previous_status text;
  v_payment_status text;
  v_result jsonb;
BEGIN
  IF p_event_id IS NULL OR length(trim(p_event_id)) = 0 THEN
    RAISE EXCEPTION 'ASAAS_EVENT_ID_REQUIRED';
  END IF;

  INSERT INTO public.asaas_webhook_events(event_id, event_type)
  VALUES (p_event_id, COALESCE(p_event_type, 'unknown'))
  ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    SELECT processed_at INTO v_processed_at FROM public.asaas_webhook_events WHERE event_id = p_event_id FOR UPDATE;
    IF v_processed_at IS NOT NULL THEN RETURN jsonb_build_object('duplicate', true); END IF;
  END IF;

  SELECT * INTO v_subscription
  FROM public.arena_subscriptions s
  WHERE s.billing_provider = 'ASAAS'
    AND (
      (p_external_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND s.id = p_external_reference::uuid)
      OR (p_provider_subscription_id IS NOT NULL AND s.external_subscription_id = p_provider_subscription_id)
    )
  ORDER BY CASE WHEN p_provider_subscription_id IS NOT NULL AND s.external_subscription_id = p_provider_subscription_id THEN 0 ELSE 1 END
  LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    v_result := jsonb_build_object('matched', false);
    UPDATE public.asaas_webhook_events SET result = v_result WHERE event_id = p_event_id;
    RETURN v_result;
  END IF;

  UPDATE public.asaas_webhook_events SET subscription_id = v_subscription.id WHERE event_id = p_event_id;
  IF p_provider_subscription_id IS NOT NULL AND p_event_type LIKE 'SUBSCRIPTION_%' THEN
    UPDATE public.arena_subscriptions
       SET external_subscription_id = p_provider_subscription_id,
           external_customer_id = COALESCE(p_provider_customer_id, external_customer_id),
           checkout_url = NULL,
           updated_at = now()
     WHERE id = v_subscription.id;
  END IF;

  IF p_event_type LIKE 'PAYMENT_%' THEN
    v_payment_status := CASE p_event_type
      WHEN 'PAYMENT_CREATED' THEN 'PENDING'
      WHEN 'PAYMENT_CONFIRMED' THEN 'PAID'
      WHEN 'PAYMENT_RECEIVED' THEN 'PAID'
      WHEN 'PAYMENT_OVERDUE' THEN 'FAILED'
      WHEN 'PAYMENT_DELETED' THEN 'CANCELED'
      WHEN 'PAYMENT_REFUNDED' THEN 'REFUNDED'
      ELSE NULL
    END;
    IF v_payment_status IS NOT NULL AND p_provider_payment_id IS NOT NULL THEN
      SELECT status INTO v_previous_status
        FROM public.arena_subscription_payments
       WHERE provider = 'ASAAS' AND provider_payment_id = p_provider_payment_id
       FOR UPDATE;
      INSERT INTO public.arena_subscription_payments (
        subscription_id, provider, provider_payment_id, event_id, status,
        amount_cents, due_date, paid_at, description
      ) VALUES (
        v_subscription.id, 'ASAAS', p_provider_payment_id, p_event_id, v_payment_status,
        GREATEST(COALESCE(p_amount_cents, 0), 0), p_due_date,
        CASE WHEN v_payment_status = 'PAID' THEN COALESCE(p_paid_at, now()) ELSE NULL END,
        'Asaas ' || p_event_type
      )
      ON CONFLICT (provider, provider_payment_id) WHERE provider = 'ASAAS' AND provider_payment_id IS NOT NULL
      DO UPDATE SET event_id = EXCLUDED.event_id,
                    status = CASE
                      WHEN arena_subscription_payments.status = 'PAID'
                       AND EXCLUDED.status IN ('PENDING', 'FAILED', 'CANCELED')
                      THEN arena_subscription_payments.status
                      ELSE EXCLUDED.status
                    END,
                    amount_cents = EXCLUDED.amount_cents,
                    due_date = EXCLUDED.due_date,
                    paid_at = EXCLUDED.paid_at,
                    description = EXCLUDED.description,
                    updated_at = now();

      IF v_payment_status = 'PAID' AND v_previous_status IS DISTINCT FROM 'PAID' THEN
        UPDATE public.arena_subscriptions
           SET status = CASE WHEN status IN ('CANCELLED', 'SUSPENDED') THEN status ELSE 'ACTIVE' END,
               monthly_price = COALESCE(NULLIF(p_amount_cents, 0), round(monthly_price * 100)::integer)::numeric / 100,
               current_period_start = CASE WHEN current_period_end IS NULL OR current_period_end < CURRENT_DATE THEN CURRENT_DATE ELSE current_period_end END,
               current_period_end = CASE WHEN current_period_end IS NULL OR current_period_end < CURRENT_DATE THEN (CURRENT_DATE + interval '1 month')::date ELSE (current_period_end + interval '1 month')::date END,
               paid_at = COALESCE(p_paid_at, now()),
               checkout_url = NULL,
               checkout_url_created_at = NULL,
               updated_at = now()
         WHERE id = v_subscription.id;
      ELSIF v_payment_status = 'FAILED'
        AND v_previous_status IS DISTINCT FROM 'PAID'
        AND (p_due_date IS NULL OR v_subscription.current_period_end IS NULL OR p_due_date >= v_subscription.current_period_end) THEN
        UPDATE public.arena_subscriptions SET status = CASE WHEN status IN ('CANCELLED', 'SUSPENDED') THEN status ELSE 'PAST_DUE' END, updated_at = now() WHERE id = v_subscription.id;
      END IF;
    END IF;
  ELSIF p_event_type IN ('SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_DELETED') THEN
    UPDATE public.arena_subscriptions SET status = 'CANCELLED', checkout_url = NULL, updated_at = now() WHERE id = v_subscription.id;
  END IF;

  v_result := jsonb_build_object('matched', true, 'subscription_id', v_subscription.id);
  UPDATE public.asaas_webhook_events SET processed_at = now(), result = v_result WHERE event_id = p_event_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.process_asaas_billing_event(text, text, text, text, text, text, integer, date, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_asaas_billing_event(text, text, text, text, text, text, integer, date, timestamptz) TO service_role;
COMMENT ON TABLE public.asaas_webhook_events IS 'Eventos Asaas processados de forma idempotente; payloads financeiros completos não são armazenados.';
