-- ArenaPro — duração do vínculo aluno/professor
-- Executar no Supabase antes de usar os novos campos de matrícula.

ALTER TABLE public.teacher_students
  ADD COLUMN IF NOT EXISTS duration_value INTEGER,
  ADD COLUMN IF NOT EXISTS duration_unit VARCHAR(10),
  ADD COLUMN IF NOT EXISTS monthly_amount NUMERIC(12,2);

ALTER TABLE public.teacher_students
  DROP CONSTRAINT IF EXISTS teacher_students_duration_value_check;

ALTER TABLE public.teacher_students
  ADD CONSTRAINT teacher_students_duration_value_check
  CHECK (duration_value IS NULL OR duration_value > 0);

ALTER TABLE public.teacher_students
  DROP CONSTRAINT IF EXISTS teacher_students_duration_unit_check;

ALTER TABLE public.teacher_students
  ADD CONSTRAINT teacher_students_duration_unit_check
  CHECK (duration_unit IS NULL OR duration_unit IN ('MONTHS', 'WEEKS'));

ALTER TABLE public.teacher_students
  DROP CONSTRAINT IF EXISTS teacher_students_monthly_amount_check;

ALTER TABLE public.teacher_students
  ADD CONSTRAINT teacher_students_monthly_amount_check
  CHECK (monthly_amount IS NULL OR monthly_amount > 0);

COMMENT ON COLUMN public.teacher_students.duration_value IS 'Quantidade contratada para as aulas do aluno.';
COMMENT ON COLUMN public.teacher_students.duration_unit IS 'Unidade da duração: MONTHS ou WEEKS.';
COMMENT ON COLUMN public.teacher_students.monthly_amount IS 'Valor mensal contratado para o vínculo aluno/professor.';
