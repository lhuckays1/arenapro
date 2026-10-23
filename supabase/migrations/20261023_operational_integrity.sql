BEGIN;

ALTER TABLE public.arenas ADD COLUMN IF NOT EXISTS latitude double precision, ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE OR REPLACE FUNCTION public.has_arena_operational_access(lookup_arena_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.arena_users au WHERE au.arena_id = lookup_arena_id
    AND au.user_id = auth.uid() AND au.status = 'ACTIVE' AND au.role IN ('ARENA_ADMIN','ARENA_STAFF')
  ));
$$;

CREATE OR REPLACE FUNCTION public.is_arena_operational_admin(lookup_arena_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.arena_users au WHERE au.arena_id = lookup_arena_id
    AND au.user_id = auth.uid() AND au.status = 'ACTIVE' AND au.role = 'ARENA_ADMIN'
  ));
$$;

REVOKE ALL ON FUNCTION public.has_arena_operational_access(uuid), public.is_arena_operational_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_arena_operational_access(uuid), public.is_arena_operational_admin(uuid) TO anon, authenticated;

DO $$
DECLARE policy_row record; command text;
BEGIN
  FOR policy_row IN SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename IN (
    'arenas','profiles','arena_users','modalities','courts','customers','services','reservations','court_blocks','financial_transactions'
  ) LOOP
    IF coalesce(policy_row.qual,'') || coalesce(policy_row.with_check,'') NOT LIKE '%has_arena_access%'
       AND coalesce(policy_row.qual,'') || coalesce(policy_row.with_check,'') NOT LIKE '%is_arena_admin%' THEN CONTINUE; END IF;
    command := format('ALTER POLICY %I ON public.%I', policy_row.policyname, policy_row.tablename);
    IF policy_row.qual IS NOT NULL THEN
      command := command || ' USING (' || replace(replace(policy_row.qual,'has_arena_access(', 'has_arena_operational_access('),'is_arena_admin(', 'is_arena_operational_admin(') || ')';
    END IF;
    IF policy_row.with_check IS NOT NULL THEN
      command := command || ' WITH CHECK (' || replace(replace(policy_row.with_check,'has_arena_access(', 'has_arena_operational_access('),'is_arena_admin(', 'is_arena_operational_admin(') || ')';
    END IF;
    EXECUTE command;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  full_name text NOT NULL, phone text, email text, cpf text, modality_id uuid REFERENCES public.modalities(id),
  status public.entity_status NOT NULL DEFAULT 'ACTIVE', notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  full_name text NOT NULL, phone text, email text, birth_date date,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE', notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.teacher_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  start_date date NOT NULL, end_date date, status public.entity_status NOT NULL DEFAULT 'ACTIVE', notes text,
  duration_value integer, duration_unit varchar(10), monthly_amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_students ADD COLUMN IF NOT EXISTS duration_value integer,
  ADD COLUMN IF NOT EXISTS duration_unit varchar(10), ADD COLUMN IF NOT EXISTS monthly_amount numeric(12,2);
