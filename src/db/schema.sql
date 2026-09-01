-- ==============================================================================
-- ArenaPro — SaaS Multi-Tenant Database Schema (PostgreSQL / Supabase)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ARENA_ADMIN', 'ARENA_STAFF', 'CLIENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE entity_status AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BANK_TRANSFER', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE financial_transaction_type AS ENUM ('INCOME', 'EXPENSE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE financial_transaction_status AS ENUM ('COMPLETED', 'PENDING', 'CANCELLED', 'VOID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES

-- ARENAS (Tenants)
CREATE TABLE IF NOT EXISTS public.arenas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    logo_url TEXT,
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    opening_time VARCHAR(10) DEFAULT '06:00',
    closing_time VARCHAR(10) DEFAULT '23:00',
    cancellation_limit_hours INTEGER DEFAULT 2,
    status entity_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PROFILES (Users synced from Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    role user_role DEFAULT 'CLIENT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ARENA_USERS (Multi-tenant permissions link between users and arenas)
CREATE TABLE IF NOT EXISTS public.arena_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'ARENA_STAFF',
    status entity_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(arena_id, user_id)
);

-- MODALITIES (Sports categories per Arena)
CREATE TABLE IF NOT EXISTS public.modalities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    status entity_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(arena_id, name)
);

-- COURTS (Fields/Pitches/Courts)
CREATE TABLE IF NOT EXISTS public.courts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    modality_id UUID NOT NULL REFERENCES public.modalities(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    capacity INTEGER DEFAULT 4,
    price NUMERIC(10, 2) NOT NULL DEFAULT 80.00,
    status entity_status DEFAULT 'ACTIVE',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CUSTOMERS (Customers per Arena)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    birth_date DATE,
    notes TEXT,
    status entity_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SERVICES (Additional rental/classes/bar)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    duration_minutes INTEGER DEFAULT 60,
    status entity_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RESERVATIONS (Core Booking Entity)
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status reservation_status DEFAULT 'PENDING',
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status payment_status DEFAULT 'PENDING',
    payment_method payment_method,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_reservation_dates CHECK (end_at > start_at)
);

-- COURT_BLOCKS (Maintenance, Weather, Events, or Operational Blocks)
CREATE TABLE IF NOT EXISTS public.court_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(255) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_court_block_dates CHECK (end_at > start_at)
);

