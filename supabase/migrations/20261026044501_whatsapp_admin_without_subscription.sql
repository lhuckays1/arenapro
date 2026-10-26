-- Allow active arena administrators to connect and manage WhatsApp even when the arena subscription period has ended.
-- This exception is scoped to WhatsApp only; the global subscription access helpers remain unchanged.

CREATE OR REPLACE FUNCTION public.is_arena_whatsapp_admin(lookup_arena_id UUID)
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

REVOKE ALL ON FUNCTION public.is_arena_whatsapp_admin(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_arena_whatsapp_admin(UUID) TO authenticated;

DROP POLICY IF EXISTS "Arena admins view WhatsApp connection" ON public.arena_whatsapp_connections;
CREATE POLICY "Arena admins view WhatsApp connection"
  ON public.arena_whatsapp_connections FOR SELECT TO authenticated
  USING (public.is_arena_whatsapp_admin(arena_id));

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
  IF NOT public.is_arena_whatsapp_admin(p_arena_id) THEN
    RAISE EXCEPTION 'Apenas administradores ativos da arena podem conectar o WhatsApp.' USING ERRCODE = '42501';
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
  IF NOT public.is_arena_whatsapp_admin(p_arena_id) THEN
    RAISE EXCEPTION 'Apenas administradores ativos da arena podem alterar a conexão do WhatsApp.' USING ERRCODE = '42501';
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
  IF NOT public.is_arena_whatsapp_admin(p_arena_id) THEN
    RAISE EXCEPTION 'Apenas administradores ativos da arena podem desconectar o WhatsApp.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.arena_whatsapp_connections WHERE arena_id = p_arena_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.is_arena_whatsapp_admin(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_arena_whatsapp_admin(UUID) TO authenticated;
