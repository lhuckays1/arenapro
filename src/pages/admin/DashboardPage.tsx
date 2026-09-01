import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { DiagnosticTestsModal } from '../../components/DiagnosticTestsModal';
import { 
  DashboardAnalytics, 
  PeriodFilter, 
  Reservation, 
  Court, 
  Customer, 
  Modality, 
  CourtBlock 
} from '../../types';
import {
  TrendingUp,
  Calendar,
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  Layers,
  ArrowUpRight,
  Plus,
  BarChart3,
  Percent,
  UserCheck,
  UserPlus,
  AlertTriangle,
  Flame,
  Activity,
  ChevronRight,
  Filter,
  RefreshCw,
  Ban,
  Check,
  Shield,
  HelpCircle
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { activeArena } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>('TODAY');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quick Action Modal States
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showTestsModal, setShowTestsModal] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for modals
  const [clientForm, setClientForm] = useState({ fullName: '', phone: '', email: '', notes: '' });
  const [blockForm, setBlockForm] = useState({
    courtId: '',
    date: new Date().toISOString().split('T')[0],
    startHour: '14:00',
    endHour: '16:00',
    reason: 'Manutenção / Nivelamento',
    notes: '',
  });

  const loadData = async (isRefresh = false) => {
    if (!activeArena) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [data, crts] = await Promise.all([
        arenaService.getDashboardAnalytics(activeArena.id, period, customStart, customEnd),
        arenaService.getCourts(activeArena.id),
      ]);
      setAnalytics(data);
      setCourts(crts.filter(c => c.status === 'ACTIVE'));
      if (crts.length > 0 && !blockForm.courtId) {
        setBlockForm(prev => ({ ...prev, courtId: crts[0].id }));
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeArena, period, customStart, customEnd]);

  // Handle Mark as Paid quick action
  const handleMarkAsPaid = async (reservation: Reservation) => {
    if (!activeArena) return;
    try {
      await arenaService.updateReservation(
        reservation.id,
        { payment_status: 'PAID' },
        activeArena.id
      );
      setFeedback({ type: 'success', message: `Reserva de ${reservation.customer?.full_name || 'Cliente'} marcada como PAGA com sucesso.` });
      await loadData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao atualizar pagamento.' });
    }
  };

  // Handle Create Quick Client
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArena || !clientForm.fullName || !clientForm.phone) {
      setFeedback({ type: 'error', message: 'Preencha o nome e telefone do cliente.' });
      return;
    }

    try {
      await arenaService.createCustomer({
        arena_id: activeArena.id,
        user_id: null,
        full_name: clientForm.fullName,
        phone: clientForm.phone,
        email: clientForm.email || null,
        notes: clientForm.notes || null,
        status: 'ACTIVE',
      });
      setFeedback({ type: 'success', message: `Cliente ${clientForm.fullName} cadastrado com sucesso!` });
      setShowNewClientModal(false);
      setClientForm({ fullName: '', phone: '', email: '', notes: '' });
      await loadData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao cadastrar cliente.' });
    }
  };

  // Handle Create Court Block
  const handleCreateCourtBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArena || !blockForm.courtId || !blockForm.date) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos do bloqueio.' });
      return;
    }

    const startAt = `${blockForm.date}T${blockForm.startHour}:00.000Z`;
    const endAt = `${blockForm.date}T${blockForm.endHour}:00.000Z`;

    try {
      await arenaService.createCourtBlock({
        arena_id: activeArena.id,
        court_id: blockForm.courtId,
        start_at: startAt,
        end_at: endAt,
        reason: blockForm.reason,
        notes: blockForm.notes || null,
      });
      setFeedback({ type: 'success', message: 'Bloqueio de quadra registrado com sucesso!' });
      setShowBlockModal(false);
      await loadData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao criar bloqueio.' });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold shadow-lg transition animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' 
            : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)} 
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header Banner & Period Controls */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="space-y-1.5 z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              Operação Ao Vivo
            </span>
            <span className="text-xs text-slate-400">
              Horário: <strong className="text-slate-200">{activeArena?.opening_time} às {activeArena?.closing_time}</strong>
            </span>
            <span className="text-xs text-slate-400">• Timezone: <strong className="text-slate-200">{activeArena?.timezone || 'America/Sao_Paulo'}</strong></span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {activeArena?.name}
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            Inteligência operacional em tempo real: ocupação, faturamento e demanda.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 z-10 w-full lg:w-auto">
          <div className="bg-slate-950/80 p-1 rounded-2xl border border-slate-800 flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
            <button
              id="dash-period-today"
              onClick={() => setPeriod('TODAY')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                period === 'TODAY'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Hoje
            </button>
            <button
              id="dash-period-7days"
              onClick={() => setPeriod('7_DAYS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                period === '7_DAYS'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              7 dias
            </button>
            <button
              id="dash-period-30days"
              onClick={() => setPeriod('30_DAYS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                period === '30_DAYS'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              30 dias
            </button>
            <button
              id="dash-period-custom"
              onClick={() => setPeriod('CUSTOM')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                period === 'CUSTOM'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Personalizado
            </button>
          </div>

          <button
            onClick={() => setShowTestsModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800/90 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 text-xs font-bold transition cursor-pointer"
            title="Executar Auditoria de 11 Testes de Integridade"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Auditar Sistema (11 Testes)</span>
            <span className="sm:hidden">11 Testes</span>
          </button>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition cursor-pointer border border-slate-700"
            title="Recarregar Indicadores"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'CUSTOM' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Filtrar período customizado:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-500">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Section: Quick Actions Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          id="dash-btn-new-reservation"
          onClick={() => onNavigate('/admin/agenda')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/10 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>NOVA RESERVA</span>
        </button>

        <button
          id="dash-btn-new-customer"
          onClick={() => setShowNewClientModal(true)}
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs shadow-lg transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-purple-400" />
          <span>NOVO CLIENTE</span>
        </button>

        <button
          id="dash-btn-block-court"
          onClick={() => setShowBlockModal(true)}
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs shadow-lg transition cursor-pointer"
        >
          <Ban className="w-4 h-4 text-amber-400" />
          <span>BLOQUEAR QUADRA</span>
        </button>

        <button
          id="dash-btn-view-agenda"
          onClick={() => onNavigate('/admin/agenda')}
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs shadow-lg transition cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-blue-400" />
          <span>VER AGENDA</span>
        </button>
      </div>

      {/* SECTION 1: TODAY'S HIGHLIGHTS ("Como está minha arena hoje?") */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">Indicadores de Hoje</h2>
          </div>
          <span className="text-xs text-slate-400">Dados consolidados do dia atual</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Card 1: Reservas Hoje */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 md:p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Reservas Hoje</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl md:text-3xl font-black text-white">
                {analytics?.todayReservationsCount ?? 0}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Agendamentos para a data atual
            </p>
          </div>

          {/* Card 2: Faturamento Hoje */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 md:p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Faturamento Hoje</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl md:text-3xl font-black text-emerald-400">
                R$ {(analytics?.todayRevenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Somatório de reservas válidas
            </p>
          </div>

          {/* Card 3: Ocupação Hoje */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 md:p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Ocupação Hoje</span>
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl md:text-3xl font-black text-white">
                {analytics?.todayOccupancyPercent ?? 0}%
              </span>
            </div>
            <div className="mt-2 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${analytics?.todayOccupancyPercent ?? 0}%` }}
              />
            </div>
          </div>

          {/* Card 4: Cancelamentos Hoje */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 md:p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Cancelamentos Hoje</span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className={`text-2xl md:text-3xl font-black ${
                (analytics?.todayCancellationsCount ?? 0) > 0 ? 'text-rose-400' : 'text-white'
              }`}>
                {analytics?.todayCancellationsCount ?? 0}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {analytics?.todayCancellationsCount === 0 ? 'Nenhum cancelamento hoje' : 'Cancelamentos registrados'}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: PERIOD INDICATORS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Indicadores do Período ({period === 'TODAY' ? 'Hoje' : period === '7_DAYS' ? 'Últimos 7 dias' : period === '30_DAYS' ? 'Últimos 30 dias' : 'Personalizado'})
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {analytics?.startDate} até {analytics?.endDate}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {/* Total de Reservas */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg">
            <span className="text-xs font-semibold text-slate-400">Total de Reservas</span>
            <div className="mt-2 text-xl font-bold text-white">
              {analytics?.periodReservationsCount ?? 0}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {analytics?.periodValidReservationsCount ?? 0} válidas
            </span>
          </div>

          {/* Faturamento do Período */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg">
            <span className="text-xs font-semibold text-slate-400">Faturamento</span>
            <div className="mt-2 text-xl font-bold text-emerald-400">
              R$ {(analytics?.periodRevenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Sem cancelamentos
            </span>
          </div>

          {/* Ticket Médio */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg">
            <span className="text-xs font-semibold text-slate-400">Ticket Médio</span>
            <div className="mt-2 text-xl font-bold text-blue-400">
              R$ {(analytics?.periodAverageTicket ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              por reserva válida
            </span>
          </div>

          {/* Novos Clientes */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg">
            <span className="text-xs font-semibold text-slate-400">Novos Clientes</span>
            <div className="mt-2 text-xl font-bold text-purple-400">
              {analytics?.periodNewCustomersCount ?? 0}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Cadastrados no período
            </span>
          </div>

          {/* Clientes Recorrentes */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold text-slate-400">Clientes Recorrentes</span>
            <div className="mt-2 text-xl font-bold text-amber-400">
              {analytics?.periodRecurringCustomersCount ?? 0}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              &ge; 2 reservas válidas
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: GRAPHS & BREAKDOWNS (Ocupação por Dia e Faturamento por Dia) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graph 1: Ocupação por Dia */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-100">Taxa de Ocupação Diária</h3>
              </div>
              <p className="text-xs text-slate-400">
                Horas reservadas vs. Horas operacionais disponíveis
              </p>
            </div>
            <span className="text-xs font-extrabold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-xl border border-teal-500/20">
              Média: {analytics?.periodAverageOccupancy ?? 0}%
            </span>
          </div>

          {(!analytics?.dailyOccupancy || analytics.dailyOccupancy.length === 0) ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Ainda não existem reservas suficientes para gerar este indicador.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {analytics.dailyOccupancy.map((day) => (
                <div key={day.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 w-24 truncate">{day.label}</span>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>{day.reservedHours.toFixed(1)}h / {day.availableHours.toFixed(1)}h</span>
                      <span className="font-bold text-white w-10 text-right">{day.occupancyPercent}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        day.occupancyPercent >= 80 
                          ? 'bg-emerald-400' 
                          : day.occupancyPercent >= 50 
                          ? 'bg-teal-400' 
                          : day.occupancyPercent > 0 
                          ? 'bg-blue-400' 
                          : 'bg-transparent'
                      }`}
                      style={{ width: `${Math.max(2, day.occupancyPercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Graph 2: Faturamento por Dia */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Faturamento por Dia</h3>
              </div>
              <p className="text-xs text-slate-400">
                Receita bruta diária de reservas não canceladas
              </p>
            </div>
            <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
              Total: R$ {(analytics?.periodRevenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {(!analytics?.dailyRevenue || analytics.dailyRevenue.length === 0) ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Ainda não existem reservas suficientes para gerar este indicador.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {analytics.dailyRevenue.map((day) => {
                const maxRevenue = Math.max(1, ...(analytics.dailyRevenue.map(d => d.revenue)));
                const pct = Math.round((day.revenue / maxRevenue) * 100);
                return (
                  <div key={day.date} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 w-24 truncate">{day.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{day.reservationsCount} reservas</span>
                        <span className="font-bold text-emerald-400 w-20 text-right">
                          R$ {day.revenue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(day.revenue > 0 ? 3 : 0, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: RESERVAS DE HOJE & QUADRAS MAIS UTILIZADAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reservas de Hoje (Lista Operacional) */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Reservas de Hoje</h3>
              </div>
              <p className="text-xs text-slate-400">Lista cronológica operacional do dia</p>
            </div>
            <button
              onClick={() => onNavigate('/admin/reservas')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todas</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {(!analytics?.todayReservationsList || analytics.todayReservationsList.length === 0) ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Nenhuma reserva agendada para hoje.
            </div>
          ) : (
            <div className="space-y-2.5">
              {analytics.todayReservationsList.map((res) => {
                const startTime = new Date(res.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const endTime = new Date(res.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const isPaid = res.payment_status === 'PAID';
                const isCancelled = res.status === 'CANCELLED';

                return (
                  <div
                    key={res.id}
                    className={`p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      isCancelled ? 'opacity-50 line-through' : 'hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-extrabold">
                        {startTime}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-200">
                          {res.customer?.full_name || 'Cliente'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {res.court?.name} • {startTime} às {endTime}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-left sm:text-right">
                        <span className="text-xs font-black text-slate-100 block">
                          R$ {res.amount.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPaid
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}>
                            {isPaid ? 'PAGO' : 'PENDENTE'}
                          </span>
                          {isCancelled && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              CANCELADA
                            </span>
                          )}
                        </div>
                      </div>

                      {!isPaid && !isCancelled && (
                        <button
                          onClick={() => handleMarkAsPaid(res)}
                          title="Marcar como Pago"
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer"
                        >
                          Receber
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quadras Mais Utilizadas & Horários de Maior Demanda */}
        <div className="space-y-6">
          {/* Ranking: Quadras Mais Utilizadas */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Utilização das Quadras</h3>
              </div>
              <span className="text-[11px] text-slate-400">No período</span>
            </div>

            {(!analytics?.courtUtilization || analytics.courtUtilization.length === 0) ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Nenhuma quadra ativa cadastrada.
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.courtUtilization.map((c, idx) => (
                  <div key={c.courtId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">
                        {idx + 1}. {c.courtName}
                      </span>
                      <span className="font-bold text-emerald-400">
                        {c.utilizationRate}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, c.utilizationRate)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Horários de Maior Demanda */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Horários Mais Procurados</h3>
              </div>
              <span className="text-[11px] text-slate-400">Picos</span>
            </div>

            {(!analytics?.peakHours || analytics.peakHours.filter(p => p.count > 0).length === 0) ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Ainda não existem reservas para mapear horários de pico.
              </div>
            ) : (
              <div className="space-y-2.5">
                {analytics.peakHours.filter(p => p.count > 0).slice(0, 5).map((ph) => (
                  <div key={ph.hour} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-300">{ph.hour}</span>
                      <span className="text-slate-400 font-semibold">{ph.count} reservas</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, ph.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: NOVO CLIENTE */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Novo Cliente</h3>
              </div>
              <button 
                onClick={() => setShowNewClientModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo"
                  value={clientForm.fullName}
                  onChange={(e) => setClientForm({ ...clientForm, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Telefone / WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-8888"
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail (opcional)</label>
                <input
                  type="email"
                  placeholder="cliente@exemplo.com"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Mensalista de futebol nas terças-feiras..."
                  value={clientForm.notes}
                  onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 cursor-pointer"
                >
                  Cadastrar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BLOQUEAR QUADRA */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Bloquear Quadra</h3>
              </div>
              <button 
                onClick={() => setShowBlockModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCourtBlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Selecione a Quadra *</label>
                <select
                  required
                  value={blockForm.courtId}
                  onChange={(e) => setBlockForm({ ...blockForm, courtId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {courts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.modality?.name || 'Quadra'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Data do Bloqueio *</label>
                <input
                  type="date"
                  required
                  value={blockForm.date}
                  onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Início (Horário)</label>
                  <input
                    type="time"
                    required
                    value={blockForm.startHour}
                    onChange={(e) => setBlockForm({ ...blockForm, startHour: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Fim (Horário)</label>
                  <input
                    type="time"
                    required
                    value={blockForm.endHour}
                    onChange={(e) => setBlockForm({ ...blockForm, endHour: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Motivo do Bloqueio *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Manutenção da areia / Clima chuvoso / Evento Privado"
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Confirmar Bloqueio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: 11 TESTES DE INTEGRIDADE */}
      {activeArena && (
        <DiagnosticTestsModal
          arenaId={activeArena.id}
          arenaName={activeArena.name}
          isOpen={showTestsModal}
          onClose={() => setShowTestsModal(false)}
        />
      )}
    </div>
  );
};
