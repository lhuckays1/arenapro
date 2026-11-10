-- In-app checkout for Pix and bank slip. Card capture remains disabled until
-- Asaas approves production tokenization for the ArenaPro account.
ALTER TABLE public.arena_subscriptions
  ADD COLUMN IF NOT EXISTS checkout_billing_type text,
  ADD COLUMN IF NOT EXISTS checkout_operation_id uuid,
  ADD COLUMN IF NOT EXISTS checkout_operation_started_at timestamptz;

ALTER TABLE public.arena_subscriptions
  DROP CONSTRAINT IF EXISTS arena_subscriptions_checkout_billing_type_check;
ALTER TABLE public.arena_subscriptions
  ADD CONSTRAINT arena_subscriptions_checkout_billing_type_check
  CHECK (checkout_billing_type IS NULL OR checkout_billing_type IN ('PIX', 'BOLETO'));

CREATE UNIQUE INDEX IF NOT EXISTS arena_subscriptions_checkout_operation_uidx
  ON public.arena_subscriptions(checkout_operation_id)
  WHERE checkout_operation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_asaas_in_app_checkout(
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
  IF v_subscription.external_subscription_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'state', 'existing_subscription',
      'provider_subscription_id', v_subscription.external_subscription_id,
      'billing_type', v_subscription.checkout_billing_type
    );
  END IF;
  IF v_subscription.checkout_billing_type IS NOT NULL
     AND v_subscription.checkout_billing_type <> p_billing_type THEN
    RETURN jsonb_build_object('state', 'billing_type_locked', 'billing_type', v_subscription.checkout_billing_type);
  END IF;

  IF v_subscription.checkout_operation_id IS NOT NULL
     AND v_subscription.checkout_operation_started_at IS NOT NULL
     AND v_subscription.checkout_operation_started_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object(
      'state', 'in_progress',
      'operation_id', v_subscription.checkout_operation_id,
      'billing_type', v_subscription.checkout_billing_type
    );
  END IF;

  v_operation_id := COALESCE(v_subscription.checkout_operation_id, gen_random_uuid());
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

CREATE OR REPLACE FUNCTION public.complete_asaas_in_app_checkout(
  p_subscription_id uuid,
  p_operation_id uuid,
  p_provider_subscription_id text,
  p_provider_customer_id text,
  p_billing_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.arena_subscriptions
  SET billing_provider = 'ASAAS',
      external_subscription_id = p_provider_subscription_id,
      external_customer_id = COALESCE(p_provider_customer_id, external_customer_id),
      checkout_billing_type = p_billing_type,
      checkout_operation_started_at = NULL,
      external_checkout_id = NULL,
      checkout_url = NULL,
      checkout_url_created_at = NULL,
      updated_at = now()
  WHERE id = p_subscription_id
    AND checkout_operation_id = p_operation_id
    AND (external_subscription_id IS NULL OR external_subscription_id = p_provider_subscription_id);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', v_updated = 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_asaas_in_app_checkout_attempt(
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
    AND checkout_operation_id = p_operation_id
    AND external_subscription_id IS NULL;
$$;

REVOKE ALL ON FUNCTION public.reserve_asaas_in_app_checkout(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_asaas_in_app_checkout(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.complete_asaas_in_app_checkout(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_asaas_in_app_checkout(uuid, uuid, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.release_asaas_in_app_checkout_attempt(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_asaas_in_app_checkout_attempt(uuid, uuid) TO service_role;

COMMENT ON COLUMN public.arena_subscriptions.checkout_billing_type IS 'Método de checkout Asaas, sem armazenar dados do pagador ou cartão.';
COMMENT ON COLUMN public.arena_subscriptions.checkout_operation_id IS 'Identificador local estável para recuperação idempotente de criação de assinatura Asaas.';
