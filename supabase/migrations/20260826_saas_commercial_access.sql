-- ==============================================================================
-- ArenaPro — Etapa 6A: SaaS comercial, proprietários e assinaturas
-- Execute AFTER the existing ArenaPro schema.sql.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
    max_courts INTEGER,
    max_staff_users INTEGER,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    status entity_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.arena_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL UNIQUE REFERENCES public.arenas(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED')),
    monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
    current_period_start DATE,
    current_period_end DATE,
    paid_at TIMESTAMPTZ,
    external_customer_id VARCHAR(255),
    external_subscription_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_subscriptions_status
    ON public.arena_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_arena_subscriptions_plan
    ON public.arena_subscriptions(plan_id);

-- Default plans are intentionally editable by SUPER_ADMIN.
INSERT INTO public.subscription_plans
    (name, code, monthly_price, max_courts, max_staff_users, features)
VALUES
    ('Starter', 'STARTER', 79.90, 2, 2, '{"description":"Para arenas pequenas"}'::jsonb),
    ('Pro', 'PRO', 149.90, 10, 10, '{"description":"Para arenas em crescimento"}'::jsonb),
    ('Premium', 'PREMIUM', 249.90, NULL, NULL, '{"description":"Recursos avançados"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- A subscription is required for operational arena access.
CREATE OR REPLACE FUNCTION public.has_active_arena_subscription(lookup_arena_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.arena_subscriptions s
        WHERE s.arena_id = lookup_arena_id
          AND s.status = 'ACTIVE'
          AND (s.current_period_end IS NULL OR s.current_period_end >= CURRENT_DATE)
    );
$$;

-- Replace the access helpers so ARENA_ADMIN/STAFF are blocked when subscription is not active.
CREATE OR REPLACE FUNCTION public.has_arena_access(lookup_arena_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.is_super_admin()
        OR (
            public.has_active_arena_subscription(lookup_arena_id)
            AND EXISTS (
                SELECT 1
                FROM public.arena_users au
                WHERE au.arena_id = lookup_arena_id
                  AND au.user_id = auth.uid()
                  AND au.status = 'ACTIVE'::public.entity_status
                  AND au.role IN ('ARENA_ADMIN','ARENA_STAFF')
            )
        );
$$;

CREATE OR REPLACE FUNCTION public.is_arena_admin(lookup_arena_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.is_super_admin()
        OR (
            public.has_active_arena_subscription(lookup_arena_id)
            AND EXISTS (
                SELECT 1
                FROM public.arena_users au
                WHERE au.arena_id = lookup_arena_id
                  AND au.user_id = auth.uid()
                  AND au.role = 'ARENA_ADMIN'::public.user_role
                  AND au.status = 'ACTIVE'::public.entity_status
            )
        );
$$;

CREATE OR REPLACE FUNCTION public.get_user_arena_role(lookup_arena_id UUID)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT CASE
        WHEN public.is_super_admin() THEN 'SUPER_ADMIN'::public.user_role
        WHEN public.has_active_arena_subscription(lookup_arena_id) THEN (
            SELECT au.role
            FROM public.arena_users au
            WHERE au.arena_id = lookup_arena_id
              AND au.user_id = auth.uid()
              AND au.status = 'ACTIVE'::public.entity_status
            LIMIT 1
        )
        ELSE NULL
    END;
$$;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscription plans public read" ON public.subscription_plans;
DROP POLICY IF EXISTS "Subscription plans super admin manage" ON public.subscription_plans;
DROP POLICY IF EXISTS "Subscriptions super admin manage" ON public.arena_subscriptions;
DROP POLICY IF EXISTS "Subscriptions arena admin read" ON public.arena_subscriptions;

CREATE POLICY "Subscription plans public read"
ON public.subscription_plans FOR SELECT
USING (status = 'ACTIVE' OR public.is_super_admin());

CREATE POLICY "Subscription plans super admin manage"
ON public.subscription_plans FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Subscriptions super admin manage"
ON public.arena_subscriptions FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Subscriptions arena admin read"
ON public.arena_subscriptions FOR SELECT
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1
        FROM public.arena_users au
        WHERE au.arena_id = arena_subscriptions.arena_id
          AND au.user_id = auth.uid()
          AND au.role = 'ARENA_ADMIN'::public.user_role
          AND au.status = 'ACTIVE'::public.entity_status
    )
);

-- Only SUPER_ADMIN may create/change ARENA_ADMIN memberships.
DROP POLICY IF EXISTS "Arena users viewable by arena members" ON public.arena_users;
DROP POLICY IF EXISTS "Arena users manageable by arena admins" ON public.arena_users;
DROP POLICY IF EXISTS "Arena users super admin manage" ON public.arena_users;
DROP POLICY IF EXISTS "Arena admins manage staff" ON public.arena_users;

CREATE POLICY "Arena users super admin manage"
ON public.arena_users FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Arena users viewable by own user"
ON public.arena_users FOR SELECT
USING (
    public.is_super_admin()
    OR user_id = auth.uid()
);

CREATE POLICY "Arena admins manage staff"
ON public.arena_users FOR INSERT
WITH CHECK (
    public.is_arena_admin(arena_id)
    AND role = 'ARENA_STAFF'::public.user_role
);

CREATE POLICY "Arena admins update staff"
ON public.arena_users FOR UPDATE
USING (
    public.is_arena_admin(arena_id)
    AND role = 'ARENA_STAFF'::public.user_role
)
WITH CHECK (
    public.is_arena_admin(arena_id)
    AND role = 'ARENA_STAFF'::public.user_role
);

CREATE POLICY "Arena admins remove staff"
ON public.arena_users FOR DELETE
USING (
    public.is_arena_admin(arena_id)
    AND role = 'ARENA_STAFF'::public.user_role
);

-- No public insert/update/delete policy exists for arenas.
-- Therefore arena creation is intentionally reserved for the Edge Function/service role.

COMMENT ON TABLE public.arena_subscriptions IS
'Assinatura comercial da arena. Acesso operacional exige status ACTIVE e periodo vigente.';

COMMENT ON TABLE public.subscription_plans IS
'Planos comerciais administrados exclusivamente pelo SUPER_ADMIN.';


-- Remove the previous self-service arena creation path.
DROP FUNCTION IF EXISTS public.create_arena_for_current_user(TEXT,TEXT,TEXT,TEXT,TEXT);
