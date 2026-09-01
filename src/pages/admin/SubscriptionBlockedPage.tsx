import React from 'react';
import { AlertTriangle, CreditCard, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const SubscriptionBlockedPage: React.FC = () => {
  const { activeArena, activeSubscription, signOut } = useAuth();

  const status = activeSubscription?.status || 'PENDING';
  const label = status === 'PENDING'
    ? 'Aguardando pagamento'
    : status === 'PAST_DUE'
      ? 'Pagamento em atraso'
      : 'Assinatura suspensa';

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
          administrativo quando a assinatura estiver ativa e o período pago estiver vigente.
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
            </div>
          </div>
        </div>

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
