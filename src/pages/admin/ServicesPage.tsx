import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { Service } from '../../types';
import { 
  Briefcase, 
  Plus, 
  Clock, 
  DollarSign, 
  Edit3, 
  Trash2, 
  Sparkles,
  Tag,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ServiceModal } from '../../components/services/ServiceModal';

export const ServicesPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { activeArena } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadServices = async () => {
    if (!activeArena) return;
    setLoading(true);
    try {
      const data = await arenaService.getServices(activeArena.id);
      setServices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, [activeArena]);

  const handleOpenCreate = () => {
    setEditingService(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (svc: Service) => {
    setEditingService(svc);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await arenaService.deleteService(id);
      setDeleteConfirmId(null);
      loadServices();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Catálogo de Serviços & Aulas
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Etapa 6
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Aulas individuais, clínicas em grupo, locação de raquetes e serviços da arena
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/admin/financeiro')}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Painel Financeiro</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-teal-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Serviço</span>
          </button>
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs animate-pulse">
          Carregando catálogo de serviços...
        </div>
      ) : services.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((srv) => (
            <div
              key={srv.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4 hover:border-slate-700 transition flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-teal-300 transition">
                        {srv.name}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500">ID: {srv.id}</span>
                    </div>
                  </div>

                  <span className="text-base font-black text-emerald-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(srv.price)}
                  </span>
                </div>

                {srv.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {srv.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>{srv.duration_minutes || 60} min</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(srv)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    title="Editar serviço"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {deleteConfirmId === srv.id ? (
                    <div className="flex items-center gap-1 bg-rose-950/40 p-1 rounded-lg border border-rose-500/30">
                      <button
                        onClick={() => handleDelete(srv.id)}
                        className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-500 cursor-pointer"
                      >
                        Excluir
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-1 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(srv.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                      title="Excluir serviço"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <Briefcase className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">Nenhum serviço cadastrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Cadastre aulas avulsas, pacotes de treinamento ou aluguel de raquetes para comercializar na arena.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Cadastrar Primeiro Serviço
          </button>
        </div>
      )}

      {/* Service Modal */}
      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        arenaId={activeArena?.id || ''}
        service={editingService}
        onServiceSaved={loadServices}
      />
    </div>
  );
};
