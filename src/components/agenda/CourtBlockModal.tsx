import React, { useState, useEffect } from 'react';
import { X, Lock, AlertCircle, Trash2, Calendar, Clock, ShieldAlert } from 'lucide-react';
import { Court, CourtBlock } from '../../types';
import { arenaService } from '../../services/arena.service';

interface CourtBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  arenaId: string;
  courts: Court[];
  initialData?: Partial<CourtBlock> | null;
}

const COMMON_REASONS = [
  'Manutenção / Nivelamento de Areia',
  'Chuva / Condições Climáticas',
  'Evento Corporativo / Torneio',
  'Aula da Escolinha / Treino Fixo',
  'Reforma / Troca de Iluminação',
  'Outro Motivo Operacional',
];

export const CourtBlockModal: React.FC<CourtBlockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  arenaId,
  courts,
  initialData,
}) => {
  const [courtId, setCourtId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('14:00');
  const [endTime, setEndTime] = useState<string>('16:00');
  const [reason, setReason] = useState<string>(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);

    if (initialData) {
      if (initialData.court_id) setCourtId(initialData.court_id);
      else if (courts.length > 0) setCourtId(courts[0].id);

      if (initialData.start_at) {
        const d = new Date(initialData.start_at);
        setDate(d.toISOString().split('T')[0]);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        setStartTime(`${hh}:${mm}`);
      } else {
        setDate(new Date().toISOString().split('T')[0]);
        setStartTime('14:00');
      }

      if (initialData.end_at) {
        const d = new Date(initialData.end_at);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        setEndTime(`${hh}:${mm}`);
      } else {
        setEndTime('16:00');
      }

      if (initialData.reason) {
        if (COMMON_REASONS.includes(initialData.reason)) {
          setReason(initialData.reason);
          setCustomReason('');
        } else {
          setReason('Outro Motivo Operacional');
          setCustomReason(initialData.reason);
        }
      }
      setNotes(initialData.notes || '');
    } else {
      if (courts.length > 0) setCourtId(courts[0].id);
      setDate(new Date().toISOString().split('T')[0]);
      setStartTime('14:00');
      setEndTime('16:00');
      setReason(COMMON_REASONS[0]);
      setCustomReason('');
      setNotes('');
    }
  }, [isOpen, initialData, courts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!courtId) {
      setErrorMessage('Selecione uma quadra.');
      return;
    }
    if (!date || !startTime || !endTime) {
      setErrorMessage('Preencha a data e os horários de início e término.');
      return;
    }

    const finalReason = reason === 'Outro Motivo Operacional' && customReason.trim()
      ? customReason.trim()
      : reason;

    if (!finalReason) {
      setErrorMessage('Informe o motivo do bloqueio.');
      return;
    }

    const startAtISO = `${date}T${startTime}:00.000Z`;
    const endAtISO = `${date}T${endTime}:00.000Z`;

    if (new Date(endAtISO).getTime() <= new Date(startAtISO).getTime()) {
      setErrorMessage('O horário de término deve ser posterior ao horário de início.');
      return;
    }

    setLoading(true);
    try {
      await arenaService.createCourtBlock({
        arena_id: arenaId,
        court_id: courtId,
        start_at: startAtISO,
        end_at: endAtISO,
        reason: finalReason,
        notes: notes.trim() || null,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao criar bloqueio.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (!window.confirm('Deseja realmente remover este bloqueio e liberar o horário na grade?')) return;
    setLoading(true);
    try {
      await arenaService.deleteCourtBlock(initialData.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao remover bloqueio.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scaleUp max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {initialData?.id ? 'Gerenciar Bloqueio de Quadra' : 'Bloquear Horário na Grade'}
              </h3>
              <p className="text-xs text-slate-400">
                Impedir agendamentos de clientes por manutenção, clima ou eventos
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

        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form id="court-block-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Quadra / Campo *</label>
            <select
              id="block-court-select"
              disabled={Boolean(initialData?.id)}
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
            >
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.modality?.name || 'Modalidade'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Data *</label>
              <input
                id="block-date-input"
                type="date"
                disabled={Boolean(initialData?.id)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Início *</label>
              <input
                id="block-start-time"
                type="time"
                step="1800"
                disabled={Boolean(initialData?.id)}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Término *</label>
              <input
                id="block-end-time"
                type="time"
                step="1800"
                disabled={Boolean(initialData?.id)}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Motivo do Bloqueio *</label>
            <select
              id="block-reason-select"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {reason === 'Outro Motivo Operacional' && (
              <input
                type="text"
                placeholder="Especifique o motivo..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Observações adicionais</label>
            <textarea
              id="block-notes-input"
              rows={2}
              placeholder="Detalhes para a equipe..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </form>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          {initialData?.id ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Remover Bloqueio</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            {!initialData?.id && (
              <button
                type="submit"
                form="court-block-form"
                disabled={loading}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50 shadow-lg shadow-amber-500/20"
              >
                {loading ? 'Salvando...' : 'Aplicar Bloqueio'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
