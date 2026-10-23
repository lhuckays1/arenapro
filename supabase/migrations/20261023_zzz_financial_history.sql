BEGIN;

CREATE OR REPLACE FUNCTION public.guard_reservation_financial_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE received numeric;
BEGIN
  IF TG_OP='UPDATE' AND NEW.arena_id<>OLD.arena_id THEN RAISE EXCEPTION 'Não é permitido transferir reserva entre arenas.'; END IF;
  IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' AND NEW.payment_status<>'PENDING' THEN RAISE EXCEPTION 'Crie a reserva pendente e registre o recebimento no financeiro.'; END IF;
  IF TG_OP='UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN RAISE EXCEPTION 'O status do pagamento é definido pelos recebimentos e estornos.'; END IF;
  SELECT coalesce(sum(amount),0) INTO received FROM public.financial_transactions WHERE reservation_id=NEW.id AND type='INCOME' AND status='COMPLETED';
  IF NEW.amount<received THEN RAISE EXCEPTION 'O valor da reserva não pode ser menor que os recebimentos registrados.'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reservation_financial_fields ON public.reservations;
CREATE TRIGGER reservation_financial_fields BEFORE INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_reservation_financial_fields();

CREATE OR REPLACE FUNCTION public.financial_transaction_is_protected(lookup_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.financial_transactions transaction_row
    WHERE transaction_row.id=lookup_id AND public.has_arena_operational_access(transaction_row.arena_id)
    AND (transaction_row.reservation_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.bar_tab_payments WHERE financial_transaction_id=lookup_id)
    OR EXISTS(SELECT 1 FROM public.student_payments WHERE financial_transaction_id=lookup_id)));
$$;
REVOKE ALL ON FUNCTION public.financial_transaction_is_protected(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financial_transaction_is_protected(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_generated_financial_history()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.reservation_id IS NOT NULL THEN RAISE EXCEPTION 'Use o recebimento da reserva para lançar a receita vinculada.'; END IF;
    RETURN NEW;
  END IF;
  IF public.financial_transaction_is_protected(OLD.id) THEN RAISE EXCEPTION 'Histórico de recebimento protegido. Use a operação de estorno apropriada.'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS generated_financial_history ON public.financial_transactions;
CREATE TRIGGER generated_financial_history BEFORE INSERT OR UPDATE OR DELETE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.guard_generated_financial_history();

CREATE OR REPLACE FUNCTION public.void_operational_transaction(p_transaction_id uuid,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE transaction_row public.financial_transactions%ROWTYPE; reservation_id_value uuid; total_paid numeric; reservation_amount numeric;
BEGIN
  SELECT reservation_id INTO reservation_id_value FROM public.financial_transactions WHERE id=p_transaction_id;
  IF reservation_id_value IS NOT NULL THEN
    SELECT amount INTO reservation_amount FROM public.reservations WHERE id=reservation_id_value FOR UPDATE;
  END IF;
  SELECT * INTO transaction_row FROM public.financial_transactions WHERE id=p_transaction_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_arena_operational_access(transaction_row.arena_id) THEN RAISE EXCEPTION 'Lançamento não encontrado ou sem permissão.'; END IF;
  IF EXISTS(SELECT 1 FROM public.bar_tab_payments WHERE financial_transaction_id=p_transaction_id)
    OR EXISTS(SELECT 1 FROM public.student_payments WHERE financial_transaction_id=p_transaction_id) THEN RAISE EXCEPTION 'Recebimento de comanda ou mensalidade exige estorno específico; histórico preservado.'; END IF;
  IF transaction_row.status='VOID' THEN RETURN to_jsonb(transaction_row); END IF;
  UPDATE public.financial_transactions SET status='VOID',notes=concat_ws(' ',notes,'Estorno: '||coalesce(p_reason,'não informado')),updated_at=now()
    WHERE id=p_transaction_id RETURNING * INTO transaction_row;
  IF reservation_id_value IS NOT NULL THEN
    SELECT coalesce(sum(amount),0) INTO total_paid FROM public.financial_transactions WHERE reservation_id=reservation_id_value AND type='INCOME' AND status='COMPLETED';
    UPDATE public.reservations SET payment_status=CASE WHEN total_paid=0 THEN 'REFUNDED'::public.payment_status WHEN total_paid>=reservation_amount THEN 'PAID'::public.payment_status ELSE 'PARTIAL'::public.payment_status END,updated_at=now() WHERE id=reservation_id_value;
  END IF;
  RETURN to_jsonb(transaction_row);
END $$;
REVOKE ALL ON FUNCTION public.void_operational_transaction(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_operational_transaction(uuid,text) TO authenticated;

COMMIT;
