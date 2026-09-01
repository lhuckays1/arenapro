import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, CreditCard, Crown, Mail, Plus, RefreshCw, Search,
  ShieldCheck, UserPlus, X, CheckCircle2, Clock3, Ban, AlertTriangle
} from 'lucide-react';
import { Arena, ArenaSubscription, SubscriptionPlan } from '../../types';
import { arenaService } from '../../services/arena.service';
import { saasService } from '../../services/saas.service';
import { useAuth } from '../../contexts/AuthContext';

interface SaaSPageProps {
  onNavigate: (path: string) => void;
}

type Feedback = { type: 'success' | 'error'; message: string } | null;

const emptyForm = {
  arenaName: '',
  slug: '',
  description: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  planId: '',
};

export const SaaSPage: React.FC<SaaSPageProps> = ({ onNavigate }) => {
  const { setActiveArena } = useAuth();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [subscriptions, setSubscriptions] = useState<ArenaSubscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [owners, setOwners] = useState<Array<{ arena_id: string; user_id: string; role: string; profile?: any }>>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [arenaData, subscriptionData, planData, ownerData] = await Promise.all([
        arenaService.getArenas(),
        saasService.getSubscriptions(),
        saasService.getPlans(),
        saasService.getArenaOwners(),
      ]);
      setArenas(arenaData);
      setSubscriptions(subscriptionData);
      setPlans(planData);
      setOwners(ownerData);
      if (!form.planId && planData[0]) {
        setForm(prev => ({ ...prev, planId: planData[0].id }));
      }
    } catch (error: any) {
      setFeedback({ type: 'error', message: error?.message || 'Não foi possível carregar a gestão SaaS.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subscriptionByArena = useMemo(
    () => new Map(subscriptions.map(s => [s.arena_id, s])),
    [subscriptions]
  );

  const ownerByArena = useMemo(
    () => new Map(owners.map(o => [o.arena_id, o])),
    [owners]
  );

  const filteredArenas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return arenas;
    return arenas.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.slug.toLowerCase().includes(q) ||
      (a.city || '').toLowerCase().includes(q)
    );
  }, [arenas, search]);

  const stats = useMemo(() => ({
    total: arenas.length,
    active: subscriptions.filter(s => s.status === 'ACTIVE').length,
    pending: subscriptions.filter(s => s.status === 'PENDING').length,
    suspended: subscriptions.filter(s => ['SUSPENDED', 'PAST_DUE', 'EXPIRED'].includes(s.status)).length,
  }), [arenas, subscriptions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.arenaName || !form.slug || !form.ownerName || !form.ownerEmail || !form.planId) {
      setFeedback({ type: 'error', message: 'Preencha arena, proprietário, e-mail e plano.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await saasService.createArenaOwner({
        arena: {
          name: form.arenaName,
          slug: form.slug,
          description: form.description || null,
          phone: form.phone || null,
          whatsapp: form.whatsapp || null,
          email: form.email || form.ownerEmail,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip_code: form.zipCode || null,
        },
        owner: {
          full_name: form.ownerName,
          email: form.ownerEmail,
          phone: form.ownerPhone || null,
        },
        plan_id: form.planId,
      });

      setFeedback({
        type: 'success',
        message: 'Arena criada. O proprietário foi criado como ARENA_ADMIN e recebeu um convite. A assinatura ficou PENDENTE até o pagamento.',
      });
      setForm({ ...emptyForm, planId: plans[0]?.id || '' });
      setShowCreate(false);
      await load();
    } catch (error: any) {
      setFeedback({ type: 'error', message: error?.message || 'Não foi possível criar a arena.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubscription = async (subscription: ArenaSubscription, status: ArenaSubscription['status']) => {
    try {
      await saasService.updateSubscriptionStatus(subscription.id, status);
      setFeedback({
        type: 'success',
        message: status === 'ACTIVE'
          ? 'Assinatura ativada. O proprietário já pode acessar o painel.'
          : `Assinatura alterada para ${status}.`,
      });
      await load();
    } catch (error: any) {
      setFeedback({ type: 'error', message: error?.message || 'Não foi possível atualizar a assinatura.' });
    }
  };

  const statusMeta = (status?: string) => {
    switch (status) {
      case 'ACTIVE': return { label: 'ATIVA', icon: <CheckCircle2 className="w-3.5 h-3.5" />, cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
      case 'PENDING': return { label: 'PENDENTE', icon: <Clock3 className="w-3.5 h-3.5" />, cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
      case 'PAST_DUE': return { label: 'ATRASADA', icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'bg-orange-500/10 text-orange-300 border-orange-500/30' };
      default: return { label: status || 'SEM ASSINATURA', icon: <Ban className="w-3.5 h-3.5" />, cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30' };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
          feedback.type === 'success'
            ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="p-1 text-slate-400 hover:text-white">×</button>
        </div>
      )}

      <div className="bg-gradient-to-br from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/20 rounded-3xl p-6 md:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <Crown className="w-4 h-4" />
              Gestão do SaaS
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-2">Arenas e Assinaturas</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Somente o SUPER_ADMIN cria proprietários. Toda nova arena começa com assinatura PENDENTE e só libera a operação após pagamento.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black"
          >
            <Plus className="w-4 h-4" /> NOVA ARENA + PROPRIETÁRIO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Arenas', stats.total, Building2],
          ['Assinaturas ativas', stats.active, CheckCircle2],
          ['Aguardando pagamento', stats.pending, Clock3],
          ['Suspensas/atrasadas', stats.suspended, Ban],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <Icon className="w-4 h-4 text-emerald-400 mb-3" />
            <div className="text-2xl font-black text-white">{value}</div>
            <div className="text-[11px] text-slate-500 font-semibold">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar arena, slug ou cidade..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white outline-none focus:border-emerald-500"
          />
        </div>
        <button onClick={load} className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold">
          <RefreshCw className="w-4 h-4 inline mr-2" /> Atualizar
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <h2 className="text-sm font-black text-white">Tenants comerciais</h2>
          <p className="text-xs text-slate-500 mt-1">Acesso operacional depende da assinatura.</p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">Carregando...</div>
        ) : filteredArenas.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 mx-auto text-slate-700 mb-3" />
            <p className="text-sm font-bold text-slate-300">Nenhuma arena cadastrada</p>
            <p className="text-xs text-slate-500 mt-1">Use o botão acima para criar a primeira arena.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredArenas.map(arena => {
              const sub = subscriptionByArena.get(arena.id);
              const owner = ownerByArena.get(arena.id);
              const meta = statusMeta(sub?.status);
              return (
                <div key={arena.id} className="p-5 flex flex-col xl:flex-row xl:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black text-white">{arena.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-black ${meta.cls}`}>
                        {meta.icon}{meta.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">/{arena.slug} • {arena.city || 'Cidade não informada'}</p>
                  </div>

                  <div className="min-w-[220px]">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Proprietário</div>
                    <div className="flex items-center gap-2 mt-1">
                      <UserPlus className="w-4 h-4 text-purple-400" />
                      <div>
                        <div className="text-xs font-bold text-slate-200">{owner?.profile?.full_name || 'Não localizado'}</div>
                        <div className="text-[10px] text-slate-500">{owner?.profile?.id ? 'ARENA_ADMIN' : '—'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[150px]">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Plano</div>
                    <div className="text-xs font-bold text-slate-200 mt-1">
                      {sub?.plan?.name || '—'} {sub ? `• R$ ${Number(sub.monthly_price).toFixed(2).replace('.', ',')}/mês` : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {sub?.status !== 'ACTIVE' && (
                      <button
                        onClick={() => sub && handleSubscription(sub, 'ACTIVE')}
                        className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-black"
                      >
                        Ativar
                      </button>
                    )}
                    {sub?.status === 'ACTIVE' && (
                      <button
                        onClick={() => sub && handleSubscription(sub, 'SUSPENDED')}
                        className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-black"
                      >
                        Suspender
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveArena(arena);
                        onNavigate(`/admin/dashboard`);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold"
                    >
                      Abrir arena
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl">
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Nova Arena + Proprietário</h2>
                <p className="text-xs text-slate-500 mt-1">O convite será enviado ao proprietário. A assinatura começa PENDENTE.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['arenaName', 'Nome da Arena', 'Arena XP Beach'],
                ['slug', 'Slug', 'arena-xp-beach'],
                ['city', 'Cidade', 'Passos'],
                ['state', 'Estado', 'MG'],
                ['phone', 'Telefone', '(35) 99999-9999'],
                ['whatsapp', 'WhatsApp', '(35) 99999-9999'],
                ['email', 'E-mail da Arena', 'contato@arena.com.br'],
                ['address', 'Endereço', 'Rua das Quadras, 100'],
                ['zipCode', 'CEP', '37900-000'],
              ].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">{label}</label>
                  <input
                    value={(form as any)[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>
              ))}

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-2 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-black text-white">Proprietário</h3>
                </div>
              </div>

              {[
                ['ownerName', 'Nome completo', 'João da Silva'],
                ['ownerEmail', 'E-mail de acesso', 'joao@arena.com.br'],
                ['ownerPhone', 'Telefone', '(35) 99999-9999'],
              ].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">{label}</label>
                  <input
                    type={key === 'ownerEmail' ? 'email' : 'text'}
                    required={key !== 'ownerPhone'}
                    value={(form as any)[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Plano comercial</label>
                <select
                  value={form.planId}
                  onChange={e => setForm(prev => ({ ...prev, planId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
                  required
                >
                  <option value="">Selecione...</option>
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — R$ {Number(plan.monthly_price).toFixed(2).replace('.', ',')}/mês
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">
                Cancelar
              </button>
              <button disabled={saving} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black disabled:opacity-50">
                {saving ? 'Criando...' : 'Criar arena e enviar convite'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
