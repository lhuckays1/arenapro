CREATE OR REPLACE FUNCTION public.reserve_asaas_oneoff_checkout(
  p_subscription_id uuid,
  p_billing_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_subscription public.arena_subscriptions%ROWTYPE;
  v_operation_id uuid;
BEGIN
  IF p_billing_type NOT IN ('PIX', 'BOLETO') THEN
    RETURN jsonb_build_object('state', 'invalid_billing_type');
  END IF;

  SELECT * INTO v_subscription
    FROM public.arena_subscriptions
   WHERE id = p_subscription_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('state', 'not_found'); END IF;
  IF v_subscription.status IN ('SUSPENDED', 'CANCELLED') THEN
    RETURN jsonb_build_object('state', 'subscription_blocked');
  END IF;
  IF v_subscription.status = 'ACTIVE'
     AND (v_subscription.current_period_end IS NULL OR v_subscription.current_period_end >= CURRENT_DATE) THEN
    RETURN jsonb_build_object('state', 'already_active');
  END IF;
  IF v_subscription.billing_provider IS NOT NULL AND v_subscription.billing_provider <> 'ASAAS' THEN
    RETURN jsonb_build_object('state', 'other_gateway');
  END IF;
  IF v_subscription.checkout_operation_started_at IS NOT NULL
     AND v_subscription.checkout_operation_started_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('state', 'in_progress');
  END IF;

  v_operation_id := gen_random_uuid();
  UPDATE public.arena_subscriptions
     SET billing_provider = 'ASAAS',
         checkout_billing_type = p_billing_type,
         checkout_operation_id = v_operation_id,
         checkout_operation_started_at = now(),
         updated_at = now()
   WHERE id = p_subscription_id;

  RETURN jsonb_build_object('state', 'reserved', 'operation_id', v_operation_id, 'billing_type', p_billing_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_asaas_oneoff_checkout(
  p_subscription_id uuid,
  p_operation_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.arena_subscriptions
     SET checkout_operation_started_at = NULL, updated_at = now()
   WHERE id = p_subscription_id
     AND checkout_operation_id = p_operation_id;
$$;

REVOKE ALL ON FUNCTION public.reserve_asaas_oneoff_checkout(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_asaas_oneoff_checkout(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_asaas_oneoff_checkout(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_asaas_oneoff_checkout(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.keep_refunded_asaas_test_recurrence_past_due()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status = 'CANCELLED'
     AND OLD.billing_provider = 'ASAAS'
     AND OLD.external_subscription_id IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.arena_subscription_payments p
        WHERE p.subscription_id = OLD.id
          AND p.provider = 'ASAAS'
          AND p.status = 'REFUNDED'
          AND p.created_at >= now() - interval '30 days'
     ) THEN
    NEW.status := 'PAST_DUE';
    NEW.paid_at := NULL;
    NEW.external_subscription_id := NULL;
    NEW.checkout_url := NULL;
    NEW.checkout_url_created_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_refunded_asaas_test_recurrence_past_due ON public.arena_subscriptions;
CREATE TRIGGER keep_refunded_asaas_test_recurrence_past_due
BEFORE UPDATE OF status ON public.arena_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.keep_refunded_asaas_test_recurrence_past_due();

