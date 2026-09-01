import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { Court, Modality, EntityStatus } from '../../types';
import { 
  Layers, 
  Plus, 
  DollarSign, 
  Users, 
  Edit3, 
  Trash2, 
  X, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Image as ImageIcon,
  Wrench,
  Ban
} from 'lucide-react';

export const CourtsPage: React.FC<{ onNavigate: (path: string) => void }> = () => {
  const { activeArena, profile } = useAuth();
  const isArenaAdmin = profile?.role === 'ARENA_ADMIN' || profile?.role === 'SUPER_ADMIN';

  const [courts, setCourts] = useState<Court[]>([]);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModality, setSelectedModality] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EntityStatus>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [modalForm, setModalForm] = useState<{
    name: string;
    modality_id: string;
    description: string;
    capacity: number;
    price: number;
    image_url: string;
    status: EntityStatus;
  }>({
    name: '',
    modality_id: '',
    description: '',
    capacity: 4,
    price: 80.0,
    image_url: '',
    status: 'ACTIVE',
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    if (!activeArena) return;
    setLoading(true);
    try {
      const [loadedCourts, loadedModalities] = await Promise.all([
        arenaService.getCourts(activeArena.id),
        arenaService.getModalities(activeArena.id),
      ]);
      setCourts(loadedCourts);
      setModalities(loadedModalities);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao carregar dados.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeArena]);

  const handleOpenCreate = () => {
    if (modalities.length === 0) {
      setNotification({
        type: 'error',
        message: 'Cadastre ao menos uma modalidade antes de criar uma quadra.',
      });
      return;
    }

    setEditingCourt(null);
    setModalForm({
      name: '',
      modality_id: modalities[0]?.id || '',
      description: '',
      capacity: 4,
      price: 90.0,
      image_url: 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=800&q=80',
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (court: Court) => {
    setEditingCourt(court);
    setModalForm({
      name: court.name,
      modality_id: court.modality_id,
      description: court.description || '',
      capacity: court.capacity || 4,
      price: court.price || 80.0,
      image_url: court.image_url || '',
      status: court.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArena) return;

    if (!modalForm.name.trim()) {
      setNotification({ type: 'error', message: 'O nome da quadra/campo é obrigatório.' });
      return;
    }
    if (!modalForm.modality_id) {
      setNotification({ type: 'error', message: 'Selecione uma modalidade válida.' });
      return;
    }

    setActionLoading(true);
    setNotification(null);

    try {
      if (editingCourt) {
        // Update
        await arenaService.updateCourt(editingCourt.id, {
          name: modalForm.name.trim(),
          modality_id: modalForm.modality_id,
          description: modalForm.description.trim(),
          capacity: modalForm.capacity,
          price: Number(modalForm.price),
          image_url: modalForm.image_url.trim() || null,
          status: modalForm.status,
        });
        setNotification({ type: 'success', message: 'Quadra atualizada com sucesso!' });
      } else {
        // Create
        await arenaService.createCourt({
          arena_id: activeArena.id,
          modality_id: modalForm.modality_id,
          name: modalForm.name.trim(),
          description: modalForm.description.trim(),
          capacity: modalForm.capacity,
          price: Number(modalForm.price),
          image_url: modalForm.image_url.trim() || null,
          status: modalForm.status,
        });
        setNotification({ type: 'success', message: 'Quadra cadastrada com sucesso!' });
      }

      setIsModalOpen(false);
      await loadData();
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao salvar quadra.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este espaço esportivo?')) return;

    setActionLoading(true);
    setNotification(null);

    try {
      await arenaService.deleteCourt(id);
      setNotification({ type: 'success', message: 'Quadra excluída com sucesso!' });
      await loadData();
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao excluir quadra.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickStatusChange = async (court: Court, nextStatus: EntityStatus) => {
    try {
      await arenaService.updateCourt(court.id, { status: nextStatus });
      await loadData();
      setNotification({ type: 'success', message: `Status de "${court.name}" alterado para ${nextStatus}.` });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Erro ao atualizar status.' });
    }
  };

  const filteredCourts = courts.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()));
    const matchesModality = selectedModality === 'ALL' || c.modality_id === selectedModality;
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesModality && matchesStatus;
  });

  const presetImages = [
    { label: 'Areia Coberta', url: 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=800&q=80' },
    { label: 'Areia Sunset', url: 'https://images.unsplash.com/photo-1628891435222-065925dcb365?w=800&q=80' },
    { label: 'Futevôlei Prime', url: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80' },
    { label: 'Campo Society', url: 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80' },
    { label: 'Society Noturno', url: 'https://images.unsplash.com/photo-1529900240041-52c3c6f89025?w=800&q=80' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Quadras e Campos</h2>
          <p className="text-xs text-slate-400">
            Espaços esportivos cadastrados para locação na {activeArena?.name || 'arena'}
          </p>
        </div>

        {isArenaAdmin && (
          <button
            id="create-court-btn"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Quadra / Campo</span>
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="search-court-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Modality Filter */}
          <select
            value={selectedModality}
            onChange={(e) => setSelectedModality(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
          >
            <option value="ALL">Todas as Modalidades</option>
            {modalities.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ativas
            </button>
            <button
              onClick={() => setStatusFilter('MAINTENANCE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'MAINTENANCE' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Manut.
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                statusFilter === 'INACTIVE' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inativas
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Courts */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Carregando quadras...</div>
      ) : filteredCourts.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/50 border border-slate-800 rounded-2xl p-8 space-y-2">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Nenhuma quadra ou campo encontrado</p>
          <p className="text-xs text-slate-500">Cadastre suas quadras e campos para disponibilizar agendamentos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourts.map((court) => (
            <div
              key={court.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transition group"
            >
              {court.image_url && (
                <div className="h-44 w-full overflow-hidden relative bg-slate-950">
                  <img
                    src={court.image_url}
                    alt={court.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                  
                  {/* Status Badge */}
                  <span className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md ${
                    court.status === 'ACTIVE'
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                      : court.status === 'MAINTENANCE'
                      ? 'bg-amber-950/80 text-amber-400 border-amber-500/30'
                      : 'bg-slate-950/80 text-slate-400 border-slate-700'
                  }`}>
                    {court.status === 'ACTIVE' ? 'Ativa' : court.status === 'MAINTENANCE' ? 'Manutenção' : 'Inativa'}
                  </span>

                  {/* Modality Tag */}
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-slate-900/90 text-emerald-400 border border-slate-700 backdrop-blur-md">
                    {court.modality?.name || 'Esporte'}
                  </span>
                </div>
              )}

              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                    {court.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {court.description || 'Sem descrição cadastrada.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Locação / Hora</span>
                      <span className="text-base font-extrabold text-white">
                        R$ {Number(court.price).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Capacidade</span>
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1 justify-end">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {court.capacity || 4} atletas
                      </span>
                    </div>
                  </div>

                  {/* Management Buttons */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-xs">
                    {/* Status quick toggle */}
                    <div className="flex items-center gap-1">
                      {court.status !== 'ACTIVE' && (
                        <button
                          onClick={() => handleQuickStatusChange(court, 'ACTIVE')}
                          title="Ativar Quadra"
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition cursor-pointer text-[11px]"
                        >
                          Ativar
                        </button>
                      )}
                      {court.status !== 'MAINTENANCE' && (
                        <button
                          onClick={() => handleQuickStatusChange(court, 'MAINTENANCE')}
                          title="Colocar em Manutenção"
                          className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition cursor-pointer text-[11px]"
                        >
                          Manutenção
                        </button>
                      )}
                    </div>

                    {isArenaAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button
                          id={`edit-court-${court.id}`}
                          onClick={() => handleOpenEdit(court)}
                          className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer text-xs flex items-center gap-1"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium pr-1">Editar</span>
                        </button>
                        <button
                          id={`delete-court-${court.id}`}
                          onClick={() => handleDelete(court.id)}
                          className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT COURT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scaleUp my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingCourt ? 'Editar Quadra / Campo' : 'Cadastrar Nova Quadra / Campo'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Nome da Quadra / Campo *
                  </label>
                  <input
                    type="text"
                    required
                    id="court-name-input"
                    value={modalForm.name}
                    onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                    placeholder="Ex: Quadra 01 - Areia Central (Coberta)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Modalidade Esportiva *
                  </label>
                  <select
                    required
                    id="court-modality-select"
                    value={modalForm.modality_id}
                    onChange={(e) => setModalForm({ ...modalForm, modality_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                  >
                    {modalities.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Status Operacional
                  </label>
                  <select
                    value={modalForm.status}
                    onChange={(e) => setModalForm({ ...modalForm, status: e.target.value as EntityStatus })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="ACTIVE">Ativa (Disponível para reservas)</option>
                    <option value="MAINTENANCE">Em Manutenção (Bloqueada)</option>
                    <option value="INACTIVE">Inativa (Desativada)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Preço por Hora (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      id="court-price-input"
                      value={modalForm.price}
                      onChange={(e) => setModalForm({ ...modalForm, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Capacidade Recomendada
                  </label>
                  <input
                    type="number"
                    min="1"
                    id="court-capacity-input"
                    value={modalForm.capacity}
                    onChange={(e) => setModalForm({ ...modalForm, capacity: parseInt(e.target.value) || 4 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                    placeholder="Ex: 4 para tênis, 14 para society"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Descrição e Detalhes da Quadra
                  </label>
                  <textarea
                    rows={2}
                    id="court-description-input"
                    value={modalForm.description}
                    onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                    placeholder="Informações sobre tipo de piso, iluminação, cobertura, etc."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-slate-300 font-semibold mb-1">
                    URL da Foto / Imagem da Quadra
                  </label>
                  <input
                    type="url"
                    id="court-image-input"
                    value={modalForm.image_url}
                    onChange={(e) => setModalForm({ ...modalForm, image_url: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                  />
                  
                  {/* Quick image presets */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 self-center">Sugestões:</span>
                    {presetImages.map((img) => (
                      <button
                        type="button"
                        key={img.label}
                        onClick={() => setModalForm({ ...modalForm, image_url: img.url })}
                        className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
                      >
                        {img.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="save-court-btn"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Salvando...' : editingCourt ? 'Salvar Alterações' : 'Criar Quadra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
