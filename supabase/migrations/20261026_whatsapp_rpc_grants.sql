-- Supabase grants function EXECUTE to anon, authenticated, and service_role by default.
-- Admin RPCs require a signed-in arena admin. Agent RPCs are called server-side
-- through the Vercel API with a per-arena high-entropy token hash.
REVOKE EXECUTE ON FUNCTION public.register_arena_whatsapp_connection(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_arena_whatsapp_connection(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.remove_arena_whatsapp_connection(UUID) FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.whatsapp_authorize_instance(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.whatsapp_set_connection_status(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.whatsapp_get_availability(TEXT, TEXT, DATE) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.whatsapp_create_booking_offer(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.whatsapp_confirm_booking(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.register_arena_whatsapp_connection(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_arena_whatsapp_connection(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_arena_whatsapp_connection(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.whatsapp_authorize_instance(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_set_connection_status(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_get_availability(TEXT, TEXT, DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_create_booking_offer(TEXT, TEXT, TEXT, TEXT, UUID, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_confirm_booking(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
