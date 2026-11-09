-- Billing foundation for ArenaPro subscriptions through Pagar.me.
-- Apply only after reviewing the migration in the target Supabase project.

ALTER TABLE public.arena_subscriptions
  ADD COLUMN IF NOT EXISTS external_plan_id text,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS checkout_url_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 5
    CHECK (grace_period_days BETWEEN 0 AND 30);

CREATE TABLE IF NOT EXISTS public.arena_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.arena_subscriptions(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'PAGARME' CHECK (provider = 'PAGARME'),
  provider_payment_id text,
  event_id text,
  status text NOT NULL CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  due_date date,
  paid_at timestamptz,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep off-gateway payments in the same audit history without claiming they
-- were processed by Pagar.me.
ALTER TABLE public.arena_subscription_payments
  DROP CONSTRAINT IF EXISTS arena_subscription_payments_provider_check;
ALTER TABLE public.arena_subscription_payments
  ADD CONSTRAINT arena_subscription_payments_provider_check
  CHECK (provider IN ('PAGARME', 'MANUAL'));
ALTER TABLE public.arena_subscription_payments
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IS NULL OR payment_method IN ('PIX', 'CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'OTHER')),
  ADD COLUMN IF NOT EXISTS manual_reference text;

CREATE INDEX IF NOT EXISTS arena_subscription_payments_provider_payment_idx
  ON public.arena_subscription_payments(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS arena_subscription_payments_event_uidx
  ON public.arena_subscription_payments(provider, event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS arena_subscription_payments_subscription_created_idx
  ON public.arena_subscription_payments(subscription_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pagarme_plan_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.arena_subscriptions(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  environment text NOT NULL CHECK (environment IN ('test', 'live')),
  provider_plan_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, amount_cents, environment),
  UNIQUE (environment, provider_plan_id)
);

CREATE TABLE IF NOT EXISTS public.pagarme_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  subscription_id uuid REFERENCES public.arena_subscriptions(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.arena_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagarme_plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagarme_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Arena admins read subscription payments" ON public.arena_subscription_payments;
CREATE POLICY "Arena admins read subscription payments"
ON public.arena_subscription_payments FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1
    FROM public.arena_subscriptions s
    JOIN public.arena_users au ON au.arena_id = s.arena_id
    WHERE s.id = arena_subscription_payments.subscription_id
      AND au.user_id = (select auth.uid())
      AND au.role = 'ARENA_ADMIN'::public.user_role
      AND au.status = 'ACTIVE'::public.entity_status
  )
);

DROP POLICY IF EXISTS "Super admins manage Pagarme catalog" ON public.pagarme_plan_catalog;
CREATE POLICY "Super admins manage Pagarme catalog"
ON public.pagarme_plan_catalog FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins read Pagarme webhook events" ON public.pagarme_webhook_events;
CREATE POLICY "Super admins read Pagarme webhook events"
ON public.pagarme_webhook_events FOR SELECT TO authenticated
USING (public.is_super_admin());

REVOKE ALL ON public.arena_subscription_payments FROM anon, authenticated;
GRANT SELECT ON public.arena_subscription_payments TO authenticated;
GRANT ALL ON public.arena_subscription_payments TO service_role;
REVOKE ALL ON public.pagarme_plan_catalog FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagarme_plan_catalog TO authenticated;
GRANT ALL ON public.pagarme_plan_catalog TO service_role;
REVOKE ALL ON public.pagarme_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.pagarme_webhook_events TO authenticated;
GRANT ALL ON public.pagarme_webhook_events TO service_role;

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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
  END IF;
  IF v_subscription.status IN ('SUSPENDED', 'CANCELLED') THEN
    RAISE EXCEPTION 'SUBSCRIPTION_REQUIRES_REVIEW';
  END IF;
  IF v_subscription.external_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'PAGARME_RECURRING_SUBSCRIPTION_LINKED';
  END IF;
  IF v_subscription.monthly_price <= 0 THEN
    RAISE EXCEPTION 'SUBSCRIPTION_PRICE_NOT_CONFIGURED';
  END IF;

  v_start := CASE
    WHEN v_subscription.current_period_end IS NULL
      OR v_subscription.current_period_end < CURRENT_DATE THEN CURRENT_DATE
    ELSE v_subscription.current_period_end
  END;
  v_end := CASE
    WHEN v_subscription.current_period_end IS NULL
      OR v_subscription.current_period_end < CURRENT_DATE THEN (CURRENT_DATE + interval '1 month')::date
    ELSE (v_subscription.current_period_end + interval '1 month')::date
  END;

  INSERT INTO public.arena_subscription_payments (
    subscription_id, provider, status, amount_cents, paid_at,
    description, recorded_by, payment_method, manual_reference
  ) VALUES (
    v_subscription.id, 'MANUAL', 'PAID',
    round(v_subscription.monthly_price * 100)::integer, now(),
    v_notes, p_actor_id, p_payment_method, nullif(left(trim(COALESCE(p_reference, '')), 120), '')
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.arena_subscriptions
  SET status = 'ACTIVE',
      current_period_start = v_start,
      current_period_end = v_end,
      paid_at = now(),
      checkout_url = NULL,
      checkout_url_created_at = NULL,
      updated_at = now()
  WHERE id = v_subscription.id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'status', 'ACTIVE',
    'current_period_start', v_start,
    'current_period_end', v_end,
    'amount_cents', round(v_subscription.monthly_price * 100)::integer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_manual_subscription_renewal(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_subscription_renewal(uuid, uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.process_pagarme_billing_event(
  p_event_id text,
  p_event_type text,
  p_provider_subscription_id text DEFAULT NULL,
  p_provider_plan_id text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_amount_cents integer DEFAULT 0,
  p_due_date date DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL,
  p_provider_customer_id text DEFAULT NULL
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
  v_payment_status text;
  v_new_status text;
  v_result jsonb;
BEGIN
  IF p_event_id IS NULL OR length(trim(p_event_id)) = 0 THEN
    RAISE EXCEPTION 'PAGARME_EVENT_ID_REQUIRED';
  END IF;

  INSERT INTO public.pagarme_webhook_events(event_id, event_type)
  VALUES (p_event_id, COALESCE(p_event_type, 'unknown'))
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    SELECT processed_at INTO v_processed_at
      FROM public.pagarme_webhook_events
     WHERE event_id = p_event_id;
    IF v_processed_at IS NOT NULL THEN
      RETURN jsonb_build_object('duplicate', true);
    END IF;
  END IF;

  SELECT * INTO v_subscription
  FROM public.arena_subscriptions s
  WHERE (p_provider_subscription_id IS NOT NULL AND s.external_subscription_id = p_provider_subscription_id)
     OR (p_provider_plan_id IS NOT NULL AND s.external_plan_id = p_provider_plan_id)
  ORDER BY CASE WHEN s.external_subscription_id = p_provider_subscription_id THEN 0 ELSE 1 END
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    v_result := jsonb_build_object('matched', false);
    UPDATE public.pagarme_webhook_events
       SET result = v_result
     WHERE event_id = p_event_id;
    RETURN v_result;
  END IF;

  UPDATE public.pagarme_webhook_events
     SET subscription_id = v_subscription.id
   WHERE event_id = p_event_id;

  IF p_provider_subscription_id IS NOT NULL THEN
    UPDATE public.arena_subscriptions
       SET external_subscription_id = p_provider_subscription_id,
           external_customer_id = COALESCE(p_provider_customer_id, external_customer_id),
           updated_at = now()
     WHERE id = v_subscription.id;
  ELSIF p_provider_customer_id IS NOT NULL THEN
    UPDATE public.arena_subscriptions
       SET external_customer_id = p_provider_customer_id,
           updated_at = now()
     WHERE id = v_subscription.id;
  END IF;

  IF p_event_type IN ('invoice.paid', 'invoice.payment_failed', 'invoice.canceled') THEN
    v_payment_status := CASE p_event_type
      WHEN 'invoice.paid' THEN 'PAID'
      WHEN 'invoice.payment_failed' THEN 'FAILED'
      ELSE 'CANCELED'
    END;

    INSERT INTO public.arena_subscription_payments (
      subscription_id, provider_payment_id, event_id, status,
      amount_cents, due_date, paid_at, description
    ) VALUES (
      v_subscription.id, p_provider_payment_id, p_event_id, v_payment_status,
      GREATEST(COALESCE(p_amount_cents, 0), 0), p_due_date,
      CASE WHEN v_payment_status = 'PAID' THEN COALESCE(p_paid_at, now()) ELSE NULL END,
      'Pagar.me ' || p_event_type
    )
    ON CONFLICT (provider, event_id) WHERE event_id IS NOT NULL
    DO UPDATE SET status = EXCLUDED.status,
                  amount_cents = EXCLUDED.amount_cents,
                  due_date = EXCLUDED.due_date,
                  paid_at = EXCLUDED.paid_at,
                  updated_at = now();

    IF p_event_type = 'invoice.paid' THEN
      UPDATE public.arena_subscriptions
         SET status = CASE WHEN status IN ('CANCELLED', 'SUSPENDED') THEN status ELSE 'ACTIVE' END,
             monthly_price = COALESCE(NULLIF(p_amount_cents, 0), round(monthly_price * 100)::integer)::numeric / 100,
             current_period_start = CASE
               WHEN current_period_end IS NULL OR current_period_end < CURRENT_DATE THEN CURRENT_DATE
               ELSE current_period_end
             END,
             current_period_end = CASE
               WHEN current_period_end IS NULL OR current_period_end < CURRENT_DATE THEN (CURRENT_DATE + interval '1 month')::date
               ELSE (current_period_end + interval '1 month')::date
             END,
             paid_at = COALESCE(p_paid_at, now()),
             checkout_url = NULL,
             checkout_url_created_at = NULL,
             updated_at = now()
       WHERE id = v_subscription.id;
      v_new_status := CASE WHEN v_subscription.status IN ('CANCELLED', 'SUSPENDED') THEN v_subscription.status ELSE 'ACTIVE' END;
    ELSIF p_event_type = 'invoice.payment_failed' THEN
      UPDATE public.arena_subscriptions
         SET status = CASE WHEN status IN ('CANCELLED', 'SUSPENDED') THEN status ELSE 'PAST_DUE' END,
             updated_at = now()
       WHERE id = v_subscription.id;
      v_new_status := CASE WHEN v_subscription.status IN ('CANCELLED', 'SUSPENDED') THEN v_subscription.status ELSE 'PAST_DUE' END;
    END IF;
  ELSIF p_event_type = 'subscription.canceled' THEN
    UPDATE public.arena_subscriptions
       SET status = 'CANCELLED', checkout_url = NULL,
           checkout_url_created_at = NULL, updated_at = now()
     WHERE id = v_subscription.id;
    v_new_status := 'CANCELLED';
  END IF;

  v_result := jsonb_build_object('matched', true, 'subscription_id', v_subscription.id, 'status', v_new_status);
  UPDATE public.pagarme_webhook_events
     SET processed_at = now(), result = v_result
   WHERE event_id = p_event_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.process_pagarme_billing_event(text, text, text, text, text, integer, date, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_pagarme_billing_event(text, text, text, text, text, integer, date, timestamptz, text) TO service_role;

CREATE OR REPLACE FUNCTION public.has_active_arena_subscription(lookup_arena_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.arena_subscriptions s
    WHERE s.arena_id = lookup_arena_id
      AND (
        (s.status = 'ACTIVE' AND (s.current_period_end IS NULL OR s.current_period_end >= CURRENT_DATE))
        OR (s.status = 'PAST_DUE' AND s.current_period_end IS NOT NULL
            AND s.current_period_end + s.grace_period_days >= CURRENT_DATE)
      )
  );
$$;

COMMENT ON TABLE public.arena_subscription_payments IS 'Histórico de cobranças da assinatura. Não armazena dados de cartão.';
COMMENT ON TABLE public.pagarme_webhook_events IS 'Eventos Pagar.me processados com chave de idempotência; payload financeiro bruto não é persistido.';
COMMENT ON FUNCTION public.record_manual_subscription_renewal(uuid, uuid, text, text, text) IS 'Registra pagamento recebido fora do Pagar.me e renova um período, com auditoria do SUPER_ADMIN.';

