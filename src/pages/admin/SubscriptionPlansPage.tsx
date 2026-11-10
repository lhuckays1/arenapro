import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { SubscriptionPlan } from '../../types';
import { saasService } from '../../services/saas.service';

type PlanDraft = Omit<SubscriptionPlan, 'created_at' | 'updated_at'>;

const toDraft = (plan: SubscriptionPlan): PlanDraft => ({
  id: plan.id,
  name: plan.name,
  code: plan.code,
  monthly_price: Number(plan.monthly_price),
  max_courts: plan.max_courts ?? null,
  max_staff_users: plan.max_staff_users ?? null,
  features: plan.features || {},
  status: plan.status,
});

export const SubscriptionPlansPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [plans, setPlans] = useState<PlanDraft[]>([]);
  const [featuresText, setFeaturesText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await saasService.getPlans(true);
      setPlans(data.map(toDraft));
      setFeaturesText(Object.fromEntries(data.map(plan => [plan.id, JSON.stringify(plan.features || {}, null, 2)])));
    } catch (error: any) {
      setFeedback({ type: 'error', message: error?.message || 'Não foi possível carregar os planos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const update = (id: string, patch: Partial<PlanDraft>) => {
    setPlans(current => current.map(plan => plan.id === id ? { ...plan, ...patch } : plan));
  };

  const save = async (plan: PlanDraft) => {
    let features: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(featuresText[plan.id] || '{}');
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
      features = parsed as Record<string, unknown>;
    } catch {
      setFeedback({ type: 'error', message: `Os recursos do plano ${plan.name} precisam estar em formato JSON válido.` });
      return;
    }

    setSavingId(plan.id);
    setFeedback(null);
    try {
      await saasService.updateSubscriptionPlan(plan.id, { ...plan, features });
      setFeedback({ type: 'success', message: `Plano ${plan.name} salvo. O preço atualizado vale para novas assinaturas; contratos existentes mantêm o valor registrado.` });
      await load();
    } catch (error: any) {
      setFeedback({ type: 'error', message: error?.message || 'Não foi possível salvar o plano.' });
    } finally {
      setSavingId(null);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500';

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-gradient-to-br from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/20 rounded-3xl p-6 md:p-7">
        <button onClick={() => onNavigate('/admin/saas')} className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Voltar para Gestão SaaS
        </button>
        <div className="flex items-center gap-2 mt-5 text-purple-300 text-xs font-bold uppercase tracking-wider"><ShieldCheck className="w-4 h-4" /> Gestão comercial</div>
        <h1 className="text-2xl md:text-3xl font-black text-white mt-2">Editar planos</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">Configure nome, código, preço, limites e recursos. Somente o Super Admin pode alterar esses dados.</p>
      </div>

      {feedback && <div role="status" className={`p-4 rounded-2xl border text-xs font-semibold ${feedback.type === 'success' ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/70 border-rose-500/40 text-rose-300'}`}>{feedback.message}</div>}

      {loading ? <div className="p-10 text-center text-xs text-slate-500">Carregando planos…</div> : plans.length === 0 ? (
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-sm text-slate-400">Nenhum plano cadastrado.</section>
      ) : plans.map(plan => (
        <section key={plan.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><h2 className="text-base font-black text-white">{plan.name}</h2><p className="text-[11px] text-slate-500 mt-1">ID {plan.id}</p></div>
            <button type="button" disabled={savingId === plan.id} onClick={() => void save(plan)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black disabled:opacity-50">
              {savingId === plan.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{savingId === plan.id ? 'Salvando…' : 'Salvar plano'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="text-[11px] font-bold text-slate-400">Nome<input className={`${inputClass} mt-1.5`} value={plan.name} onChange={e => update(plan.id, { name: e.target.value })} /></label>
            <label className="text-[11px] font-bold text-slate-400">Código<input className={`${inputClass} mt-1.5 uppercase`} value={plan.code} onChange={e => update(plan.id, { code: e.target.value })} /></label>
            <label className="text-[11px] font-bold text-slate-400">Preço mensal (R$)<input className={`${inputClass} mt-1.5`} type="number" min="0.01" step="0.01" value={plan.monthly_price} onChange={e => update(plan.id, { monthly_price: Number(e.target.value) })} /></label>
            <label className="text-[11px] font-bold text-slate-400">Disponibilidade<select className={`${inputClass} mt-1.5`} value={plan.status} onChange={e => update(plan.id, { status: e.target.value as PlanDraft['status'] })}><option value="ACTIVE">Ativo — aparece para novas assinaturas</option><option value="INACTIVE">Inativo — oculto para novas assinaturas</option></select></label>
            <label className="text-[11px] font-bold text-slate-400">Limite de quadras<input className={`${inputClass} mt-1.5`} type="number" min="0" placeholder="Sem limite" value={plan.max_courts ?? ''} onChange={e => update(plan.id, { max_courts: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            <label className="text-[11px] font-bold text-slate-400">Limite de usuários da equipe<input className={`${inputClass} mt-1.5`} type="number" min="0" placeholder="Sem limite" value={plan.max_staff_users ?? ''} onChange={e => update(plan.id, { max_staff_users: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          </div>
          <label className="block text-[11px] font-bold text-slate-400">Recursos (JSON)<textarea className={`${inputClass} mt-1.5 min-h-32 font-mono`} spellCheck={false} value={featuresText[plan.id] || '{}'} onChange={e => setFeaturesText(current => ({ ...current, [plan.id]: e.target.value }))} /></label>
          <p className="flex items-center gap-2 text-[10px] text-slate-500"><Check className="w-3.5 h-3.5 text-emerald-400" /> Alterar preço ou desativar um plano não modifica o valor das assinaturas já contratadas.</p>
        </section>
      ))}

      <div className="flex justify-end"><button onClick={() => void load()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold"><RefreshCw className="w-4 h-4" /> Recarregar</button></div>
    </div>
  );
};

