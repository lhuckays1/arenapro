BEGIN;

CREATE TABLE IF NOT EXISTS public.operational_payment_requests (
  request_key uuid PRIMARY KEY, arena_id uuid NOT NULL REFERENCES public.arenas(id),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id), amount numeric(12,2) NOT NULL,
  payment_method public.payment_method NOT NULL, transaction_date date NOT NULL, notes text,
  financial_transaction_id uuid NOT NULL REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operational_payment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operational_receipts ON public.operational_payment_requests;
CREATE POLICY operational_receipts ON public.operational_payment_requests FOR SELECT TO authenticated USING(public.has_arena_operational_access(arena_id));
REVOKE ALL ON public.operational_payment_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.operational_payment_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.receive_reservation_payment(
  p_reservation_id uuid, p_amount numeric, p_payment_method public.payment_method, p_request_key uuid,
  p_transaction_date date DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE reservation public.reservations%ROWTYPE; receipt public.operational_payment_requests%ROWTYPE;
  transaction_row public.financial_transactions%ROWTYPE; total_paid numeric; payment_date date;
BEGIN
  SELECT * INTO reservation FROM public.reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_arena_operational_access(reservation.arena_id) THEN RAISE EXCEPTION 'Reserva não encontrada ou sem permissão.'; END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount<>round(p_amount,2)
    OR p_request_key IS NULL OR p_payment_method IS NULL THEN RAISE EXCEPTION 'Informe valor válido em centavos, método e chave da requisição.'; END IF;
  payment_date := coalesce(p_transaction_date,(now() AT TIME ZONE 'America/Sao_Paulo')::date);
  SELECT * INTO receipt FROM public.operational_payment_requests WHERE request_key=p_request_key;
  IF FOUND THEN
    IF receipt.reservation_id<>reservation.id OR receipt.arena_id<>reservation.arena_id OR receipt.amount<>p_amount
      OR receipt.payment_method<>p_payment_method OR receipt.transaction_date<>payment_date OR receipt.notes IS DISTINCT FROM p_notes THEN RAISE EXCEPTION 'Chave de pagamento já utilizada para outra operação.'; END IF;
    SELECT * INTO transaction_row FROM public.financial_transactions WHERE id=receipt.financial_transaction_id;
    RETURN jsonb_build_object('transaction',to_jsonb(transaction_row),'reservation',to_jsonb(reservation));
  END IF;
  IF reservation.status NOT IN ('PENDING','CONFIRMED','COMPLETED','NO_SHOW') THEN RAISE EXCEPTION 'Reserva cancelada não pode receber pagamento.'; END IF;
  SELECT coalesce(sum(amount),0) INTO total_paid FROM public.financial_transactions WHERE reservation_id=reservation.id AND type='INCOME' AND status='COMPLETED';
  IF p_amount>reservation.amount-total_paid THEN RAISE EXCEPTION 'O pagamento excede o saldo da reserva.'; END IF;
  INSERT INTO public.financial_transactions(arena_id,type,category,description,amount,payment_method,transaction_date,reservation_id,customer_id,status,notes,created_by)
  VALUES(reservation.arena_id,'INCOME','RESERVATION','Pagamento Reserva - ' || (SELECT full_name FROM public.customers WHERE id=reservation.customer_id),p_amount,p_payment_method,payment_date,reservation.id,reservation.customer_id,'COMPLETED',p_notes,auth.uid()) RETURNING * INTO transaction_row;
  INSERT INTO public.operational_payment_requests(request_key,arena_id,reservation_id,amount,payment_method,transaction_date,notes,financial_transaction_id)
  VALUES(p_request_key,reservation.arena_id,reservation.id,p_amount,p_payment_method,payment_date,p_notes,transaction_row.id);
  UPDATE public.reservations SET payment_status=CASE WHEN total_paid+p_amount>=amount THEN 'PAID'::public.payment_status ELSE 'PARTIAL'::public.payment_status END,
    payment_method=p_payment_method,updated_at=now() WHERE id=reservation.id RETURNING * INTO reservation;
  RETURN jsonb_build_object('transaction',to_jsonb(transaction_row),'reservation',to_jsonb(reservation));
END $$;

CREATE OR REPLACE FUNCTION public.guard_bar_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tab_row public.bar_tabs%ROWTYPE; product_row public.bar_products%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='bar_tabs' THEN
    IF TG_OP='DELETE' THEN
      IF OLD.paid_amount>0 OR EXISTS(SELECT 1 FROM public.bar_tab_payments WHERE tab_id=OLD.id) OR OLD.status<>'OPEN' THEN RAISE EXCEPTION 'Comanda com histórico não pode ser excluída.'; END IF;
      RETURN OLD;
    END IF;
    IF TG_OP='UPDATE' AND NEW.arena_id<>OLD.arena_id THEN RAISE EXCEPTION 'Não é permitido transferir comanda entre arenas.'; END IF;
    IF NEW.customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.customers WHERE id=NEW.customer_id AND arena_id=NEW.arena_id) THEN RAISE EXCEPTION 'Cliente de outra arena.'; END IF;
    IF NEW.court_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.courts WHERE id=NEW.court_id AND arena_id=NEW.arena_id) THEN RAISE EXCEPTION 'Quadra de outra arena.'; END IF;
    IF NEW.reservation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.reservations WHERE id=NEW.reservation_id AND arena_id=NEW.arena_id AND (NEW.court_id IS NULL OR court_id=NEW.court_id)) THEN RAISE EXCEPTION 'Reserva ou quadra incompatível com a comanda.'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO tab_row FROM public.bar_tabs WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.tab_id ELSE NEW.tab_id END FOR UPDATE;
  IF NOT FOUND THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Comanda não encontrada.';
  END IF;
  IF tab_row.status<>'OPEN' OR NOT public.has_arena_operational_access(tab_row.arena_id) THEN RAISE EXCEPTION 'Comanda encerrada ou sem permissão.'; END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.arena_id<>tab_row.arena_id THEN RAISE EXCEPTION 'Item de outra arena.'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.arena_id<>tab_row.arena_id THEN RAISE EXCEPTION 'Item e comanda devem pertencer à mesma arena.'; END IF;
  IF TG_OP='UPDATE' AND (NEW.tab_id<>OLD.tab_id OR NEW.arena_id<>OLD.arena_id OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.unit_price<>OLD.unit_price OR NEW.product_name<>OLD.product_name) THEN RAISE EXCEPTION 'Não é permitido mover ou reprecificar item lançado.'; END IF;
  IF TG_OP='INSERT' THEN
    SELECT * INTO product_row FROM public.bar_products WHERE id=NEW.product_id AND arena_id=NEW.arena_id AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto ativo não encontrado nesta arena.'; END IF;
    NEW.product_name:=product_row.name; NEW.unit_price:=product_row.price;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bar_integrity ON public.bar_tabs;
