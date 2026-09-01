-- ArenaPro: secure owner onboarding helper.
-- The application should call this only after authenticated signup.
-- It promotes the authenticated user to ARENA_ADMIN only for the arena being created.
CREATE OR REPLACE FUNCTION public.create_arena_for_current_user(
    p_name TEXT,
    p_slug TEXT,
    p_description TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_whatsapp TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_arena_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    INSERT INTO public.arenas (
        name, slug, description, phone, whatsapp
    )
    VALUES (
        p_name, p_slug, p_description, p_phone, p_whatsapp
    )
    RETURNING id INTO v_arena_id;

    INSERT INTO public.arena_users (arena_id, user_id, role, status)
    VALUES (
        v_arena_id,
        auth.uid(),
        'ARENA_ADMIN'::public.user_role,
        'ACTIVE'::public.entity_status
    );

    UPDATE public.profiles
    SET role = 'ARENA_ADMIN'::public.user_role,
        updated_at = now()
    WHERE id = auth.uid();

    RETURN v_arena_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_arena_for_current_user(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_arena_for_current_user(TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