-- FINANCIAL_TRANSACTIONS (Core Financial Ledger: Income & Expenses)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
    type financial_transaction_type NOT NULL,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_method payment_method NOT NULL DEFAULT 'PIX',
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    status financial_transaction_status NOT NULL DEFAULT 'COMPLETED',
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INDEXES for high performance multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_arena_users_user ON public.arena_users(user_id);
CREATE INDEX IF NOT EXISTS idx_arena_users_arena ON public.arena_users(arena_id);
CREATE INDEX IF NOT EXISTS idx_modalities_arena ON public.modalities(arena_id);
CREATE INDEX IF NOT EXISTS idx_courts_arena ON public.courts(arena_id);
CREATE INDEX IF NOT EXISTS idx_customers_arena ON public.customers(arena_id);
CREATE INDEX IF NOT EXISTS idx_reservations_arena ON public.reservations(arena_id);
CREATE INDEX IF NOT EXISTS idx_reservations_court_dates ON public.reservations(court_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_court_blocks_arena ON public.court_blocks(arena_id);
CREATE INDEX IF NOT EXISTS idx_court_blocks_court_dates ON public.court_blocks(court_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_arena ON public.financial_transactions(arena_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON public.financial_transactions(arena_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_reservation ON public.financial_transactions(reservation_id);

-- 3. INTEGRITY & CONFLICT PREVENTION TRIGGERS

CREATE OR REPLACE FUNCTION public.validate_court_modality_arena()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    mod_arena UUID;
BEGIN
    SELECT arena_id INTO mod_arena
    FROM public.modalities
    WHERE id = NEW.modality_id;

    IF mod_arena IS NULL OR mod_arena <> NEW.arena_id THEN
        RAISE EXCEPTION 'Integridade violada: a modalidade (%) não pertence à arena (%).',
            NEW.modality_id, NEW.arena_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_court_modality_arena ON public.courts;
CREATE TRIGGER trg_validate_court_modality_arena
BEFORE INSERT OR UPDATE OF arena_id, modality_id ON public.courts
FOR EACH ROW EXECUTE FUNCTION public.validate_court_modality_arena();


CREATE OR REPLACE FUNCTION public.validate_reservation_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    court_arena UUID;
    customer_arena UUID;
BEGIN
    SELECT arena_id INTO court_arena
    FROM public.courts
    WHERE id = NEW.court_id;

    SELECT arena_id INTO customer_arena
    FROM public.customers
    WHERE id = NEW.customer_id;

    IF court_arena IS NULL OR court_arena <> NEW.arena_id THEN
        RAISE EXCEPTION 'Integridade violada: a quadra não pertence à arena informada.';
    END IF;

    IF customer_arena IS NULL OR customer_arena <> NEW.arena_id THEN
        RAISE EXCEPTION 'Integridade violada: o cliente não pertence à arena informada.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_reservation_tenant ON public.reservations;
CREATE TRIGGER trg_validate_reservation_tenant
BEFORE INSERT OR UPDATE OF arena_id, court_id, customer_id ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.validate_reservation_tenant();


CREATE OR REPLACE FUNCTION public.validate_court_block_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    court_arena UUID;
BEGIN
    SELECT arena_id INTO court_arena
    FROM public.courts
    WHERE id = NEW.court_id;

    IF court_arena IS NULL OR court_arena <> NEW.arena_id THEN
        RAISE EXCEPTION 'Integridade violada: a quadra do bloqueio não pertence à arena informada.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_court_block_tenant ON public.court_blocks;
CREATE TRIGGER trg_validate_court_block_tenant
BEFORE INSERT OR UPDATE OF arena_id, court_id ON public.court_blocks
FOR EACH ROW EXECUTE FUNCTION public.validate_court_block_tenant();


CREATE OR REPLACE FUNCTION public.validate_financial_transaction_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    reservation_arena UUID;
    customer_arena UUID;
    service_arena UUID;
BEGIN
    IF NEW.reservation_id IS NOT NULL THEN
        SELECT arena_id INTO reservation_arena
        FROM public.reservations
        WHERE id = NEW.reservation_id;

        IF reservation_arena IS NULL OR reservation_arena <> NEW.arena_id THEN
            RAISE EXCEPTION 'Integridade violada: a reserva da transação não pertence à arena informada.';
        END IF;
    END IF;

    IF NEW.customer_id IS NOT NULL THEN
        SELECT arena_id INTO customer_arena
        FROM public.customers
        WHERE id = NEW.customer_id;

        IF customer_arena IS NULL OR customer_arena <> NEW.arena_id THEN
            RAISE EXCEPTION 'Integridade violada: o cliente da transação não pertence à arena informada.';
        END IF;
    END IF;

    IF NEW.service_id IS NOT NULL THEN
        SELECT arena_id INTO service_arena
        FROM public.services
        WHERE id = NEW.service_id;

        IF service_arena IS NULL OR service_arena <> NEW.arena_id THEN
            RAISE EXCEPTION 'Integridade violada: o serviço da transação não pertence à arena informada.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_financial_transaction_tenant ON public.financial_transactions;
CREATE TRIGGER trg_validate_financial_transaction_tenant
BEFORE INSERT OR UPDATE OF arena_id, reservation_id, customer_id, service_id
ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_financial_transaction_tenant();


-- Serialize writes per court so two simultaneous reservations cannot both
-- pass the overlap check.
CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.status IN ('CONFIRMED', 'PENDING') THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(NEW.court_id::text, 0));

        IF EXISTS (
            SELECT 1
            FROM public.reservations r
            WHERE r.court_id = NEW.court_id
              AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND r.status IN ('CONFIRMED', 'PENDING')
              AND NEW.start_at < r.end_at
              AND NEW.end_at > r.start_at
        ) THEN
            RAISE EXCEPTION 'Conflito de horário: a quadra já possui uma reserva confirmada ou pendente para este intervalo.';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM public.court_blocks b
            WHERE b.court_id = NEW.court_id
              AND NEW.start_at < b.end_at
              AND NEW.end_at > b.start_at
        ) THEN
            RAISE EXCEPTION 'Conflito de horário: a quadra possui um bloqueio operacional/manutenção programado para este intervalo.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reservation_overlap ON public.reservations;
CREATE TRIGGER trg_prevent_reservation_overlap
BEFORE INSERT OR UPDATE OF court_id, start_at, end_at, status
ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.check_reservation_overlap();


-- Block creation must also be protected at database level.
CREATE OR REPLACE FUNCTION public.check_court_block_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.court_id::text, 0));

    IF EXISTS (
        SELECT 1
        FROM public.reservations r
        WHERE r.court_id = NEW.court_id
          AND r.status IN ('CONFIRMED', 'PENDING')
          AND NEW.start_at < r.end_at
          AND NEW.end_at > r.start_at
    ) THEN
        RAISE EXCEPTION 'Conflito de horário: existem reservas confirmadas ou pendentes neste intervalo.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.court_blocks b
        WHERE b.court_id = NEW.court_id
          AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND NEW.start_at < b.end_at
          AND NEW.end_at > b.start_at
    ) THEN
        RAISE EXCEPTION 'Conflito de horário: já existe um bloqueio para este intervalo.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_court_block_overlap ON public.court_blocks;
