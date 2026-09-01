import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import {
  User,
  Phone,
  Mail,
  ShieldCheck,
  LogOut,
  Building2,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export const ClientProfilePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { profile, user, signOut, activeArena, setActiveArena, arenas, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success?: string; error?: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setFeedback(null);

    try {
      await arenaService.updateProfile(user.id, {
        full_name: fullName,
        phone: phone,
      });

      // Also update customer records linked to this user
      if (activeArena) {
        const customers = await arenaService.getCustomers(activeArena.id);
        const userCust = customers.find(c => c.user_id === user.id);
        if (userCust) {
          await arenaService.updateCustomer(userCust.id, {
            full_name: fullName,
            phone: phone,
          });
        }
      }

      await refreshProfile();
      setFeedback({ success: 'Perfil atualizado com sucesso!' });
    } catch (err: any) {
      setFeedback({ error: err?.message || 'Erro ao salvar alterações no perfil.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto animate-fadeIn pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Meu Perfil</h1>
        <p className="text-xs text-slate-400">Gerencie seus dados de contato e preferências de arena</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        {/* Header Avatar Row */}
        <div className="flex items-center gap-4 pb-5 border-b border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-2xl shadow-lg shadow-emerald-500/20">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">{profile?.full_name || 'Atleta'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Atleta / Cliente
              </span>
              <span className="text-[11px] text-slate-400">ID: {user?.id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        {feedback?.success && (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback.success}</span>
          </div>
        )}

        {feedback?.error && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedback.error}</span>
          </div>
        )}

        {/* Editable Form */}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nome Completo</span>
            </label>
            <input
              id="profile-name-input"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Telefone / WhatsApp</span>
            </label>
            <input
              id="profile-phone-input"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>E-mail da Conta (Não editável)</span>
            </label>
            <input
              type="email"
              disabled
              value={user?.email || 'atleta@exemplo.com'}
              className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400 text-xs cursor-not-allowed"
            />
          </div>

          <div className="pt-2">
            <button
              id="profile-save-btn"
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Dados do Perfil'}</span>
            </button>
          </div>
        </form>

        {/* Active Arena Switcher */}
        <div className="pt-5 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Arena Ativa</span>
            </label>
            {activeArena?.slug && (
              <button
                type="button"
                onClick={() => onNavigate(`/arena/${activeArena.slug}`)}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Ver Portal</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            {arenas.map((a) => {
              const isSelected = activeArena?.id === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActiveArena(a)}
                  className={`p-3 rounded-2xl border text-left text-xs transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <span className="text-white font-extrabold block">{a.name}</span>
                    <span className="text-[11px] text-slate-400">{a.city} - {a.state}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                      Selecionada
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="pt-4 border-t border-slate-800">
          <button
            id="profile-signout-btn"
            type="button"
            onClick={signOut}
            className="w-full py-3 rounded-2xl bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold text-xs hover:bg-rose-500/20 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da Minha Conta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
