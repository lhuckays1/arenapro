BEGIN READ ONLY;

SELECT n.nspname AS schema_name,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' AND
  (p.proname IN ('has_arena_access','has_arena_operational_access','is_arena_admin','get_user_arena_role','register_bar_tab_payment',
    'get_public_court_availability','save_student_enrollment','generate_student_enrollment_payments',
    'receive_student_payment','receive_reservation_payment','reserve_public_court','void_operational_transaction')
   OR p.prosrc ILIKE '%has_arena_access%') ORDER BY p.proname,arguments;

SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default
FROM information_schema.columns WHERE table_schema='public' AND table_name IN
  ('arenas','arena_users','teachers','students','teacher_students','student_payments','reservations','financial_transactions',
   'bar_products','bar_tabs','bar_tab_items','bar_tab_payments') ORDER BY table_name,ordinal_position;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname;

SELECT c.relname AS table_name,t.tgname,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;

SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated') ORDER BY table_name,grantee,privilege_type;

ROLLBACK;