CREATE TRIGGER trg_prevent_court_block_overlap
BEFORE INSERT OR UPDATE OF court_id, start_at, end_at
ON public.court_blocks
FOR EACH ROW EXECUTE FUNCTION public.check_court_block_overlap();


-- Secure profile bootstrap: every Auth user gets a CLIENT profile.
-- Elevated roles must be granted by a controlled server-side/onboarding flow.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1), 'Usuário'),
        NULLIF(NEW.raw_user_meta_data->>'phone', ''),
        'CLIENT'::public.user_role
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. ROW LEVEL SECURITY (RLS)

ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'SUPER_ADMIN'::public.user_role
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
        ELSE (
            SELECT au.role
            FROM public.arena_users au
            WHERE au.arena_id = lookup_arena_id
              AND au.user_id = auth.uid()
              AND au.status = 'ACTIVE'::public.entity_status
            LIMIT 1
        )
    END;
$$;

CREATE OR REPLACE FUNCTION public.has_arena_access(lookup_arena_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM public.arena_users au
            WHERE au.arena_id = lookup_arena_id
              AND au.user_id = auth.uid()
              AND au.status = 'ACTIVE'::public.entity_status
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
        OR EXISTS (
            SELECT 1
            FROM public.arena_users au
            WHERE au.arena_id = lookup_arena_id
              AND au.user_id = auth.uid()
              AND au.role = 'ARENA_ADMIN'::public.user_role
              AND au.status = 'ACTIVE'::public.entity_status
        );
$$;

-- Make this section safely re-runnable.
DROP POLICY IF EXISTS "Arenas are viewable by active users or staff" ON public.arenas;
DROP POLICY IF EXISTS "Arenas updateable by super admins and arena admins" ON public.arenas;
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Arena users viewable by arena members" ON public.arena_users;
DROP POLICY IF EXISTS "Arena users manageable by arena admins" ON public.arena_users;
DROP POLICY IF EXISTS "Modalities viewable by everyone" ON public.modalities;
DROP POLICY IF EXISTS "Modalities manageable by arena admins" ON public.modalities;
DROP POLICY IF EXISTS "Courts viewable by everyone" ON public.courts;
DROP POLICY IF EXISTS "Courts manageable by arena admins" ON public.courts;
DROP POLICY IF EXISTS "Customers viewable by arena staff or customer themselves" ON public.customers;
DROP POLICY IF EXISTS "Customers manageable by arena staff" ON public.customers;
DROP POLICY IF EXISTS "Services viewable by everyone" ON public.services;
DROP POLICY IF EXISTS "Services manageable by arena staff/admin" ON public.services;
DROP POLICY IF EXISTS "Reservations viewable by arena staff or reservation owner" ON public.reservations;
DROP POLICY IF EXISTS "Reservations insertable by clients or staff" ON public.reservations;
DROP POLICY IF EXISTS "Reservations manageable by arena staff or client own cancellation" ON public.reservations;
DROP POLICY IF EXISTS "Court blocks viewable by everyone" ON public.court_blocks;
DROP POLICY IF EXISTS "Court blocks manageable by arena staff/admin" ON public.court_blocks;
DROP POLICY IF EXISTS "Financial transactions viewable by arena staff/admin" ON public.financial_transactions;
DROP POLICY IF EXISTS "Financial transactions insertable by arena staff/admin" ON public.financial_transactions;
DROP POLICY IF EXISTS "Financial transactions manageable by arena staff/admin" ON public.financial_transactions;

CREATE POLICY "Arenas are viewable by active users or staff"
ON public.arenas FOR SELECT
USING (status = 'ACTIVE'::public.entity_status OR public.has_arena_access(id));

CREATE POLICY "Arenas updateable by super admins and arena admins"
ON public.arenas FOR UPDATE
USING (public.is_arena_admin(id))
WITH CHECK (public.is_arena_admin(id));

CREATE POLICY "Profiles viewable by authenticated users"
ON public.profiles FOR SELECT
USING (
    auth.uid() = id
    OR public.is_super_admin()
    OR EXISTS (
        SELECT 1
        FROM public.arena_users au
        WHERE au.user_id = profiles.id
          AND public.has_arena_access(au.arena_id)
    )
);

CREATE POLICY "Users can insert own client profile"
ON public.profiles FOR INSERT
WITH CHECK (
    auth.uid() = id
    AND role = 'CLIENT'::public.user_role
);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id
    AND role = (
        SELECT p.role
        FROM public.profiles p
        WHERE p.id = auth.uid()
    )
);

