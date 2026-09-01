import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { Reservation, Court, Modality, Customer } from '../../types';
import { 
  BookmarkCheck, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Clock, 
  DollarSign, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RotateCcw,
  Eye,
  Check,
  ChevronDown
} from 'lucide-react';
import { RecordPaymentModal } from '../../components/finance/RecordPaymentModal';

export const ReservationsPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { activeArena, user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [modalities, setModalities] = useState<Modality[]>([]);
  
  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedResForPayment, setSelectedResForPayment] = useState<Reservation | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [courtFilter, setCourtFilter] = useState('ALL');
  const [modalityFilter, setModalityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    if (!activeArena) return;
    setLoading(true);
    try {
      const [res, crts, mods] = await Promise.all([
        arenaService.getReservations(activeArena.id),
        arenaService.getCourts(activeArena.id),
        arenaService.getModalities(activeArena.id),
      ]);
      setReservations(res);
      setCourts(crts);
      setModalities(mods);
    } catch (err) {
      console.error('Error loading reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeArena]);

  // Filter logic
  const filtered = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return reservations.filter(r => {
      // 1. Text Search
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = 
        r.customer?.full_name?.toLowerCase().includes(searchLower) ||
        r.customer?.phone?.includes(searchTerm) ||
        r.court?.name?.toLowerCase().includes(searchLower) ||
        r.id.toLowerCase().includes(searchLower);

      if (!matchSearch) return false;

      // 2. Period Filter
      const resDate = r.start_at.slice(0, 10);
      if (periodFilter === 'TODAY') {
        if (resDate !== todayStr) return false;
      } else if (periodFilter === '7_DAYS') {
        const d7Ago = new Date();
        d7Ago.setDate(d7Ago.getDate() - 6);
        const d7AgoStr = d7Ago.toISOString().split('T')[0];
        if (resDate < d7AgoStr || resDate > todayStr) return false;
      } else if (periodFilter === '30_DAYS') {
        const d30Ago = new Date();
        d30Ago.setDate(d30Ago.getDate() - 29);
        const d30AgoStr = d30Ago.toISOString().split('T')[0];
        if (resDate < d30AgoStr || resDate > todayStr) return false;
      } else if (periodFilter === 'CUSTOM') {
        if (customStartDate && resDate < customStartDate) return false;
        if (customEndDate && resDate > customEndDate) return false;
      }

      // 3. Court Filter
      if (courtFilter !== 'ALL' && r.court_id !== courtFilter) return false;

      // 4. Modality Filter
      if (modalityFilter !== 'ALL' && r.court?.modality_id !== modalityFilter) return false;

      // 5. Status Filter
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

      // 6. Payment Filter
      if (paymentFilter !== 'ALL' && r.payment_status !== paymentFilter) return false;

      return true;
    });
  }, [reservations, searchTerm, periodFilter, customStartDate, customEndDate, courtFilter, modalityFilter, statusFilter, paymentFilter]);

  // Filtered Summary Totals
  const totals = useMemo(() => {
    const totalCount = filtered.length;
    const validReservations = filtered.filter(r => r.status !== 'CANCELLED');
    const validCount = validReservations.length;
    const totalRevenue = validReservations.reduce((sum, r) => sum + (r.amount || 0), 0);
    const paidRevenue = validReservations
      .filter(r => r.payment_status === 'PAID')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    const pendingRevenue = validReservations
      .filter(r => r.payment_status === 'PENDING')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    return { totalCount, validCount, totalRevenue, paidRevenue, pendingRevenue };
  }, [filtered]);

  // Quick Action: Open Record Payment Modal
  const handleMarkAsPaid = (r: Reservation) => {
    setSelectedResForPayment(r);
    setIsPaymentModalOpen(true);
  };

  // Quick Action: Cancel
  const handleCancel = async (r: Reservation) => {
    if (!activeArena) return;
    try {
      await arenaService.updateReservation(r.id, { status: 'CANCELLED' }, activeArena.id);
      setActionFeedback({ type: 'success', message: 'Reserva cancelada com sucesso.' });
      await loadData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Erro ao cancelar reserva.' });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Feedback */}
      {actionFeedback && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold shadow-lg transition animate-fadeIn ${
          actionFeedback.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' 
            : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Gestão de Reservas</h1>
          <p className="text-xs text-slate-400">Histórico completo, filtros analíticos e controle financeiro operacional</p>
        </div>

        <button
          onClick={() => onNavigate('/admin/agenda')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>NOVA RESERVA NA AGENDA</span>
        </button>
      </div>

      {/* KPI Totals Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400">Reservas Filtradas</span>
          <div className="mt-2 text-2xl font-black text-white">{totals.totalCount}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{totals.validCount} válidas</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400">Faturamento Filtrado</span>
          <div className="mt-2 text-2xl font-black text-emerald-400">
            R$ {totals.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Sem cancelamentos</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400">Total Já Recebido</span>
          <div className="mt-2 text-2xl font-black text-blue-400">
            R$ {totals.paidRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Status PAGO</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs font-semibold text-slate-400">Pendente de Pagamento</span>
          <div className="mt-2 text-2xl font-black text-amber-400">
            R$ {totals.pendingRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">A receber</span>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        {/* Row 1: Search & Period Tabs */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por cliente, telefone, quadra ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setPeriodFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                periodFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setPeriodFilter('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                periodFilter === 'TODAY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriodFilter('7_DAYS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                periodFilter === '7_DAYS' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              7 dias
            </button>
            <button
              onClick={() => setPeriodFilter('30_DAYS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                periodFilter === '30_DAYS' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              30 dias
            </button>
            <button
              onClick={() => setPeriodFilter('CUSTOM')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                periodFilter === 'CUSTOM' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {periodFilter === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold">De:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-400 font-semibold">Até:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        )}

        {/* Row 2: Dropdown Selects */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* Quadra */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Quadra</label>
            <select
              value={courtFilter}
              onChange={(e) => setCourtFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Todas as Quadras</option>
              {courts.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Modalidade */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Modalidade</label>
            <select
              value={modalityFilter}
              onChange={(e) => setModalityFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Todas as Modalidades</option>
              {modalities.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Status Reserva */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Status da Reserva</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Todos os Status</option>
              <option value="CONFIRMED">Confirmadas</option>
              <option value="PENDING">Pendentes</option>
              <option value="COMPLETED">Concluídas</option>
              <option value="CANCELLED">Canceladas</option>
              <option value="NO_SHOW">Não Compareceu</option>
            </select>
          </div>

          {/* Status Pagamento */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Pagamento</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Todos</option>
              <option value="PAID">Pago</option>
              <option value="PENDING">Pendente</option>
              <option value="REFUNDED">Estornado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Cliente</th>
                <th className="px-5 py-3.5">Quadra / Modalidade</th>
                <th className="px-5 py-3.5">Data &amp; Horário</th>
                <th className="px-5 py-3.5">Valor</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Pagamento</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Nenhuma reserva encontrada com os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map((res) => {
                  const startTime = new Date(res.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const endTime = new Date(res.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const dateFormatted = new Date(res.start_at).toLocaleDateString('pt-BR');
                  const isPaid = res.payment_status === 'PAID';
                  const isCancelled = res.status === 'CANCELLED';

                  return (
                    <tr key={res.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-100">{res.customer?.full_name || 'Cliente'}</div>
                        <div className="text-[11px] text-slate-400">{res.customer?.phone}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-200">{res.court?.name}</div>
                        <div className="text-[11px] text-slate-400">{res.court?.modality?.name}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-200">{dateFormatted}</div>
                        <div className="text-[11px] text-slate-400">{startTime} às {endTime}</div>
                      </td>

                      <td className="px-5 py-3.5 font-black text-slate-100">
                        R$ {res.amount.toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          res.status === 'CONFIRMED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : res.status === 'COMPLETED'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : res.status === 'PENDING'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}>
                          {res.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isPaid
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          {res.payment_status} ({res.payment_method || 'PIX'})
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && !isCancelled && (
                            <button
                              onClick={() => handleMarkAsPaid(res)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer"
                              title="Marcar como Pago"
                            >
                              Receber
                            </button>
                          )}
                          {!isCancelled && res.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleCancel(res)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition cursor-pointer"
                              title="Cancelar Reserva"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedResForPayment(null);
        }}
        reservation={selectedResForPayment}
        onPaymentSuccess={() => {
          setActionFeedback({ type: 'success', message: 'Pagamento registrado no caixa com sucesso!' });
          loadData();
        }}
      />
    </div>
  );
};
