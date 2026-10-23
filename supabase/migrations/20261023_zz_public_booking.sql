BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_court_availability(p_arena_id uuid,p_date date DEFAULT NULL)
RETURNS TABLE(court_id uuid,start_at timestamptz,end_at timestamptz,status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT r.court_id,r.start_at,r.end_at,r.status::text FROM public.reservations r
  JOIN public.arenas a ON a.id=r.arena_id AND a.status='ACTIVE'
  JOIN public.courts c ON c.id=r.court_id AND c.arena_id=r.arena_id AND c.status='ACTIVE'
  WHERE r.arena_id=p_arena_id AND r.status IN ('PENDING','CONFIRMED') AND
    (p_date IS NULL OR (r.end_at>(p_date::timestamp AT TIME ZONE 'America/Sao_Paulo') AND r.start_at<((p_date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')));
$$;
REVOKE ALL ON FUNCTION public.get_public_court_availability(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_court_availability(uuid,date) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.reserve_public_court(p_arena_id uuid,p_court_id uuid,p_start_at timestamptz,p_end_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE arena_row public.arenas%ROWTYPE; court_row public.courts%ROWTYPE; profile_row public.profiles%ROWTYPE;
  customer_id_value uuid; reservation_row public.reservations%ROWTYPE; local_start timestamp; local_end timestamp;
  opening timestamp; closing timestamp;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para reservar.'; END IF;
  SELECT * INTO arena_row FROM public.arenas WHERE id=p_arena_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Arena indisponível.'; END IF;
  SELECT * INTO court_row FROM public.courts WHERE id=p_court_id AND arena_id=p_arena_id AND status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quadra indisponível.'; END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR NOT isfinite(p_start_at) OR NOT isfinite(p_end_at) OR p_start_at<=now() OR p_end_at-p_start_at<>interval '1 hour' THEN RAISE EXCEPTION 'Selecione uma hora futura válida.'; END IF;
  local_start:=p_start_at AT TIME ZONE 'America/Sao_Paulo'; local_end:=p_end_at AT TIME ZONE 'America/Sao_Paulo';
  opening:=local_start::date+arena_row.opening_time::time; closing:=local_start::date+arena_row.closing_time::time;
  IF closing<=opening THEN closing:=closing+interval '1 day'; END IF;
  IF local_start<opening OR local_end>closing THEN RAISE EXCEPTION 'Horário fora do funcionamento da arena.'; END IF;
  SELECT * INTO profile_row FROM public.profiles WHERE id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_arena_id::text||':'||auth.uid()::text,0));
  SELECT id INTO customer_id_value FROM public.customers WHERE arena_id=p_arena_id AND user_id=auth.uid() ORDER BY created_at LIMIT 1;
  IF customer_id_value IS NULL THEN
    INSERT INTO public.customers(arena_id,user_id,full_name,phone,email,status)
    VALUES(p_arena_id,auth.uid(),profile_row.full_name,coalesce(nullif(profile_row.phone,''),'Não informado'),
      (SELECT email FROM auth.users WHERE id=auth.uid()),'ACTIVE') RETURNING id INTO customer_id_value;
  END IF;
  INSERT INTO public.reservations(arena_id,court_id,customer_id,start_at,end_at,status,amount,payment_status,created_by,notes)
  VALUES(p_arena_id,p_court_id,customer_id_value,p_start_at,p_end_at,'CONFIRMED',court_row.price,'PENDING',auth.uid(),'Reserva realizada via Portal do Cliente Online.') RETURNING * INTO reservation_row;
  RETURN to_jsonb(reservation_row);
END $$;
REVOKE ALL ON FUNCTION public.reserve_public_court(uuid,uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_public_court(uuid,uuid,timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_client_reservation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE limit_hours integer;
BEGIN
  IF current_user NOT IN ('authenticated','anon') OR public.has_arena_operational_access(NEW.arena_id) THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Use o portal de reserva para validar preço e horário.'; END IF;
  IF NEW.status<>'CANCELLED' OR OLD.status NOT IN ('PENDING','CONFIRMED') OR
    (to_jsonb(NEW)-ARRAY['status','notes','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','notes','updated_at']) THEN RAISE EXCEPTION 'Cliente pode somente cancelar sua própria reserva.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customers WHERE id=OLD.customer_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Reserva de outro cliente.'; END IF;
  SELECT cancellation_limit_hours INTO limit_hours FROM public.arenas WHERE id=OLD.arena_id;
  IF OLD.start_at-now()<make_interval(hours=>coalesce(limit_hours,2)) THEN RAISE EXCEPTION 'Cancelamento fora do prazo permitido.'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS client_reservation_guard ON public.reservations;
CREATE TRIGGER client_reservation_guard BEFORE INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_client_reservation();

COMMIT;
