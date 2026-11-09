import React, { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, ExternalLink, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saasService } from '../../services/saas.service';
import type { ArenaSubscriptionPayment } from '../../types';
import { hasOperationalSubscriptionAccess } from '../../utils/subscriptionAccess';

export const SubscriptionBlockedPage: React.FC = () => {
  const { activeArena, activeSubscription, signOut } = useAuth();
  const [payments, setPayments] = useState<ArenaSubscriptionPayment[]>([]);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState('');
  const [loadingPayments, setLoadingPayments] = useState(false);

  const status = activeSubscription?.status || 'PENDING';
  const access = hasOperationalSubscriptionAccess(activeSubscription);
  const isPastDue = status === 'PAST_DUE' || (status === 'ACTIVE' && !access);
  const label = status === 'PENDING'
    ? 'Aguardando pagamento'
    : isPastDue
      ? 'Pagamento em atraso'
      : 'Assinatura suspensa';

  useEffect(() => {
    if (!activeSubscription?.id) return;
    setLoadingPayments(true);
    saasService.getSubscriptionPayments(activeSubscription.id)
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setLoadingPayments(false));
  }, [activeSubscription?.id]);

  const startCheckout = async () => {
    if (!activeArena?.id) return;
    setLoadingCheckout(true);
    setError('');
    try {
      const checkout = await saasService.createPagarmeCheckout(activeArena.id);
      window.location.assign(checkout.checkout_url);
    } catch (reason: any) {
      setError(reason?.message || 'Não foi possível abrir o pagamento.');
      setLoadingCheckout(false);
    }
  };

  const formatDate = (value?: string | null) => value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR')
    : '—';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-5">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-7 md:p-9 shadow-2xl text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-amber-400" />
        </div>
        <div className="mt-5 text-[11px] font-black uppercase tracking-widest text-amber-300">{label}</div>
        <h1 className="text-2xl font-black text-white mt-2">Acesso operacional indisponível</h1>
        <p className="text-sm text-slate-400 mt-3 leading-relaxed">
          A arena <strong className="text-slate-200">{activeArena?.name || 'selecionada'}</strong> só libera o painel
          administrativo quando o pagamento estiver confirmado. {isPastDue && activeSubscription?.status === 'PAST_DUE'
            ? `O prazo de tolerância é de ${activeSubscription.grace_period_days ?? 5} dias após o vencimento.`
            : 'Após a confirmação do pagamento, o acesso é reativado automaticamente.'}
        </p>

        <div className="mt-6 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-xs font-black text-slate-200">Assinatura</div>
              <div className="text-[11px] text-slate-500">
                {activeSubscription?.plan?.name || 'Plano não definido'}
                {activeSubscription ? ` • R$ ${Number(activeSubscription.monthly_price).toFixed(2).replace('.', ',')}/mês` : ''}
              </div>
              {activeSubscription?.current_period_end && (
                <div className="text-[10px] text-slate-600 mt-1">Vencimento: {formatDate(activeSubscription.current_period_end)}</div>
              )}
            </div>
          </div>
        </div>

        {error && <div role="alert" className="mt-4 text-left text-xs text-rose-300 bg-rose-950/40 border border-rose-900 rounded-xl p-3">{error}</div>}

        {activeSubscription && !access && activeSubscription.status !== 'CANCELLED' && (
          <button
            onClick={startCheckout}
            disabled={loadingCheckout}
            className="mt-5 w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black disabled:opacity-60"
          >
            <ExternalLink className="w-4 h-4 inline mr-2" />
            {loadingCheckout ? 'Preparando pagamento…' : 'Regularizar assinatura'}
          </button>
        )}

        {activeSubscription && (
          <div className="mt-5 text-left bg-slate-950 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-black text-slate-200">Últimos pagamentos</div>
            {loadingPayments ? <div className="text-[11px] text-slate-500 mt-2">Carregando histórico…</div> : payments.length ? (
              <div className="mt-3 divide-y divide-slate-800">
                {payments.slice(0, 5).map(payment => (
                  <div key={payment.id} className="py-2 flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-slate-400">{formatDate(payment.paid_at || payment.due_date || payment.created_at)}</span>
                    <span className="text-slate-300">R$ {(payment.amount_cents / 100).toFixed(2).replace('.', ',')}</span>
                    <span className={payment.status === 'PAID' ? 'text-emerald-300' : 'text-amber-300'}>{payment.status === 'PAID' ? 'Pago' : payment.status === 'FAILED' ? 'Falhou' : payment.status}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-[11px] text-slate-500 mt-2">Nenhum pagamento registrado ainda.</div>}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-3 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black"
          >
            <ShieldCheck className="w-4 h-4 inline mr-2" />
            Verificar novamente
          </button>
          <button
            onClick={signOut}
            className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold"
          >
            <LogOut className="w-4 h-4 inline mr-2" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};