CREATE TRIGGER bar_integrity BEFORE INSERT OR UPDATE OR DELETE ON public.bar_tabs FOR EACH ROW EXECUTE FUNCTION public.guard_bar_integrity();
DROP TRIGGER IF EXISTS bar_integrity ON public.bar_tab_items;
CREATE TRIGGER bar_integrity BEFORE INSERT OR UPDATE OR DELETE ON public.bar_tab_items FOR EACH ROW EXECUTE FUNCTION public.guard_bar_integrity();

DO $$
DECLARE table_name text; policy_row record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['bar_products','bar_tabs','bar_tab_items','bar_tab_payments'] LOOP
    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=table_name LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',policy_row.policyname,table_name);
    END LOOP;
    EXECUTE format('CREATE POLICY operational_read ON public.%I FOR SELECT TO authenticated USING (public.has_arena_operational_access(arena_id))',table_name);
  END LOOP;
END $$;
CREATE POLICY operational_products ON public.bar_products FOR ALL TO authenticated USING(public.has_arena_operational_access(arena_id)) WITH CHECK(public.has_arena_operational_access(arena_id));
CREATE POLICY operational_tab_insert ON public.bar_tabs FOR INSERT TO authenticated WITH CHECK(public.has_arena_operational_access(arena_id) AND status='OPEN' AND paid_amount=0 AND total_amount=0);
CREATE POLICY operational_tab_delete ON public.bar_tabs FOR DELETE TO authenticated USING(public.has_arena_operational_access(arena_id) AND status='OPEN' AND paid_amount=0);
CREATE POLICY operational_item_write ON public.bar_tab_items FOR ALL TO authenticated USING(public.has_arena_operational_access(arena_id)) WITH CHECK(public.has_arena_operational_access(arena_id));
REVOKE INSERT,UPDATE,DELETE ON public.bar_tab_payments FROM PUBLIC,anon,authenticated;
REVOKE UPDATE ON public.bar_tabs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bar_products, public.bar_tab_items TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.bar_tabs TO authenticated;
GRANT SELECT ON public.bar_tab_payments TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.bar_tabs_tab_number_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.register_bar_tab_payment(p_tab_id uuid,p_amount numeric,p_payment_method public.payment_method,p_request_key uuid,p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tab_row public.bar_tabs%ROWTYPE; existing public.bar_tab_payments%ROWTYPE;
  payment_id uuid; transaction_id uuid; new_paid numeric;
BEGIN
  SELECT * INTO tab_row FROM public.bar_tabs WHERE id=p_tab_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_arena_operational_access(tab_row.arena_id) THEN RAISE EXCEPTION 'Comanda não encontrada ou sem permissão.'; END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount<>round(p_amount,2) OR p_request_key IS NULL OR p_payment_method IS NULL THEN RAISE EXCEPTION 'Informe valor em centavos, método e chave válidos.'; END IF;
  SELECT * INTO existing FROM public.bar_tab_payments WHERE arena_id=tab_row.arena_id AND request_key=p_request_key;
  IF FOUND THEN
    IF existing.tab_id<>tab_row.id OR existing.amount<>p_amount OR existing.payment_method<>p_payment_method OR existing.notes IS DISTINCT FROM p_notes THEN RAISE EXCEPTION 'Chave já utilizada para outro pagamento.'; END IF;
    RETURN jsonb_build_object('payment_id',existing.id,'financial_transaction_id',existing.financial_transaction_id,'duplicate',true);
  END IF;
  IF tab_row.status<>'OPEN' OR p_amount>tab_row.total_amount-tab_row.paid_amount THEN RAISE EXCEPTION 'Comanda encerrada ou pagamento acima do saldo.'; END IF;
  INSERT INTO public.financial_transactions(arena_id,type,category,description,amount,payment_method,transaction_date,status,notes,created_by)
  VALUES(tab_row.arena_id,'INCOME','BAR','Recebimento da comanda #' || tab_row.tab_number || ' — ' || tab_row.customer_name,p_amount,p_payment_method,(now() AT TIME ZONE 'America/Sao_Paulo')::date,'COMPLETED',p_notes,auth.uid()) RETURNING id INTO transaction_id;
  INSERT INTO public.bar_tab_payments(arena_id,tab_id,request_key,amount,payment_method,notes,received_by,financial_transaction_id)
  VALUES(tab_row.arena_id,tab_row.id,p_request_key,p_amount,p_payment_method,p_notes,auth.uid(),transaction_id) RETURNING id INTO payment_id;
  new_paid:=tab_row.paid_amount+p_amount;
  UPDATE public.bar_tabs SET paid_amount=new_paid,status=CASE WHEN new_paid=total_amount THEN 'CLOSED' ELSE 'OPEN' END,
    closed_at=CASE WHEN new_paid=total_amount THEN now() ELSE NULL END,updated_at=now() WHERE id=tab_row.id;
  RETURN jsonb_build_object('payment_id',payment_id,'financial_transaction_id',transaction_id,'duplicate',false);
END $$;

REVOKE ALL ON FUNCTION public.receive_reservation_payment(uuid,numeric,public.payment_method,uuid,date,text),public.register_bar_tab_payment(uuid,numeric,public.payment_method,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_reservation_payment(uuid,numeric,public.payment_method,uuid,date,text),public.register_bar_tab_payment(uuid,numeric,public.payment_method,uuid,text) TO authenticated;

COMMIT;
