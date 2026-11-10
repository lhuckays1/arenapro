import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clipboard, CreditCard, ExternalLink, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saasService } from '../../services/saas.service';
import type { ArenaSubscriptionPayment } from '../../types';
import { hasOperationalSubscriptionAccess } from '../../utils/subscriptionAccess';

type BillingType = 'PIX' | 'BOLETO';
type Payer = { name: string; email: string; cpfCnpj: string; phone: string; postalCode: string; addressNumber: string };
type Checkout = Awaited<ReturnType<typeof saasService.createAsaasCheckout>>;

export const SubscriptionBlockedPage: React.FC = () => {
  const { activeArena, activeSubscription, signOut } = useAuth();
  const [payments, setPayments] = useState<ArenaSubscriptionPayment[]>([]);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState('');
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [billingType, setBillingType] = useState<BillingType>(activeSubscription?.checkout_billing_type || 'PIX');
  const [payer, setPayer] = useState<Payer>({ name: '', email: '', cpfCnpj: '', phone: '', postalCode: '', addressNumber: '' });
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [copied, setCopied] = useState(false);

  const status = activeSubscription?.status || 'PENDING';
  const access = hasOperationalSubscriptionAccess(activeSubscription);
  const isPastDue = status === 'PAST_DUE' || (status === 'ACTIVE' && !access);
  const label = status === 'PENDING' ? 'Aguardando pagamento' : isPastDue ? 'Pagamento em atraso' : 'Assinatura suspensa';

  useEffect(() => {
    if (!activeSubscription?.id) return;
    setLoadingPayments(true);
    saasService.getSubscriptionPayments(activeSubscription.id).then(setPayments).catch(() => setPayments([])).finally(() => setLoadingPayments(false));
  }, [activeSubscription?.id]);

  const formatDate = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—';
  const setPayerField = (field: keyof Payer, value: string) => setPayer(current => ({ ...current, [field]: value }));

  const startCheckout = async () => {
    if (!activeArena?.id) return;
    setLoadingCheckout(true); setError('');
    try {
      const result = await saasService.createAsaasCheckout({ arenaId: activeArena.id, billingType, payer });
      setCheckout(result);
      if (!result.processing) {
        saasService.getSubscriptionPayments(activeSubscription?.id || '').then(setPayments).catch(() => undefined);
      }
    } catch (reason: any) {
      setError(reason?.message || 'Não foi possível preparar o pagamento.');
    } finally { setLoadingCheckout(false); }
  };

  const copy = async (value?: string | null) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('Não foi possível copiar automaticamente. Selecione e copie o código manualmente.'); }
  };

  const inputClass = 'mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-400';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-5">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-7 md:p-9 shadow-2xl text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><AlertTriangle className="w-7 h-7 text-amber-400" /></div>
        <div className="mt-5 text-[11px] font-black uppercase tracking-widest text-amber-300">{label}</div>
        <h1 className="text-2xl font-black text-white mt-2">Acesso operacional indisponível</h1>
        <p className="text-sm text-slate-400 mt-3 leading-relaxed">
          A arena <strong className="text-slate-200">{activeArena?.name || 'selecionada'}</strong> libera o painel administrativo após a confirmação do pagamento. {isPastDue && activeSubscription?.status === 'PAST_DUE' ? `O prazo de tolerância é de ${activeSubscription.grace_period_days ?? 5} dias após o vencimento.` : 'O acesso será reativado automaticamente quando o pagamento for confirmado.'}
        </p>

        <div className="mt-6 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left">
          <div className="flex items-center gap-3"><CreditCard className="w-5 h-5 text-emerald-400" /><div>
            <div className="text-xs font-black text-slate-200">Assinatura</div>
            <div className="text-[11px] text-slate-500">{activeSubscription?.plan?.name || 'Plano não definido'}{activeSubscription ? ` • R$ ${Number(activeSubscription.monthly_price).toFixed(2).replace('.', ',')}/mês` : ''}</div>
            {activeSubscription?.current_period_end && <div className="text-[10px] text-slate-600 mt-1">Vencimento: {formatDate(activeSubscription.current_period_end)}</div>}
          </div></div>
        </div>

        {error && <div role="alert" className="mt-4 text-left text-xs text-rose-300 bg-rose-950/40 border border-rose-900 rounded-xl p-3">{error}</div>}

        {activeSubscription && !access && activeSubscription.status !== 'CANCELLED' && !checkout && (
          <div className="mt-5 text-left rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-sm font-black text-white">Regularizar dentro do ArenaPro</div>
            <p className="mt-1 text-xs text-slate-400">Escolha Pix ou boleto e informe os dados necessários para emissão.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(['PIX', 'BOLETO'] as const).map(method => <button key={method} type="button" onClick={() => setBillingType(method)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${billingType === method ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 text-slate-300'}`}>{method === 'PIX' ? 'Pix' : 'Boleto bancário'}</button>)}
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-[11px] text-slate-400">Nome completo<input autoComplete="name" className={inputClass} value={payer.name} onChange={e => setPayerField('name', e.target.value)} /></label>
              <label className="text-[11px] text-slate-400">E-mail<input type="email" autoComplete="email" className={inputClass} value={payer.email} onChange={e => setPayerField('email', e.target.value)} /></label>
              <label className="text-[11px] text-slate-400">CPF ou CNPJ<input inputMode="numeric" autoComplete="off" className={inputClass} value={payer.cpfCnpj} onChange={e => setPayerField('cpfCnpj', e.target.value)} /></label>
              <label className="text-[11px] text-slate-400">Celular<input inputMode="tel" autoComplete="tel" className={inputClass} value={payer.phone} onChange={e => setPayerField('phone', e.target.value)} /></label>
              <label className="text-[11px] text-slate-400">CEP<input inputMode="numeric" autoComplete="postal-code" className={inputClass} value={payer.postalCode} onChange={e => setPayerField('postalCode', e.target.value)} /></label>
              <label className="text-[11px] text-slate-400">Número do endereço<input autoComplete="off" className={inputClass} value={payer.addressNumber} onChange={e => setPayerField('addressNumber', e.target.value)} /></label>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Esses dados são enviados ao Asaas para gerar a cobrança. O ArenaPro não os salva. Os dados legais exibidos no comprovante seguem as regras do provedor de pagamento.</p>
            <button onClick={startCheckout} disabled={loadingCheckout} className="mt-4 w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black disabled:opacity-60">{loadingCheckout ? 'Preparando pagamento…' : 'Gerar pagamento'}</button>
          </div>
        )}

        {checkout && <div className="mt-5 text-left rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-2"><div><div className="text-sm font-black text-white">{checkout.processing ? 'Pagamento em preparação' : checkout.billing_type === 'PIX' ? 'Pague com Pix' : 'Pague com boleto'}</div><div className="mt-1 text-[11px] text-slate-400">{checkout.amount ? `Valor: R$ ${checkout.amount.toFixed(2).replace('.', ',')} • ` : ''}Vencimento: {formatDate(checkout.due_date)}</div></div><button disabled={loadingCheckout} onClick={startCheckout} className="rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-bold disabled:opacity-50">{loadingCheckout ? 'Atualizando…' : 'Atualizar cobrança'}</button></div>
          {checkout.processing && <p className="mt-3 text-xs text-slate-400">{checkout.message || 'O provedor está gerando os dados. Atualize em alguns instantes; não inicie outra cobrança.'}</p>}
          {checkout.pix?.encoded_image && <img className="mx-auto mt-4 w-52 rounded-xl bg-white p-2" alt="QR Code Pix para pagamento" src={`data:image/png;base64,${checkout.pix.encoded_image}`} />}
          {checkout.pix?.payload && <div className="mt-3"><div className="text-[11px] font-bold text-slate-300">Pix copia e cola</div><textarea readOnly rows={3} className={`${inputClass} resize-none`} value={checkout.pix.payload} /><button onClick={() => copy(checkout.pix?.payload)} className="mt-2 rounded-lg bg-emerald-500 px-3 py-2 text-[11px] font-black text-slate-950"><Clipboard className="mr-1 inline h-3.5 w-3.5" />{copied ? 'Copiado' : 'Copiar código Pix'}</button></div>}
          {checkout.boleto?.identification_field && <div className="mt-4"><div className="text-[11px] font-bold text-slate-300">Linha digitável</div><textarea readOnly rows={2} className={`${inputClass} resize-none`} value={checkout.boleto.identification_field} /><button onClick={() => copy(checkout.boleto?.identification_field)} className="mt-2 rounded-lg bg-emerald-500 px-3 py-2 text-[11px] font-black text-slate-950"><Clipboard className="mr-1 inline h-3.5 w-3.5" />{copied ? 'Copiado' : 'Copiar linha digitável'}</button></div>}
          {checkout.boleto?.bank_slip_url && <a href={checkout.boleto.bank_slip_url} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-bold text-emerald-300">Abrir boleto PDF <ExternalLink className="ml-1 inline h-3 w-3" /></a>}
          {!checkout.processing && !checkout.pix?.payload && !checkout.boleto?.identification_field && <p className="mt-3 text-xs text-amber-300">Os dados da cobrança ainda não foram disponibilizados. Atualize em instantes.</p>}
        </div>}

        {activeSubscription && <div className="mt-5 text-left bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs font-black text-slate-200">Últimos pagamentos</div>
          {loadingPayments ? <div className="mt-2 text-[11px] text-slate-500">Carregando histórico…</div> : payments.length ? <div className="mt-3 divide-y divide-slate-800">{payments.slice(0, 5).map(payment => <div key={payment.id} className="py-2 flex items-center justify-between gap-3 text-[11px]"><span className="text-slate-400">{formatDate(payment.paid_at || payment.due_date || payment.created_at)}</span><span className="text-slate-300">R$ {(payment.amount_cents / 100).toFixed(2).replace('.', ',')}</span><span className={payment.status === 'PAID' ? 'text-emerald-300' : 'text-amber-300'}>{payment.status === 'PAID' ? 'Pago' : payment.status === 'FAILED' ? 'Falhou' : payment.status}</span></div>)}</div> : <div className="mt-2 text-[11px] text-slate-500">Nenhum pagamento registrado ainda.</div>}
        </div>}

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => window.location.reload()} className="px-4 py-3 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black"><ShieldCheck className="mr-2 inline h-4 w-4" />Verificar novamente</button>
          <button onClick={signOut} className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold"><LogOut className="mr-2 inline h-4 w-4" />Sair</button>
        </div>
        <div className="sr-only" aria-live="polite">{copied ? <><Check />Copiado</> : null}</div>
      </div>
    </div>
  );
};
