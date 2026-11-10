import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, CreditCard, Crown, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saasService } from '../../services/saas.service';
import type { ArenaSubscriptionPayment } from '../../types';
import { translateSubscriptionStatus } from '../../utils/translation';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const date = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—';

export const ArenaSubscriptionPage: React.FC = () => {
  const { activeArena, activeSubscription } = useAuth();
  const [payments, setPayments] = useState<ArenaSubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    if (!activeSubscription?.id) return;
    setLoading(true);
    setError('');
    try {
      setPayments(await saasService.getSubscriptionPayments(activeSubscription.id));
    } catch (reason: any) {
      setError(reason?.message || 'Não foi possível carregar o histórico de pagamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [activeSubscription?.id]);

  const plan = activeSubscription?.plan;
  const status = activeSubscription?.status || 'PENDING';
  const statusIsActive = status === 'ACTIVE';

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <header className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-3xl p-6 md:p-7">
        <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider"><CreditCard className="w-4 h-4" /> Conta e cobrança</div>
        <h1 className="text-2xl md:text-3xl font-black text-white mt-2">Meu plano</h1>
        <p className="text-sm text-slate-400 mt-1">Consulte o plano e os dados da assinatura de {activeArena?.name || 'sua arena'}.</p>
      </header>

      {!activeSubscription ? (
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-sm text-slate-400">Nenhuma assinatura está vinculada a esta arena. Fale com o suporte ArenaPro.</section>
      ) : (
        <>
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Crown className="w-5 h-5 text-emerald-400" /></div>
                <div><h2 className="text-lg font-black text-white">{plan?.name || 'Plano contratado'}</h2><p className="text-xs text-slate-400 mt-1">{activeArena?.name}</p></div>
              </div>
              <span className={`inline-flex items-center gap-1.5 w-fit px-3 py-1.5 rounded-full border text-[10px] font-black ${statusIsActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {translateSubscriptionStatus(status)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Valor mensal contratado</div><div className="text-xl font-black text-white mt-1">{money(Number(activeSubscription.monthly_price))}<span className="text-xs font-semibold text-slate-500">/mês</span></div></div>
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Início do período</div><div className="text-sm font-bold text-slate-200 mt-2">{date(activeSubscription.current_period_start)}</div></div>
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4"><div className="text-[10px] uppercase font-bold text-slate-500">Próximo vencimento</div><div className="text-sm font-bold text-slate-200 mt-2">{date(activeSubscription.current_period_end)}</div></div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 p-4">
              <h3 className="text-xs font-black text-white">Limites incluídos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3"><span className="text-slate-400">Quadras</span><strong className="text-slate-200">{plan?.max_courts == null ? 'Sem limite' : plan.max_courts}</strong></div>
                <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3"><span className="text-slate-400">Usuários da equipe</span><strong className="text-slate-200">{plan?.max_staff_users == null ? 'Sem limite' : plan.max_staff_users}</strong></div>
              </div>
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-black text-white">Histórico de pagamentos</h2><p className="text-[11px] text-slate-500 mt-1">Últimos pagamentos registrados para esta assinatura.</p></div>
              <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
            </div>
            {error && <div role="alert" className="m-4 p-3 rounded-xl bg-rose-950/40 border border-rose-900 text-xs text-rose-300">{error}</div>}
            {loading ? <p className="p-6 text-xs text-slate-500">Carregando pagamentos…</p> : payments.length ? (
              <div className="divide-y divide-slate-800">
                {payments.map(payment => <div key={payment.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs"><span className="inline-flex items-center gap-2 text-slate-400"><CalendarDays className="w-4 h-4" />{date(payment.paid_at || payment.due_date || payment.created_at)}</span><strong className="text-slate-200">{money(payment.amount_cents / 100)}</strong><span className={payment.status === 'PAID' ? 'text-emerald-300' : payment.status === 'FAILED' ? 'text-rose-300' : 'text-amber-300'}>{payment.status === 'PAID' ? 'Pago' : payment.status === 'FAILED' ? 'Falhou' : payment.status === 'CANCELED' || payment.status === 'CANCELLED' ? 'Cancelado' : payment.status === 'REFUNDED' ? 'Estornado' : payment.status === 'OVERDUE' ? 'Vencido' : payment.status === 'PENDING' ? 'Pendente' : 'Em processamento'}</span></div>)}
              </div>
            ) : <p className="p-6 text-xs text-slate-500">Nenhum pagamento registrado ainda.</p>}
          </section>
        </>
      )}
    </div>
  );
};

