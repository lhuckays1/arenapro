import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { Modality, EntityStatus } from '../../types';
import { 
  Volleyball, 
  Trophy, 
  Sun, 
  Shield, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Flame,
  Dumbbell
} from 'lucide-react';

export const ModalitiesPage: React.FC<{ onNavigate: (path: string) => void }> = () => {
  const { activeArena, profile } = useAuth();
  const isArenaAdmin = profile?.role === 'ARENA_ADMIN' || profile?.role === 'SUPER_ADMIN';

  const [modalities, setModalities] = useState<Modality[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EntityStatus>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModality, setEditingModality] = useState<Modality | null>(null);
  const [modalForm, setModalForm] = useState<{
    name: string;
    description: string;
    icon: string;
    status: EntityStatus;
  }>({
    name: '',
    description: '',
    icon: 'Sun',
    status: 'ACTIVE',
  });

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadModalities = async () => {
    if (!activeArena) return;
    setLoading(true);
    try {
      const data = await arenaService.getModalities(activeArena.id);
      setModalities(data);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao carregar modalidades.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModalities();
  }, [activeArena]);

  const handleOpenCreate = () => {
    setEditingModality(null);
    setModalForm({
      name: '',
      description: '',
      icon: 'Sun',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mod: Modality) => {
    setEditingModality(mod);
    setModalForm({
      name: mod.name,
      description: mod.description || '',
      icon: mod.icon || 'Sun',
      status: mod.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArena) return;

    if (!modalForm.name.trim()) {
      setNotification({ type: 'error', message: 'O nome da modalidade é obrigatório.' });
      return;
    }

    setActionLoading(true);
    setNotification(null);

    try {
      if (editingModality) {
        // Update
        await arenaService.updateModality(editingModality.id, {
          name: modalForm.name.trim(),
          description: modalForm.description.trim(),
          icon: modalForm.icon,
          status: modalForm.status,
        });
        setNotification({ type: 'success', message: 'Modalidade atualizada com sucesso!' });
      } else {
        // Create
        await arenaService.createModality({
          arena_id: activeArena.id,
          name: modalForm.name.trim(),
          description: modalForm.description.trim(),
          icon: modalForm.icon,
          status: modalForm.status,
        });
        setNotification({ type: 'success', message: 'Modalidade criada com sucesso!' });
      }

      setIsModalOpen(false);
      await loadModalities();
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao salvar modalidade.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeArena) return;
    if (!window.confirm('Tem certeza que deseja excluir esta modalidade?')) return;

    setActionLoading(true);
    setNotification(null);

    try {
      await arenaService.deleteModality(id, activeArena.id);
      setNotification({ type: 'success', message: 'Modalidade excluída com sucesso!' });
      await loadModalities();
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao excluir modalidade.' });
    } finally {
      setActionLoading(false);
    }
  };

  const getIconComponent = (iconName?: string) => {
    switch (iconName) {
      case 'Volleyball':
        return <Volleyball className="w-5 h-5 text-emerald-400" />;
      case 'Shield':
        return <Shield className="w-5 h-5 text-teal-400" />;
      case 'Trophy':
        return <Trophy className="w-5 h-5 text-blue-400" />;
      case 'Flame':
        return <Flame className="w-5 h-5 text-rose-400" />;
      case 'Dumbbell':
        return <Dumbbell className="w-5 h-5 text-purple-400" />;
      case 'Activity':
        return <Activity className="w-5 h-5 text-cyan-400" />;
      case 'Sun':
      default:
        return <Sun className="w-5 h-5 text-amber-400" />;
    }
  };

  const filteredModalities = modalities.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
      (m.description && m.description.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Modalidades Esportivas</h2>
          <p className="text-xs text-slate-400">
            Categorias de esportes suportadas na {activeArena?.name || 'arena'}
          </p>
        </div>

        {isArenaAdmin && (
          <button
            id="create-modality-btn"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Modalidade</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2 animate-fadeIn ${
          notification.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="search-modality-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar modalidade..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-semibold hidden sm:inline">Status:</span>
          <div className="grid grid-cols-3 gap-1 w-full sm:w-auto bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ativas
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'INACTIVE' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inativas
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Modalities */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Carregando modalidades...</div>
      ) : filteredModalities.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/50 border border-slate-800 rounded-2xl p-8 space-y-2">
          <Volleyball className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Nenhuma modalidade encontrada</p>
          <p className="text-xs text-slate-500">Cadastre esportes praticados na arena para associar às quadras.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredModalities.map((mod) => (
            <div
              key={mod.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
                    {getIconComponent(mod.icon)}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    mod.status === 'ACTIVE' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {mod.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                    {mod.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {mod.description || 'Nenhuma descrição informada.'}
                  </p>
                </div>
              </div>

              {isArenaAdmin && (
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-1.5">
                  <button
                    id={`edit-modality-${mod.id}`}
                    onClick={() => handleOpenEdit(mod)}
                    className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer text-xs flex items-center gap-1"
                    title="Editar"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium pr-1">Editar</span>
                  </button>
                  <button
                    id={`delete-modality-${mod.id}`}
                    onClick={() => handleDelete(mod.id)}
                    className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingModality ? 'Editar Modalidade' : 'Cadastrar Nova Modalidade'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Nome da Modalidade *
                </label>
                <input
                  type="text"
                  required
                  id="modal-name-input"
                  value={modalForm.name}
                  onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                  placeholder="Ex: Beach Tennis, Futevôlei, Padel..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Ícone Representativo
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'Sun', label: 'Areia / Sol' },
                    { id: 'Volleyball', label: 'Vôlei' },
                    { id: 'Shield', label: 'Campo' },
                    { id: 'Trophy', label: 'Troféu' },
                    { id: 'Activity', label: 'Geral' },
                    { id: 'Flame', label: 'Competição' },
                    { id: 'Dumbbell', label: 'Treino' },
                  ].map((ic) => (
                    <button
                      type="button"
                      key={ic.id}
                      onClick={() => setModalForm({ ...modalForm, icon: ic.id })}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                        modalForm.icon === ic.id
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {getIconComponent(ic.id)}
                      <span className="text-[10px] truncate max-w-full">{ic.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  id="modal-desc-input"
                  value={modalForm.description}
                  onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                  placeholder="Detalhes ou orientações sobre a modalidade..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Status
                </label>
                <select
                  value={modalForm.status}
                  onChange={(e) => setModalForm({ ...modalForm, status: e.target.value as EntityStatus })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="ACTIVE">Ativa (Disponível para reservas e quadras)</option>
                  <option value="INACTIVE">Inativa (Oculta para novos agendamentos)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="save-modality-btn"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Salvando...' : editingModality ? 'Salvar Alterações' : 'Criar Modalidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
