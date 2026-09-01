import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { 
  Building2, 
  Clock, 
  Phone, 
  MapPin, 
  Database, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  Mail, 
  ShieldAlert 
} from 'lucide-react';
import { Arena } from '../../types';

export const SettingsPage: React.FC<{ onNavigate: (path: string) => void }> = () => {
  const { activeArena, setActiveArena, profile, isConfigured } = useAuth();
  
  const isArenaAdmin = profile?.role === 'ARENA_ADMIN' || profile?.role === 'SUPER_ADMIN';

  const [formData, setFormData] = useState<Partial<Arena>>({
    name: '',
    slug: '',
    description: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    opening_time: '06:00',
    closing_time: '23:00',
    cancellation_limit_hours: 2,
  });

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeArena) {
      setFormData({
        name: activeArena.name || '',
        slug: activeArena.slug || '',
        description: activeArena.description || '',
        phone: activeArena.phone || '',
        whatsapp: activeArena.whatsapp || '',
        email: activeArena.email || '',
        address: activeArena.address || '',
        city: activeArena.city || '',
        state: activeArena.state || '',
        zip_code: activeArena.zip_code || '',
        opening_time: activeArena.opening_time || '06:00',
        closing_time: activeArena.closing_time || '23:00',
        cancellation_limit_hours: activeArena.cancellation_limit_hours || 2,
      });
    }
  }, [activeArena]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArena) return;
    if (!isArenaAdmin) {
      setErrorMessage('Permissão negada: apenas administradores da arena podem alterar essas configurações.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (!formData.name?.trim()) {
        throw new Error('O nome da arena é obrigatório.');
      }
      if (!formData.slug?.trim()) {
        throw new Error('O slug da arena é obrigatório.');
      }

      const updated = await arenaService.updateArena(activeArena.id, formData);
      setActiveArena(updated);
      setSuccessMessage('Configurações da arena salvas com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Configurações da Arena</h2>
          <p className="text-xs text-slate-400">
            Gerenciamento de dados cadastrais, horários de funcionamento e regras de reserva
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {isConfigured ? 'Supabase Conectado' : 'Modo Desenvolvimento'}
          </span>
        </div>
      </div>

      {/* Role Alert if not Admin */}
      {!isArenaAdmin && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Modo de visualização (Apenas Leitura)</p>
            <p className="text-amber-400/80 mt-0.5">
              Seu perfil atual ({profile?.role}) possui permissão de leitura. Apenas administradores (ARENA_ADMIN ou SUPER_ADMIN) podem alterar dados da arena.
            </p>
          </div>
        </div>
      )}

      {/* Status Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Identificação da Arena</h3>
              <p className="text-xs text-slate-400">Informações públicas e link de acesso exclusivo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Nome da Arena *
              </label>
              <input
                type="text"
                id="setting-arena-name"
                disabled={!isArenaAdmin}
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
                placeholder="Ex: Arena XP Beach Sports"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Slug / URL Amigável *
              </label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-slate-800 border border-r-0 border-slate-800 rounded-l-xl text-slate-400 font-mono text-[11px]">
                  /arena/
                </span>
                <input
                  type="text"
                  id="setting-arena-slug"
                  disabled={!isArenaAdmin}
                  value={formData.slug || ''}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-r-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
                  placeholder="arena-xp-beach"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1.5">
                Descrição Institucional
              </label>
              <textarea
                rows={3}
                id="setting-arena-description"
                disabled={!isArenaAdmin}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
                placeholder="Conte sobre os diferenciais da arena, iluminação, vestiários e estrutura..."
              />
            </div>
          </div>
        </div>

        {/* Operating Hours & Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Horários e Políticas de Reserva</h3>
              <p className="text-xs text-slate-400">Janela diária de funcionamento e limites para cancelamento</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Horário de Abertura
              </label>
              <input
                type="time"
                id="setting-opening-time"
                disabled={!isArenaAdmin}
                value={formData.opening_time || '06:00'}
                onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Horário de Fechamento
              </label>
              <input
                type="time"
                id="setting-closing-time"
                disabled={!isArenaAdmin}
                value={formData.closing_time || '23:00'}
                onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Limite Cancelamento (Horas)
              </label>
              <input
                type="number"
                min="0"
                max="72"
                id="setting-cancellation-hours"
                disabled={!isArenaAdmin}
                value={formData.cancellation_limit_hours || 2}
                onChange={(e) => setFormData({ ...formData, cancellation_limit_hours: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Cancelamento grátis até X horas antes</span>
            </div>
          </div>
        </div>

        {/* Contact & Location */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Contato e Localização</h3>
              <p className="text-xs text-slate-400">Canais de atendimento e endereço físico da arena</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Telefone / Celular
              </label>
              <input
                type="text"
                id="setting-phone"
                disabled={!isArenaAdmin}
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
                placeholder="(11) 98765-4321"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                WhatsApp Oficial
              </label>
              <input
                type="text"
                id="setting-whatsapp"
                disabled={!isArenaAdmin}
                value={formData.whatsapp || ''}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
                placeholder="(11) 98765-4321"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                E-mail de Contato
              </label>
              <input
                type="email"
                id="setting-email"
                disabled={!isArenaAdmin}
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
                placeholder="contato@arena.com.br"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1.5">
                Endereço (Rua, Número, Bairro)
              </label>
              <input
                type="text"
                id="setting-address"
                disabled={!isArenaAdmin}
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
                placeholder="Av. das Palmeiras, 1500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                CEP
              </label>
              <input
                type="text"
                id="setting-zip"
                disabled={!isArenaAdmin}
                value={formData.zip_code || ''}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
                placeholder="04578-000"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Cidade
              </label>
              <input
                type="text"
                id="setting-city"
                disabled={!isArenaAdmin}
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60"
                placeholder="São Paulo"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Estado (UF)
              </label>
              <input
                type="text"
                maxLength={2}
                id="setting-state"
                disabled={!isArenaAdmin}
                value={formData.state || ''}
                onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-60 uppercase"
                placeholder="SP"
              />
            </div>
          </div>
        </div>

        {/* Security & Multi-tenant Notice */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-300">
            <Database className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold block">Isolamento Multi-Tenant: Tenant ID</span>
              <span className="font-mono text-[11px] text-slate-400">{activeArena?.id}</span>
            </div>
          </div>
          <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase">
            PostgreSQL RLS Ativo
          </span>
        </div>

        {/* Action Button */}
        {isArenaAdmin && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              id="save-arena-settings-btn"
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 text-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando Alterações...' : 'Salvar Configurações da Arena'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
