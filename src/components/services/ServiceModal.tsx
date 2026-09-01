import React, { useState } from 'react';
import { 
  X, 
  Tag, 
  DollarSign, 
  Clock, 
  FileText, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Service } from '../../types';
import { arenaService } from '../../services/arena.service';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  arenaId: string;
  service?: Service | null;
  onServiceSaved: () => void;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  arenaId,
  service,
  onServiceSaved,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [price, setPrice] = useState<number>(service?.price || 0);
  const [durationMinutes, setDurationMinutes] = useState<number>(service?.duration_minutes || 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEditing = !!service;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome do serviço.');
      return;
    }
    if (price < 0) {
      setErrorMsg('O preço não pode ser negativo.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEditing && service) {
        await arenaService.updateService(service.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          price: Number(price),
          duration_minutes: Number(durationMinutes) || undefined,
        });
      } else {
        await arenaService.createService({
          arena_id: arenaId,
          name: name.trim(),
          description: description.trim() || undefined,
          price: Number(price),
          duration_minutes: Number(durationMinutes) || undefined,
          status: 'ACTIVE',
        });
      }

      onServiceSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar serviço.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEditing ? 'Editar Serviço / Aula' : 'Novo Serviço / Aula'}
              </h3>
              <p className="text-xs text-slate-400">
                Catálogo de serviços adicionais da arena
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Nome do Serviço / Aula
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Aula de Beach Tennis (Individual), Aluguel de Raquete Pro..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Price & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                Preço (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0,00"
                  value={price || ''}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-teal-400" />
                Duração (Minutos)
              </label>
              <input
                type="number"
                step="15"
                min="0"
                placeholder="60"
                value={durationMinutes || ''}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" />
              Descrição detalhada (Opcional)
            </label>
            <textarea
              rows={3}
              placeholder="Descreva o que está incluído no serviço, professor, equipamentos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-teal-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-teal-500/20 text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar Serviço' : 'Criar Serviço'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
