import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { Reservation, Arena } from '../../types';
import {
  CalendarDays,
  Clock,
  MapPin,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  DollarSign,
  ShieldAlert,
  Info,
  ChevronRight,
  ArrowRight
} from 'lucide-react';

interface ClientMyReservationsPageProps {
  onNavigate: (path: string) => void;
}

export const ClientMyReservationsPage: React.FC<ClientMyReservationsPageProps> = ({ onNavigate }) => {
  const { user, activeArena, arenas } = useAuth();
  const [tab, setTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResForCancel, setSelectedResForCancel] = useState<Reservation | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<{ success?: string; error?: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadReservations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Security: Only fetch user's own reservations across arenas
      const res = await arenaService.getClientReservations(user.id);
      setReservations(res);
    } catch (err: any) {
      console.error('Error loading client reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [user?.id, activeArena?.id]);

  const nowIso = new Date().toISOString();

  // Split into Upcoming and History
  const upcomingReservations = reservations.filter(
    r => r.end_at >= nowIso && (r.status === 'CONFIRMED' || r.status === 'PENDING')
  );

  const historyReservations = reservations.filter(
    r => r.end_at < nowIso || r.status === 'COMPLETED' || r.status === 'CANCELLED' || r.status === 'NO_SHOW'
  );

  const displayList = tab === 'UPCOMING' ? upcomingReservations : historyReservations;

  // Handle Cancel Click
  const handleOpenCancelModal = (res: Reservation) => {
    setCancelFeedback(null);
    setSelectedResForCancel(res);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedResForCancel || !user) return;

    // Check cancellation rule against arena policy
    const resArena = arenas.find(a => a.id === selectedResForCancel.arena_id) || activeArena;
    if (!resArena) {
      setCancelFeedback({ error: 'Arena não identificada.' });
      return;
    }

    const cancelCheck = arenaService.canCancelReservation(selectedResForCancel, resArena);
    if (!cancelCheck.allowed) {
      setCancelFeedback({ error: cancelCheck.reason || 'Cancelamento fora do prazo permitido.' });
      return;
    }

    setCancelling(true);
    try {
      await arenaService.updateReservation(selectedResForCancel.id, {
        status: 'CANCELLED',
        notes: `Cancelado pelo cliente em ${new Date().toLocaleString('pt-BR')}`,
      });
      setCancelFeedback({ success: 'Reserva cancelada com sucesso.' });
      await loadReservations();
      setTimeout(() => {
        setCancelModalOpen(false);
        setSelectedResForCancel(null);
      }, 1200);
    } catch (err: any) {
      setCancelFeedback({ error: err?.message || 'Erro ao cancelar reserva.' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fadeIn pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Minhas Reservas</h1>
          <p className="text-xs text-slate-400">Acompanhe suas partidas agendadas e histórico esportivo</p>
        </div>

        <button
          onClick={() => onNavigate('/app/reservar')}
          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Nova Reserva</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
        <button
          id="tab-upcoming-reservations"
          onClick={() => setTab('UPCOMING')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
            tab === 'UPCOMING'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Próximas Partidas</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            tab === 'UPCOMING' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
          }`}>
            {upcomingReservations.length}
          </span>
        </button>

        <button
          id="tab-history-reservations"
          onClick={() => setTab('HISTORY')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
            tab === 'HISTORY'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Histórico de Jogos</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            tab === 'HISTORY' ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
          }`}>
            {historyReservations.length}
          </span>
        </button>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
          <p>Carregando suas reservas...</p>
        </div>
      ) : displayList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-xl">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              {tab === 'UPCOMING' ? 'Nenhuma reserva futura agendada' : 'Nenhum histórico encontrado'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {tab === 'UPCOMING'
                ? 'Escolha sua modalidade favorita e reserve seu próximo horário na quadra em poucos cliques.'
                : 'Suas partidas concluídas ou canceladas aparecerão aqui.'}
            </p>
          </div>
          {tab === 'UPCOMING' && (
            <div className="pt-2">
              <button
                onClick={() => onNavigate('/app/reservar')}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                Agendar Minha Primeira Partida
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayList.map((res) => {
            const resArena = arenas.find(a => a.id === res.arena_id) || activeArena;
            const startDate = new Date(res.start_at);
            const endDate = new Date(res.end_at);
            const dateFormatted = startDate.toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
            const startHourStr = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const endHourStr = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const cancelCheck = resArena
              ? arenaService.canCancelReservation(res, resArena)
              : { allowed: false, reason: 'Arena não encontrada', limitHours: 2 };

            return (
              <div
                key={res.id}
                id={`reservation-card-${res.id}`}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 hover:border-slate-700 transition"
              >
                {/* Header Badge Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      res.status === 'CONFIRMED'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : res.status === 'PENDING'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : res.status === 'CANCELLED'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {res.status === 'CONFIRMED' ? 'Confirmada' : res.status === 'CANCELLED' ? 'Cancelada' : res.status}
                    </span>

                    <span className="text-[11px] font-semibold text-slate-400">
                      {resArena?.name}
                    </span>
                  </div>

                  <span className="text-xs font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                    Pagar na arena
                  </span>
                </div>

                {/* Main Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <h3 className="text-base font-black text-white">{res.court?.name || 'Quadra Principal'}</h3>
                    <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                      {res.court?.modality?.name || 'Esporte na Areia'}
                    </p>
                  </div>

                  <div className="sm:text-right space-y-0.5">
                    <span className="text-xs text-slate-400 block capitalize">{dateFormatted}</span>
                    <span className="text-sm font-black text-white bg-slate-950 px-2.5 py-0.5 rounded-lg inline-block border border-slate-800">
                      {startHourStr} → {endHourStr}
                    </span>
                  </div>
                </div>

                {/* Footer Action Row */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Valor:</span>
                    <span className="text-sm font-black text-emerald-400">
                      R$ {res.amount.toFixed(2)}
                    </span>
                  </div>

                  {tab === 'UPCOMING' && res.status !== 'CANCELLED' && (
                    <div>
                      {cancelCheck.allowed ? (
                        <button
                          id={`cancel-res-btn-${res.id}`}
                          onClick={() => handleOpenCancelModal(res)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancelar Reserva</span>
                        </button>
                      ) : (
                        <span
                          title={cancelCheck.reason}
                          className="text-[11px] font-semibold text-slate-500 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 inline-flex items-center gap-1 cursor-help"
                        >
                          <Info className="w-3.5 h-3.5" />
                          <span>Prazo de cancelamento expirado</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancelModalOpen && selectedResForCancel && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 animate-fadeIn">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Cancelar Reserva?</h3>
              <p className="text-xs text-slate-400">
                Tem certeza que deseja cancelar sua reserva na quadra{' '}
                <strong className="text-white">{selectedResForCancel.court?.name}</strong>?
              </p>
            </div>

            {/* Warning policy box */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Data &amp; Horário:</span>
                <span className="font-bold text-white">
                  {new Date(selectedResForCancel.start_at).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(selectedResForCancel.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                A liberação do horário será disponibilizada para outros atletas.
              </p>
            </div>

            {cancelFeedback?.error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cancelFeedback.error}</span>
              </div>
            )}

            {cancelFeedback?.success && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{cancelFeedback.success}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelling}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                id="confirm-cancel-modal-btn"
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-xl text-xs shadow-md shadow-rose-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