CREATE POLICY "Arena users viewable by arena members"
ON public.arena_users FOR SELECT
USING (public.has_arena_access(arena_id));

CREATE POLICY "Arena users manageable by arena admins"
ON public.arena_users FOR ALL
USING (public.is_arena_admin(arena_id))
WITH CHECK (public.is_arena_admin(arena_id));

CREATE POLICY "Modalities viewable by active portals or arena members"
ON public.modalities FOR SELECT
USING (
    public.has_arena_access(arena_id)
    OR (
        status = 'ACTIVE'::public.entity_status
        AND EXISTS (
            SELECT 1 FROM public.arenas a
            WHERE a.id = modalities.arena_id
              AND a.status = 'ACTIVE'::public.entity_status
        )
    )
);

CREATE POLICY "Modalities manageable by arena admins"
ON public.modalities FOR ALL
USING (public.is_arena_admin(arena_id))
WITH CHECK (public.is_arena_admin(arena_id));

CREATE POLICY "Courts viewable by active portals or arena members"
ON public.courts FOR SELECT
USING (
    public.has_arena_access(arena_id)
    OR (
        status = 'ACTIVE'::public.entity_status
        AND EXISTS (
            SELECT 1 FROM public.arenas a
            WHERE a.id = courts.arena_id
              AND a.status = 'ACTIVE'::public.entity_status
        )
    )
);

CREATE POLICY "Courts manageable by arena admins"
ON public.courts FOR ALL
USING (public.is_arena_admin(arena_id))
WITH CHECK (public.is_arena_admin(arena_id));

CREATE POLICY "Customers viewable by arena staff or customer themselves"
ON public.customers FOR SELECT
USING (public.has_arena_access(arena_id) OR user_id = auth.uid());

CREATE POLICY "Customers manageable by arena staff"
ON public.customers FOR ALL
USING (public.has_arena_access(arena_id))
WITH CHECK (public.has_arena_access(arena_id));

CREATE POLICY "Services viewable by active portals or arena members"
ON public.services FOR SELECT
USING (
    public.has_arena_access(arena_id)
    OR (
        status = 'ACTIVE'::public.entity_status
        AND EXISTS (
            SELECT 1 FROM public.arenas a
            WHERE a.id = services.arena_id
              AND a.status = 'ACTIVE'::public.entity_status
        )
    )
);

CREATE POLICY "Services manageable by arena staff/admin"
ON public.services FOR ALL
USING (public.has_arena_access(arena_id))
WITH CHECK (public.has_arena_access(arena_id));

CREATE POLICY "Reservations viewable by arena staff or reservation owner"
ON public.reservations FOR SELECT
USING (
    public.has_arena_access(arena_id)
    OR customer_id IN (
        SELECT c.id FROM public.customers c
        WHERE c.user_id = auth.uid()
    )
);

CREATE POLICY "Reservations insertable by clients or staff"
ON public.reservations FOR INSERT
WITH CHECK (
    public.has_arena_access(arena_id)
    OR (
        created_by = auth.uid()
        AND customer_id IN (
            SELECT c.id
            FROM public.customers c
            JOIN public.arenas a ON a.id = c.arena_id
            WHERE c.user_id = auth.uid()
              AND c.arena_id = reservations.arena_id
              AND a.status = 'ACTIVE'::public.entity_status
        )
    )
);

CREATE POLICY "Reservations manageable by arena staff or client own cancellation"
ON public.reservations FOR UPDATE
USING (
    public.has_arena_access(arena_id)
    OR (
        customer_id IN (
            SELECT c.id FROM public.customers c
            WHERE c.user_id = auth.uid()
        )
        AND status IN ('PENDING', 'CONFIRMED')
    )
)
WITH CHECK (
    public.has_arena_access(arena_id)
    OR (
        customer_id IN (
            SELECT c.id FROM public.customers c
            WHERE c.user_id = auth.uid()
        )
        AND status IN ('PENDING', 'CONFIRMED', 'CANCELLED')
    )
);