CREATE TABLE IF NOT EXISTS public.student_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), arena_id uuid NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  reference_month date NOT NULL, due_date date NOT NULL, amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','OVERDUE','PAID','CANCELLED')),
  paid_at timestamptz, payment_method public.payment_method,
  financial_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE RESTRICT, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.teacher_students WHERE status = 'ACTIVE' GROUP BY arena_id,student_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Há alunos com mais de um vínculo ativo. Revise os vínculos antes de aplicar; nenhum dado foi alterado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.student_payments GROUP BY arena_id,student_id,teacher_id,date_trunc('month',reference_month::timestamp) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Há mensalidades duplicadas por competência. Revise antes de aplicar; nenhum dado foi alterado.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_active_enrollment ON public.teacher_students(arena_id, student_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_payment_competence ON public.student_payments(arena_id, student_id, teacher_id, (date_trunc('month',reference_month::timestamp)));

DO $$
DECLARE table_name text; policy_row record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['teachers','students','teacher_students','student_payments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=table_name LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_row.policyname,table_name);
    END LOOP;
    EXECUTE format('CREATE POLICY operational_admin ON public.%I FOR ALL TO authenticated USING (public.is_arena_operational_admin(arena_id)) WITH CHECK (public.is_arena_operational_admin(arena_id))',table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.validate_academy_tenant()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF TG_TABLE_NAME='student_payments' AND (OLD.status='PAID' OR OLD.financial_transaction_id IS NOT NULL) THEN RAISE EXCEPTION 'Mensalidade paga não pode ser excluída.'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.arena_id <> OLD.arena_id THEN RAISE EXCEPTION 'Não é permitido transferir cadastro entre arenas.'; END IF;
  IF TG_TABLE_NAME = 'teachers' THEN
    IF NEW.modality_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.modalities WHERE id=NEW.modality_id AND arena_id=NEW.arena_id) THEN RAISE EXCEPTION 'Modalidade de outra arena.'; END IF;
  ELSIF TG_TABLE_NAME IN ('teacher_students','student_payments') THEN
    IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id=NEW.teacher_id AND arena_id=NEW.arena_id)
      OR NOT EXISTS (SELECT 1 FROM public.students WHERE id=NEW.student_id AND arena_id=NEW.arena_id) THEN RAISE EXCEPTION 'Aluno e professor devem pertencer à arena.'; END IF;
    IF TG_TABLE_NAME = 'student_payments' THEN
      IF TG_OP = 'UPDATE' AND OLD.status = 'PAID' THEN RAISE EXCEPTION 'Mensalidade paga não pode ser editada.'; END IF;
      IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Valor mensal inválido.'; END IF;
      IF current_user IN ('authenticated','anon') AND (NEW.status = 'PAID' OR NEW.financial_transaction_id IS NOT NULL OR NEW.paid_at IS NOT NULL) THEN RAISE EXCEPTION 'Use o recebimento de mensalidade para registrar o pagamento.'; END IF;
      IF TG_OP='INSERT' AND NOT EXISTS (SELECT 1 FROM public.teacher_students WHERE arena_id=NEW.arena_id AND student_id=NEW.student_id AND teacher_id=NEW.teacher_id AND status='ACTIVE') THEN RAISE EXCEPTION 'O aluno precisa de vínculo ativo com o professor.'; END IF;
      NEW.reference_month := date_trunc('month',NEW.reference_month::timestamp)::date;
    ELSE
      IF NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN RAISE EXCEPTION 'Término anterior ao início.'; END IF;
      IF NEW.duration_value IS NOT NULL AND (NEW.duration_value NOT BETWEEN 1 AND 120 OR NEW.duration_unit NOT IN ('MONTHS','WEEKS') OR NEW.duration_unit IS NULL) THEN RAISE EXCEPTION 'Duração inválida.'; END IF;
      IF NEW.monthly_amount IS NOT NULL AND (NEW.monthly_amount <= 0 OR NEW.monthly_amount::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Valor mensal inválido.'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS academy_tenant ON public.teachers;
CREATE TRIGGER academy_tenant BEFORE INSERT OR UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.validate_academy_tenant();
DROP TRIGGER IF EXISTS academy_tenant ON public.students;
CREATE TRIGGER academy_tenant BEFORE INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.validate_academy_tenant();
DROP TRIGGER IF EXISTS academy_tenant ON public.teacher_students;
CREATE TRIGGER academy_tenant BEFORE INSERT OR UPDATE ON public.teacher_students FOR EACH ROW EXECUTE FUNCTION public.validate_academy_tenant();
DROP TRIGGER IF EXISTS academy_tenant ON public.student_payments;
CREATE TRIGGER academy_tenant BEFORE INSERT OR UPDATE OR DELETE ON public.student_payments FOR EACH ROW EXECUTE FUNCTION public.validate_academy_tenant();

CREATE OR REPLACE FUNCTION public.generate_student_enrollment_payments(
  p_arena_id uuid, p_reference_month date, p_due_day integer, p_teacher_id uuid DEFAULT NULL,
  p_student_ids uuid[] DEFAULT NULL, p_default_amount numeric DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE enrollment record; month_cursor date; last_month date; target_end date; charge numeric; inserted_count integer;
  created_count integer := 0; skipped_count integer := 0;
BEGIN
  IF NOT public.is_arena_operational_admin(p_arena_id) THEN RAISE EXCEPTION 'Sem permissão para esta arena.'; END IF;
  IF p_reference_month IS NULL OR p_due_day IS NULL OR p_due_day NOT BETWEEN 1 AND 28 THEN RAISE EXCEPTION 'Informe competência e vencimento entre 1 e 28.'; END IF;
  FOR enrollment IN SELECT ts.* FROM public.teacher_students ts
    JOIN public.students s ON s.id=ts.student_id AND s.arena_id=ts.arena_id AND s.status='ACTIVE'
    JOIN public.teachers t ON t.id=ts.teacher_id AND t.arena_id=ts.arena_id AND t.status='ACTIVE'
    WHERE ts.arena_id=p_arena_id AND ts.status='ACTIVE' AND (p_teacher_id IS NULL OR ts.teacher_id=p_teacher_id)
      AND (p_student_ids IS NULL OR ts.student_id=ANY(p_student_ids)) ORDER BY ts.id FOR UPDATE OF ts
  LOOP
    IF enrollment.duration_value IS NULL OR enrollment.duration_unit IS NULL THEN RAISE EXCEPTION 'Configure a duração do vínculo antes de gerar mensalidades.'; END IF;
    charge := coalesce(enrollment.monthly_amount,p_default_amount);
    IF charge IS NULL OR charge <= 0 OR charge::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Informe o valor mensal contratado.'; END IF;
    target_end := coalesce(enrollment.end_date, CASE WHEN enrollment.duration_unit='MONTHS'
      THEN (enrollment.start_date + make_interval(months=>enrollment.duration_value) - interval '1 day')::date
      ELSE enrollment.start_date + enrollment.duration_value*7 - 1 END);
    month_cursor := greatest(date_trunc('month',enrollment.start_date::timestamp)::date,date_trunc('month',p_reference_month::timestamp)::date);
    last_month := date_trunc('month',target_end::timestamp)::date;
    IF enrollment.duration_unit='MONTHS' THEN last_month := least(last_month,(date_trunc('month',enrollment.start_date::timestamp)+make_interval(months=>enrollment.duration_value-1))::date); END IF;
    WHILE month_cursor <= last_month LOOP
      INSERT INTO public.student_payments(arena_id,teacher_id,student_id,reference_month,due_date,amount,status,notes)
      VALUES(p_arena_id,enrollment.teacher_id,enrollment.student_id,month_cursor,greatest(month_cursor+p_due_day-1,enrollment.start_date),round(charge,2),'PENDING',p_notes)
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS inserted_count = ROW_COUNT;
      created_count := created_count + inserted_count; skipped_count := skipped_count + 1 - inserted_count;
      month_cursor := (month_cursor+interval '1 month')::date;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('created',created_count,'skipped',skipped_count,'failed',0,'errors','[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.save_student_enrollment(
  p_arena_id uuid, p_student_id uuid, p_student jsonb, p_enrollment jsonb,
  p_generate_payments boolean DEFAULT false, p_due_day integer DEFAULT 10
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
<<enrollment_save>>
DECLARE student_row public.students%ROWTYPE; teacher_id_value uuid; start_date_value date; end_date_value date;
  duration_value integer; duration_unit text; amount_value numeric; previous_link uuid;
BEGIN
  IF NOT public.is_arena_operational_admin(p_arena_id) THEN RAISE EXCEPTION 'Sem permissão para gerenciar alunos nesta arena.'; END IF;
  IF nullif(btrim(p_student->>'full_name'),'') IS NULL THEN RAISE EXCEPTION 'Nome do aluno obrigatório.'; END IF;
  IF p_student_id IS NOT NULL THEN
    SELECT * INTO student_row FROM public.students WHERE id=p_student_id AND arena_id=p_arena_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Aluno não encontrado nesta arena.'; END IF;
    UPDATE public.students SET full_name=btrim(p_student->>'full_name'), phone=nullif(p_student->>'phone',''),
      email=nullif(p_student->>'email',''), birth_date=nullif(p_student->>'birth_date','')::date,
      status=coalesce((p_student->>'status')::public.entity_status,'ACTIVE'),notes=p_student->>'notes',updated_at=now()
      WHERE id=p_student_id RETURNING * INTO student_row;
  ELSE
    INSERT INTO public.students(arena_id,full_name,phone,email,birth_date,status,notes)
    VALUES(p_arena_id,btrim(p_student->>'full_name'),nullif(p_student->>'phone',''),nullif(p_student->>'email',''),
      nullif(p_student->>'birth_date','')::date,coalesce((p_student->>'status')::public.entity_status,'ACTIVE'),p_student->>'notes') RETURNING * INTO student_row;
  END IF;
  IF p_enrollment IS NOT NULL AND p_enrollment <> 'null'::jsonb THEN
    teacher_id_value := (p_enrollment->>'teacher_id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.teachers WHERE id=teacher_id_value AND arena_id=p_arena_id AND status='ACTIVE') THEN RAISE EXCEPTION 'Professor ativo não encontrado nesta arena.'; END IF;
    start_date_value := (p_enrollment->>'start_date')::date; duration_value := (p_enrollment->>'duration_value')::integer;
    duration_unit := p_enrollment->>'duration_unit'; amount_value := (p_enrollment->>'monthly_amount')::numeric;
    IF start_date_value IS NULL OR duration_value IS NULL OR duration_value NOT BETWEEN 1 AND 120 OR duration_unit IS NULL OR duration_unit NOT IN ('MONTHS','WEEKS')
      OR amount_value IS NULL OR amount_value<=0 OR amount_value::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Início, duração e valor mensal válidos são obrigatórios.'; END IF;
    end_date_value := CASE WHEN duration_unit='MONTHS' THEN (start_date_value+make_interval(months=>duration_value)-interval '1 day')::date ELSE start_date_value+duration_value*7-1 END;
    SELECT id INTO previous_link FROM public.teacher_students WHERE arena_id=p_arena_id AND student_id=student_row.id AND teacher_id=teacher_id_value ORDER BY created_at DESC LIMIT 1;
    UPDATE public.teacher_students SET status='INACTIVE',updated_at=now() WHERE arena_id=p_arena_id AND student_id=student_row.id AND status='ACTIVE' AND id IS DISTINCT FROM previous_link;
    IF previous_link IS NULL THEN
      INSERT INTO public.teacher_students(arena_id,teacher_id,student_id,start_date,end_date,status,duration_value,duration_unit,monthly_amount)
      VALUES(p_arena_id,teacher_id_value,student_row.id,start_date_value,end_date_value,'ACTIVE',duration_value,duration_unit,amount_value);
    ELSE
      UPDATE public.teacher_students SET start_date=start_date_value,end_date=end_date_value,status='ACTIVE',
        duration_value=enrollment_save.duration_value,duration_unit=enrollment_save.duration_unit,monthly_amount=amount_value,updated_at=now() WHERE id=previous_link;
    END IF;
    IF p_generate_payments THEN
      IF student_row.status<>'ACTIVE' THEN RAISE EXCEPTION 'Ative o aluno antes de gerar mensalidades.'; END IF;
      PERFORM public.generate_student_enrollment_payments(p_arena_id,start_date_value,p_due_day,teacher_id_value,ARRAY[student_row.id],NULL,NULL);
    END IF;
  ELSE
    UPDATE public.teacher_students SET status='INACTIVE',updated_at=now() WHERE arena_id=p_arena_id AND student_id=student_row.id AND status='ACTIVE';
  END IF;
  RETURN to_jsonb(student_row);
END $$;

CREATE OR REPLACE FUNCTION public.receive_student_payment(p_payment_id uuid, p_payment_method public.payment_method, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE payment public.student_payments%ROWTYPE; transaction_id uuid;
BEGIN
  SELECT * INTO payment FROM public.student_payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_arena_operational_admin(payment.arena_id) THEN RAISE EXCEPTION 'Mensalidade não encontrada ou sem permissão.'; END IF;
  IF payment.status='PAID' AND payment.financial_transaction_id IS NOT NULL THEN RETURN to_jsonb(payment); END IF;
  IF payment.status NOT IN ('PENDING','OVERDUE') OR p_payment_method IS NULL THEN RAISE EXCEPTION 'Mensalidade não pode ser recebida.'; END IF;
  INSERT INTO public.financial_transactions(arena_id,type,category,description,amount,payment_method,transaction_date,status,notes,created_by)
  VALUES(payment.arena_id,'INCOME','SERVICE','Mensalidade - ' || (SELECT full_name FROM public.students WHERE id=payment.student_id),payment.amount,p_payment_method,(now() AT TIME ZONE 'America/Sao_Paulo')::date,'COMPLETED',p_notes,auth.uid()) RETURNING id INTO transaction_id;
  UPDATE public.student_payments SET status='PAID',paid_at=now(),payment_method=p_payment_method,financial_transaction_id=transaction_id,notes=coalesce(p_notes,notes),updated_at=now() WHERE id=payment.id RETURNING * INTO payment;
  RETURN to_jsonb(payment);
END $$;

REVOKE ALL ON FUNCTION public.generate_student_enrollment_payments(uuid,date,integer,uuid,uuid[],numeric,text), public.save_student_enrollment(uuid,uuid,jsonb,jsonb,boolean,integer), public.receive_student_payment(uuid,public.payment_method,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_student_enrollment_payments(uuid,date,integer,uuid,uuid[],numeric,text), public.save_student_enrollment(uuid,uuid,jsonb,jsonb,boolean,integer), public.receive_student_payment(uuid,public.payment_method,text) TO authenticated;

COMMIT;
