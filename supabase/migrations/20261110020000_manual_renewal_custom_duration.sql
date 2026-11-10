-- Let SUPER_ADMIN record manual renewals for a chosen number of days.
-- ASAAS one-off checkout metadata may be detached only when no open/unresolved
-- local ASAAS payment or checkout operation exists; recurring subscriptions and
-- Pagar.me-linked subscriptions remain protected against double billing.
CREATE FUNCTION public.record_manual_subscription_renewal(
  p_subscription_id uuid,
  p_actor_id uuid,
  p_payment_method text,
  p_reference text,
  p_notes text,
  p_duration_days integer
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
  IF p_duration_days IS NULL OR p_duration_days < 1 OR p_duration_days > 365 THEN
    RAISE EXCEPTION 'INVALID_RENEWAL_DURATION';
  END IF;

  SELECT * INTO v_subscription
  FROM public.arena_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND'; END IF;
  IF v_subscription.status IN ('SUSPENDED', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUBSCRIPTION_REQUIRES_REVIEW';
  END IF;
  IF v_subscription.external_subscription_id IS NOT NULL
    OR v_subscription.billing_provider NOT IN ('ASAAS') THEN
    RAISE EXCEPTION 'RECURRING_SUBSCRIPTION_LINKED';
  END IF;
  IF v_subscription.checkout_url IS NOT NULL
    OR v_subscription.external_checkout_id IS NOT NULL
    OR v_subscription.checkout_operation_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'CHECKOUT_IN_PROGRESS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.arena_subscription_payments payment
    WHERE payment.subscription_id = v_subscription.id
      AND payment.provider = 'ASAAS'
      AND payment.status IN ('PENDING', 'FAILED')
  ) THEN
    RAISE EXCEPTION 'ASAAS_PAYMENT_PENDING';
  END IF;
  IF v_subscription.monthly_price <= 0 THEN RAISE EXCEPTION 'SUBSCRIPTION_PRICE_NOT_CONFIGURED'; END IF;

  v_start := CASE
    WHEN v_subscription.current_period_end IS NULL OR v_subscription.current_period_end < CURRENT_DATE THEN CURRENT_DATE
    ELSE v_subscription.current_period_end
  END;
  v_end := v_start + p_duration_days;

  INSERT INTO public.arena_subscription_payments (
    subscription_id, provider, status, amount_cents, paid_at,
    description, recorded_by, payment_method, manual_reference
  ) VALUES (
    v_subscription.id, 'MANUAL', 'PAID',
    round(v_subscription.monthly_price * 100)::integer, now(),
    format('Renovação manual por %s dias — %s', p_duration_days, v_notes),
    p_actor_id, p_payment_method, nullif(left(trim(COALESCE(p_reference, '')), 120), '')
  ) RETURNING id INTO v_payment_id;

  UPDATE public.arena_subscriptions
  SET status = 'ACTIVE', current_period_start = v_start, current_period_end = v_end,
      paid_at = now(), checkout_url = NULL, checkout_url_created_at = NULL,
      billing_provider = NULL, external_checkout_id = NULL, checkout_billing_type = NULL,
      checkout_operation_id = NULL, checkout_operation_started_at = NULL,
      updated_at = now()
  WHERE id = v_subscription.id;

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'status', 'ACTIVE',
    'duration_days', p_duration_days, 'current_period_start', v_start, 'current_period_end', v_end,
    'amount_cents', round(v_subscription.monthly_price * 100)::integer);
END;
$$;

REVOKE ALL ON FUNCTION public.record_manual_subscription_renewal(uuid, uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_subscription_renewal(uuid, uuid, text, text, text, integer) TO service_role;
COMMENT ON FUNCTION public.record_manual_subscription_renewal(uuid, uuid, text, text, text, integer)
IS 'Registra pagamento manual confirmado pelo SUPER_ADMIN e renova por dias escolhidos, sem duplicar cobranças Asaas em aberto.';

-- Keep the previous RPC signature operational during a staggered deploy.
CREATE OR REPLACE FUNCTION public.record_manual_subscription_renewal(
  p_subscription_id uuid,
  p_actor_id uuid,
  p_payment_method text,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.record_manual_subscription_renewal(
    p_subscription_id, p_actor_id, p_payment_method, p_reference, p_notes, 30
  );
$$;
REVOKE ALL ON FUNCTION public.record_manual_subscription_renewal(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_subscription_renewal(uuid, uuid, text, text, text) TO service_role;