CREATE POLICY "Court blocks viewable by active portals or arena members"
ON public.court_blocks FOR SELECT
USING (
    public.has_arena_access(arena_id)
    OR EXISTS (
        SELECT 1
        FROM public.arenas a
        WHERE a.id = court_blocks.arena_id
          AND a.status = 'ACTIVE'::public.entity_status
    )
);

CREATE POLICY "Court blocks manageable by arena staff/admin"
ON public.court_blocks FOR ALL
USING (public.has_arena_access(arena_id))
WITH CHECK (public.has_arena_access(arena_id));

CREATE POLICY "Financial transactions viewable by arena staff/admin"
ON public.financial_transactions FOR SELECT
USING (public.has_arena_access(arena_id));

CREATE POLICY "Financial transactions insertable by arena staff/admin"
ON public.financial_transactions FOR INSERT
WITH CHECK (public.has_arena_access(arena_id));

CREATE POLICY "Financial transactions manageable by arena staff/admin"
ON public.financial_transactions FOR UPDATE
USING (public.has_arena_access(arena_id))
WITH CHECK (public.has_arena_access(arena_id));

-- 5. SEED DATA (Default Demo Arena)
INSERT INTO public.arenas (id, name, slug, description, phone, whatsapp, email, address, city, state, zip_code, opening_time, closing_time, cancellation_limit_hours, status)
VALUES (
    'a1b2c3d4-0000-0000-0000-000000000001',
    'Arena XP Beach Sports',
    'arena-xp-beach',
    'A melhor e mais completa arena de esportes de areia da região, com quadras cobertas e descobertas.',
    '(11) 98765-4321',
    '(11) 98765-4321',
    'contato@arenaxp.com.br',
    'Av. das Palmeiras, 1500',
    'São Paulo',
    'SP',
    '04578-000',
    '06:00',
    '23:00',
    2,
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modalities (id, arena_id, name, description, icon, status)
VALUES 
('b1b2c3d4-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'Beach Tennis', 'Esporte dinâmico e divertido na areia.', 'Sun', 'ACTIVE'),
('b1b2c3d4-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 'Futevôlei', 'Tradição brasileira de controle de bola na areia.', 'Volleyball', 'ACTIVE'),
('b1b2c3d4-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 'Vôlei de Areia', 'Vôlei de praia 2x2 e 4x4.', 'Trophy', 'ACTIVE'),
('b1b2c3d4-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', 'Futebol Society', 'Campo de grama sintética com iluminação LED.', 'Shield', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.courts (id, arena_id, modality_id, name, description, capacity, price, status)
VALUES 
('c1b2c3d4-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'b1b2c3d4-0000-0000-0000-000000000001', 'Quadra 01 - Areia Central (Coberta)', 'Quadra oficial com areia tratada e iluminação LED profissional.', 4, 90.00, 'ACTIVE'),
('c1b2c3d4-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 'b1b2c3d4-0000-0000-0000-000000000001', 'Quadra 02 - Areia Sunset', 'Quadra aberta ideal para o fim de tarde.', 4, 80.00, 'ACTIVE'),
('c1b2c3d4-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 'b1b2c3d4-0000-0000-0000-000000000002', 'Quadra 03 - Futevôlei Prime', 'Área com rede oficial e duchas laterais.', 4, 80.00, 'ACTIVE'),
('c1b2c3d4-0000-0000-0000-000000000004', 'a1b2c3d4-0000-0000-0000-000000000001', 'b1b2c3d4-0000-0000-0000-000000000004', 'Campo 01 - Society 7x7', 'Grama sintética monofilamento padrão FIFA.', 14, 240.00, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.financial_transactions (id, arena_id, type, category, description, amount, payment_method, transaction_date, status)
VALUES
('f1b2c3d4-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001', 'EXPENSE', 'ENERGY', 'Conta de Energia Elétrica - Iluminação LED', 1250.00, 'PIX', CURRENT_DATE, 'COMPLETED'),
('f1b2c3d4-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000001', 'EXPENSE', 'MAINTENANCE', 'Manutenção e Nivelamento da Areia', 450.00, 'PIX', CURRENT_DATE, 'COMPLETED'),
('f1b2c3d4-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000001', 'EXPENSE', 'EQUIPMENT', 'Reposição de Redes e Fitas de Marcação', 320.00, 'DEBIT_CARD', CURRENT_DATE, 'COMPLETED')
ON CONFLICT (id) DO NOTHING;

