import React, {
  useEffect,
  useState,
} from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';

import { DiagnosticTestsModal } from '../../components/DiagnosticTestsModal';

import {
  DashboardAnalytics,
  PeriodFilter,
  Reservation,
  Court,
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
} from 'lucide-react';

import {
  addCalendarDays,
  buildArenaDateTime,
  getTodayArenaDate,
} from '../../utils/agendaDate';

interface DashboardPageProps {
  onNavigate: (
    path: string
  ) => void;
}

export const DashboardPage: React.FC<
  DashboardPageProps
> = ({
  onNavigate,
}) => {

  const {
    activeArena,
  } = useAuth();

  // ==========================================================
  // ANALYTICS
  // ==========================================================

  const [
    period,
    setPeriod,
  ] =
    useState<PeriodFilter>(
      'TODAY'
    );

  const [
    customStart,
    setCustomStart,
  ] =
    useState<string>('');

  const [
    customEnd,
    setCustomEnd,
  ] =
    useState<string>('');

  const [
    analytics,
    setAnalytics,
  ] =
    useState<DashboardAnalytics | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState<boolean>(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState<boolean>(
      false
    );

  // ==========================================================
  // MODALS
  // ==========================================================

  const [
    showNewClientModal,
    setShowNewClientModal,
  ] =
    useState<boolean>(
      false
    );

  const [
    showBlockModal,
    setShowBlockModal,
  ] =
    useState<boolean>(
      false
    );

  const [
    showTestsModal,
    setShowTestsModal,
  ] =
    useState<boolean>(
      false
    );

  // ==========================================================
  // COURTS
  // ==========================================================

  const [
    courts,
    setCourts,
  ] =
    useState<Court[]>([]);

  // ==========================================================
  // FEEDBACK
  // ==========================================================

  const [
    feedback,
    setFeedback,
  ] =
    useState<{
      type:
        | 'success'
        | 'error';
      message: string;
    } | null>(
      null
    );

  // ==========================================================
  // CLIENT FORM
  // ==========================================================

  const [
    clientForm,
    setClientForm,
  ] =
    useState({
      fullName: '',
      phone: '',
      email: '',
      notes: '',
    });

  // ==========================================================
  // BLOCK FORM
  // ==========================================================

  const [
    blockForm,
    setBlockForm,
  ] =
    useState({
      courtId: '',
      date:
        getTodayArenaDate(),
      startHour:
        '14:00',
      endHour:
        '16:00',
      reason:
        'Manutenção / Nivelamento',
      notes: '',
    });

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadData = async (
    isRefresh = false
  ) => {

    if (!activeArena) {
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {

      const [
        data,
        crts,
      ] =
        await Promise.all([
          arenaService.getDashboardAnalytics(
            activeArena.id,
            period,
            customStart,
            customEnd
          ),

          arenaService.getCourts(
            activeArena.id
          ),
        ]);

      setAnalytics(
        data
      );

      const activeCourts =
        crts.filter(
          (court) =>
            court.status ===
            'ACTIVE'
        );

      setCourts(
        activeCourts
      );

      if (
        activeCourts.length >
          0 &&
        !blockForm.courtId
      ) {

        setBlockForm(
          (current) => ({
            ...current,
            courtId:
              activeCourts[0]
                .id,
          })
        );

      }

    } catch (
      error: any
    ) {

      console.error(
        'Erro ao carregar Dashboard:',
        error
      );

      setFeedback({
        type:
          'error',
        message:
          error?.message ||
          'Erro ao carregar os indicadores.',
      });

    } finally {

      setLoading(false);
      setRefreshing(false);

    }
  };

  useEffect(() => {

    loadData();

  }, [
    activeArena,
    period,
    customStart,
    customEnd,
  ]);

  // ==========================================================
  // MARK AS PAID
  // ==========================================================

  const handleMarkAsPaid =
    async (
      reservation: Reservation
    ) => {

      if (!activeArena) {
        return;
      }

      try {

        await arenaService.updateReservation(
          reservation.id,
          {
            payment_status:
              'PAID',
          },
          activeArena.id
        );

        setFeedback({
          type:
            'success',
          message:
            `Reserva de ${
              reservation
                .customer
                ?.full_name ||
              'Cliente'
            } marcada como paga.`,
        });

        await loadData(
          true
        );

      } catch (
        error: any
      ) {

        setFeedback({
          type:
            'error',
          message:
            error?.message ||
            'Erro ao atualizar pagamento.',
        });

      }
    };

  // ==========================================================
  // CREATE CUSTOMER
  // ==========================================================

  const handleCreateCustomer =
    async (
      event: React.FormEvent
    ) => {

      event.preventDefault();

      if (
        !activeArena ||
        !clientForm.fullName.trim() ||
        !clientForm.phone.trim()
      ) {

        setFeedback({
          type:
            'error',
          message:
            'Preencha o nome e telefone do cliente.',
        });

        return;
      }

      try {

        await arenaService.createCustomer({
          arena_id:
            activeArena.id,

          user_id:
            null,

          full_name:
            clientForm.fullName.trim(),

          phone:
            clientForm.phone.trim(),

          email:
            clientForm.email.trim() ||
            null,

          notes:
            clientForm.notes.trim() ||
            null,

          status:
            'ACTIVE',
        });

        setFeedback({
          type:
            'success',
          message:
            `Cliente ${clientForm.fullName} cadastrado com sucesso!`,
        });

        setShowNewClientModal(
          false
        );

        setClientForm({
          fullName: '',
          phone: '',
          email: '',
          notes: '',
        });

        await loadData(
          true
        );

      } catch (
        error: any
      ) {

        setFeedback({
          type:
            'error',
          message:
            error?.message ||
            'Erro ao cadastrar cliente.',
        });

      }
    };

  // ==========================================================
  // CREATE COURT BLOCK
  // ==========================================================

  const handleCreateCourtBlock =
    async (
      event: React.FormEvent
    ) => {

      event.preventDefault();

      if (
        !activeArena ||
        !blockForm.courtId ||
        !blockForm.date ||
        !blockForm.startHour ||
        !blockForm.endHour
      ) {

        setFeedback({
          type:
            'error',
          message:
            'Preencha todos os campos do bloqueio.',
        });

        return;
      }

      const [
        startHour,
        startMinute,
      ] =
        blockForm.startHour
          .split(':')
          .map(Number);

      const [
        endHour,
        endMinute,
      ] =
        blockForm.endHour
          .split(':')
          .map(Number);

      const startMinutes =
        startHour * 60 +
        startMinute;

      const endMinutes =
        endHour * 60 +
        endMinute;

      if (
        endMinutes ===
        startMinutes
      ) {

        setFeedback({
          type:
            'error',
          message:
            'O horário de término deve ser diferente do início.',
        });

        return;
      }

      /*
       * Permite bloqueio:
       *
       * 23:00 -> 00:00
       *
       * com término no dia seguinte.
       */

      const endDate =
        endMinutes <=
          startMinutes
          ? addCalendarDays(
              blockForm.date,
              1
            )
          : blockForm.date;

      const startAt =
        buildArenaDateTime(
          blockForm.date,
          blockForm.startHour
        );

      const endAt =
        buildArenaDateTime(
          endDate,
          blockForm.endHour
        );

      try {

        await arenaService.createCourtBlock({
          arena_id:
            activeArena.id,

          court_id:
            blockForm.courtId,

          start_at:
            startAt,

          end_at:
            endAt,

          reason:
            blockForm.reason.trim() ||
            'Bloqueio operacional',

          notes:
            blockForm.notes.trim() ||
            null,
        });

        setFeedback({
          type:
            'success',
          message:
            'Bloqueio de quadra registrado com sucesso!',
        });

        setShowBlockModal(
          false
        );

        setBlockForm(
          (current) => ({
            ...current,
            date:
              getTodayArenaDate(),
            startHour:
              '14:00',
            endHour:
              '16:00',
            reason:
              'Manutenção / Nivelamento',
            notes: '',
          })
        );

        await loadData(
          true
        );

      } catch (
        error: any
      ) {

        setFeedback({
          type:
            'error',
          message:
            error?.message ||
            'Erro ao criar bloqueio.',
        });

      }
    };

  // ==========================================================
  // NO ARENA
  // ==========================================================

  if (!activeArena) {

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">

        <h2 className="text-base font-bold text-white">
          Nenhuma arena selecionada
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Selecione uma arena para visualizar os indicadores.
        </p>

      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6 animate-fadeIn pb-12">

      {/* ======================================================
          FEEDBACK
      ====================================================== */}

      {feedback && (

        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold shadow-lg ${
            feedback.type ===
            'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
          }`}
        >

          <div className="flex items-center gap-2">

            {feedback.type ===
            'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}

            <span>
              {feedback.message}
            </span>

          </div>

          <button
            type="button"
            onClick={() =>
              setFeedback(
                null
              )
            }
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            ×
          </button>

        </div>

      )}

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">

        <div className="space-y-1.5">

          <div className="flex flex-wrap items-center gap-2">

            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">

              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />

              Operação Ao Vivo

            </span>

            <span className="text-xs text-slate-400">
              Horário:{' '}
              <strong className="text-slate-200">
                {activeArena.opening_time ||
                  '06:00'}
                {' às '}
                {activeArena.closing_time ||
                  '23:00'}
              </strong>
            </span>

            <span className="text-xs text-slate-400">
              • Timezone:{' '}
              <strong className="text-slate-200">
                {activeArena.timezone ||
                  'America/Sao_Paulo'}
              </strong>
            </span>

          </div>

          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {activeArena.name}
          </h1>

          <p className="text-xs md:text-sm text-slate-400">
            Inteligência operacional em tempo real: ocupação, faturamento e demanda.
          </p>

        </div>

        {/* PERÍODOS */}

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">

          <div className="bg-slate-950/80 p-1 rounded-2xl border border-slate-800 flex items-center gap-1 overflow-x-auto">

            <button
              type="button"
              onClick={() =>
                setPeriod(
                  'TODAY'
                )
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                period ===
                'TODAY'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() =>
                setPeriod(
                  '7_DAYS'
                )
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                period ===
                '7_DAYS'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 dias
            </button>

            <button
              type="button"
              onClick={() =>
                setPeriod(
                  '30_DAYS'
                )
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                period ===
                '30_DAYS'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              30 dias
            </button>

            <button
              type="button"
              onClick={() =>
                setPeriod(
                  'CUSTOM'
                )
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                period ===
                'CUSTOM'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Personalizado
            </button>

          </div>

          <button
            type="button"
            onClick={() =>
              setShowTestsModal(
                true
              )
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800 hover:bg-emerald-500/20 text-slate-300 border border-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />

            <span>
              Auditar Sistema
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              loadData(true)
            }
            disabled={
              refreshing
            }
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            title="Atualizar"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                refreshing
                  ? 'animate-spin text-emerald-400'
                  : ''
              }`}
            />
          </button>

        </div>

      </div>

      {/* ======================================================
          CUSTOM RANGE
      ====================================================== */}

      {period ===
        'CUSTOM' && (

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">

          <div className="flex items-center gap-2 text-xs text-slate-300">

            <Filter className="w-4 h-4 text-emerald-400" />

            <span>
              Filtrar período:
            </span>

          </div>

          <input
            type="date"
            value={
              customStart
            }
            onChange={(event) =>
              setCustomStart(
                event.target.value
              )
            }
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />

          <span className="text-xs text-slate-500">
            até
          </span>

          <input
            type="date"
            value={
              customEnd
            }
            onChange={(event) =>
              setCustomEnd(
                event.target.value
              )
            }
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />

        </div>

      )}

      {/* ======================================================
          QUICK ACTIONS
      ====================================================== */}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

        <button
          type="button"
          onClick={() =>
            onNavigate(
              '/admin/agenda'
            )
          }
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />

          NOVA RESERVA
        </button>

        <button
          type="button"
          onClick={() =>
            setShowNewClientModal(
              true
            )
          }
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-purple-400" />

          NOVO CLIENTE
        </button>

        <button
          type="button"
          onClick={() =>
            setShowBlockModal(
              true
            )
          }
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs cursor-pointer"
        >
          <Ban className="w-4 h-4 text-amber-400" />

          BLOQUEAR QUADRA
        </button>

        <button
          type="button"
          onClick={() =>
            onNavigate(
              '/admin/agenda'
            )
          }
          className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-blue-400" />

          VER AGENDA
        </button>

      </div>

      {/* ======================================================
          INDICADORES DE HOJE
      ====================================================== */}

      <div className="space-y-3">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            <Activity className="w-4 h-4 text-emerald-400" />

            <h2 className="text-base font-bold text-white">
              Indicadores de Hoje
            </h2>

          </div>

          <span className="text-xs text-slate-400">
            Dados consolidados do dia atual
          </span>

        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* RESERVAS */}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

            <div className="flex items-center justify-between">

              <span className="text-xs font-semibold text-slate-400">
                Reservas Hoje
              </span>

              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Calendar className="w-4 h-4" />
              </div>

            </div>

            <div className="mt-3 text-2xl font-black text-white">
              {analytics?.todayReservationsCount ??
                0}
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              Agendamentos
            </p>

          </div>

          {/* FATURAMENTO */}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

            <div className="flex items-center justify-between">

              <span className="text-xs font-semibold text-slate-400">
                Faturamento Hoje
              </span>

              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>

            </div>

            <div className="mt-3 text-2xl font-black text-emerald-400">
              R${' '}
              {(
                analytics?.todayRevenue ??
                0
              ).toLocaleString(
                'pt-BR',
                {
                  minimumFractionDigits: 2,
                }
              )}
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              Reservas não canceladas
            </p>

          </div>

          {/* OCUPAÇÃO */}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

            <div className="flex items-center justify-between">

              <span className="text-xs font-semibold text-slate-400">
                Ocupação Hoje
              </span>

              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                <Percent className="w-4 h-4" />
              </div>

            </div>

            <div className="mt-3 text-2xl font-black text-teal-400">
              {analytics?.todayOccupancyPercent ??
                0}
              %
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              Capacidade operacional
            </p>

          </div>

          {/* CANCELAMENTOS */}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

            <div className="flex items-center justify-between">

              <span className="text-xs font-semibold text-slate-400">
                Cancelamentos
              </span>

              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                <XCircle className="w-4 h-4" />
              </div>

            </div>

            <div className="mt-3 text-2xl font-black text-rose-400">
              {analytics?.todayCancellationsCount ??
                0}
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              No dia atual
            </p>

          </div>

        </div>

      </div>

      {/* ======================================================
          INDICADORES DO PERÍODO
      ====================================================== */}

      <div className="space-y-3">

        <div className="flex items-center gap-2">

          <TrendingUp className="w-4 h-4 text-emerald-400" />

          <h2 className="text-base font-bold text-white">
            Indicadores do Período
          </h2>

        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

            <span className="text-xs text-slate-400">
              Reservas
            </span>

            <div className="mt-2 text-xl font-black text-white">
              {analytics?.periodReservationsCount ??
                0}
            </div>

            <span className="text-[11px] text-slate-500">
              {analytics?.periodValidReservationsCount ??
                0}{' '}
              válidas
            </span>

          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

            <span className="text-xs text-slate-400">
              Faturamento
            </span>

            <div className="mt-2 text-xl font-black text-emerald-400">
              R${' '}
              {(
                analytics?.periodRevenue ??
                0
              ).toLocaleString(
                'pt-BR',
                {
                  minimumFractionDigits: 2,
                }
              )}
            </div>

          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

            <span className="text-xs text-slate-400">
              Ticket Médio
            </span>

            <div className="mt-2 text-xl font-black text-blue-400">
              R${' '}
              {(
                analytics?.periodAverageTicket ??
                0
              ).toLocaleString(
                'pt-BR',
                {
                  minimumFractionDigits: 2,
                }
              )}
            </div>

          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

            <span className="text-xs text-slate-400">
              Clientes Recorrentes
            </span>

            <div className="mt-2 text-xl font-black text-amber-400">
              {analytics?.periodRecurringCustomersCount ??
                0}
            </div>

            <span className="text-[11px] text-slate-500">
              2+ reservas
            </span>

          </div>

        </div>

      </div>

      {/* ======================================================
          GRÁFICOS
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* OCUPAÇÃO */}

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">

          <div className="flex items-center justify-between pb-3 border-b border-slate-800">

            <div>

              <div className="flex items-center gap-2">

                <BarChart3 className="w-4 h-4 text-teal-400" />

                <h3 className="text-sm font-bold text-slate-100">
                  Taxa de Ocupação Diária
                </h3>

              </div>

              <p className="text-xs text-slate-400">
                Horas reservadas vs. horas disponíveis
              </p>

            </div>

            <span className="text-xs font-bold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-xl">
              Média:{' '}
              {analytics?.periodAverageOccupancy ??
                0}
              %
            </span>

          </div>

          {analytics?.dailyOccupancy &&
          analytics.dailyOccupancy.length >
            0 ? (

            <div className="space-y-3">

              {analytics.dailyOccupancy.map(
                (day) => (

                  <div
                    key={
                      day.date
                    }
                    className="space-y-1"
                  >

                    <div className="flex items-center justify-between text-xs">

                      <span className="font-semibold text-slate-300">
                        {day.label}
                      </span>

                      <div className="flex items-center gap-2">

                        <span className="text-slate-400">
                          {day.reservedHours.toFixed(
                            1
                          )}
                          h /
                          {day.availableHours.toFixed(
                            1
                          )}
                          h
                        </span>

                        <span className="font-bold text-white">
                          {
                            day.occupancyPercent
                          }
                          %
                        </span>

                      </div>

                    </div>

                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">

                      <div
                        className={`h-full rounded-full ${
                          day.occupancyPercent >=
                          80
                            ? 'bg-emerald-400'
                            : day.occupancyPercent >=
                              50
                            ? 'bg-teal-400'
                            : day.occupancyPercent >
                              0
                            ? 'bg-blue-400'
                            : 'bg-transparent'
                        }`}
                        style={{
                          width: `${Math.max(
                            2,
                            day.occupancyPercent
                          )}%`,
                        }}
                      />

                    </div>

                  </div>

                )
              )}

            </div>

          ) : (

            <div className="py-12 text-center text-xs text-slate-400">
              Ainda não existem dados suficientes.
            </div>

          )}

        </div>

        {/* FATURAMENTO */}

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">

          <div className="flex items-center justify-between pb-3 border-b border-slate-800">

            <div>

              <div className="flex items-center gap-2">

                <DollarSign className="w-4 h-4 text-emerald-400" />

                <h3 className="text-sm font-bold text-slate-100">
                  Faturamento por Dia
                </h3>

              </div>

              <p className="text-xs text-slate-400">
                Receita de reservas não canceladas
              </p>

            </div>

            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl">
              Total: R${' '}
              {(
                analytics?.periodRevenue ??
                0
              ).toLocaleString(
                'pt-BR',
                {
                  minimumFractionDigits: 2,
                }
              )}
            </span>

          </div>

          {analytics?.dailyRevenue &&
          analytics.dailyRevenue.length >
            0 ? (

            <div className="space-y-3">

              {analytics.dailyRevenue.map(
                (day) => {

                  const maxRevenue =
                    Math.max(
                      1,
                      ...analytics.dailyRevenue.map(
                        (item) =>
                          item.revenue
                      )
                    );

                  const percentage =
                    Math.round(
                      (day.revenue /
                        maxRevenue) *
                        100
                    );

                  return (

                    <div
                      key={
                        day.date
                      }
                      className="space-y-1"
                    >

                      <div className="flex items-center justify-between text-xs">

                        <span className="font-semibold text-slate-300">
                          {day.label}
                        </span>

                        <div className="flex items-center gap-2">

                          <span className="text-slate-400">
                            {
                              day.reservationsCount
                            }{' '}
                            reservas
                          </span>

                          <span className="font-bold text-emerald-400">
                            R${' '}
                            {day.revenue.toFixed(
                              2
                            )}
                          </span>

                        </div>

                      </div>

                      <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">

                        <div
                          className="h-full bg-emerald-400 rounded-full"
                          style={{
                            width: `${Math.max(
                              day.revenue >
                                0
                                ? 3
                                : 0,
                              percentage
                            )}%`,
                          }}
                        />

                      </div>

                    </div>

                  );
                }
              )}

            </div>

          ) : (

            <div className="py-12 text-center text-xs text-slate-400">
              Ainda não existem dados suficientes.
            </div>

          )}

        </div>

      </div>

      {/* ======================================================
          QUADRAS / HORÁRIOS
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* QUADRAS */}

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">

          <div className="flex items-center justify-between pb-3 border-b border-slate-800">

            <div className="flex items-center gap-2">

              <Layers className="w-4 h-4 text-blue-400" />

              <h3 className="text-sm font-bold text-white">
                Utilização das Quadras
              </h3>

            </div>

            <span className="text-[11px] text-slate-500">
              Período
            </span>

          </div>

          <div className="mt-4 space-y-3">

            {analytics?.courtUtilization &&
            analytics.courtUtilization.length >
              0 ? (

              analytics.courtUtilization.map(
                (court) => (

                  <div
                    key={
                      court.courtId
                    }
                    className="space-y-1.5"
                  >

                    <div className="flex items-center justify-between">

                      <div>

                        <div className="text-xs font-bold text-slate-200">
                          {
                            court.courtName
                          }
                        </div>

                        <div className="text-[10px] text-slate-500">
                          {
                            court.modalityName ||
                            'Modalidade'
                          }
                        </div>

                      </div>

                      <div className="text-right">

                        <div className="text-xs font-bold text-white">
                          {
                            court.utilizationRate
                          }
                          %
                        </div>

                        <div className="text-[10px] text-slate-500">
                          {
                            court.reservedHours.toFixed(
                              1
                            )
                          }
                          h
                        </div>

                      </div>

                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">

                      <div
                        className="h-full bg-blue-400 rounded-full"
                        style={{
                          width: `${Math.max(
                            2,
                            court.utilizationRate
                          )}%`,
                        }}
                      />

                    </div>

                  </div>

                )
              )

            ) : (

              <div className="py-8 text-center text-xs text-slate-400">
                Sem dados de utilização.
              </div>

            )}

          </div>

        </div>

        {/* PICO */}

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">

          <div className="flex items-center justify-between pb-3 border-b border-slate-800">

            <div className="flex items-center gap-2">

              <Flame className="w-4 h-4 text-amber-400" />

              <h3 className="text-sm font-bold text-white">
                Horários Mais Procurados
              </h3>

            </div>

            <span className="text-[11px] text-slate-500">
              Picos
            </span>

          </div>

          <div className="mt-4 space-y-3">

            {analytics?.peakHours &&
            analytics.peakHours.filter(
              (item) =>
                item.count >
                0
            ).length >
              0 ? (

              analytics.peakHours
                .filter(
                  (item) =>
                    item.count >
                    0
                )
                .slice(
                  0,
                  5
                )
                .map(
                  (item) => (

                    <div
                      key={
                        item.hour
                      }
                      className="space-y-1.5"
                    >

                      <div className="flex items-center justify-between">

                        <span className="font-mono text-xs font-bold text-slate-300">
                          {item.hour}
                        </span>

                        <span className="text-xs text-slate-400">
                          {
                            item.count
                          }{' '}
                          reservas
                        </span>

                      </div>

                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">

                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{
                            width: `${Math.max(
                              5,
                              item.percentage
                            )}%`,
                          }}
                        />

                      </div>

                    </div>

                  )
                )

            ) : (

              <div className="py-8 text-center text-xs text-slate-400">
                Ainda não existem reservas para identificar os horários de pico.
              </div>

            )}

          </div>

        </div>

      </div>

      {/* ======================================================
          RESERVAS DE HOJE
      ====================================================== */}

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">

        <div className="flex items-center justify-between pb-3 border-b border-slate-800">

          <div>

            <div className="flex items-center gap-2">

              <Clock className="w-4 h-4 text-emerald-400" />

              <h3 className="text-sm font-bold text-slate-100">
                Reservas de Hoje
              </h3>

            </div>

            <p className="text-xs text-slate-400">
              Lista cronológica operacional
            </p>

          </div>

          <button
            type="button"
            onClick={() =>
              onNavigate(
                '/admin/reservas'
              )
            }
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            Ver todas

            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

        </div>

        <div className="mt-4 space-y-2.5">

          {analytics?.todayReservationsList &&
          analytics.todayReservationsList.length >
            0 ? (

            analytics.todayReservationsList.map(
              (reservation) => {

                const startTime =
                  new Date(
                    reservation.start_at
                  ).toLocaleTimeString(
                    'pt-BR',
                    {
                      hour:
                        '2-digit',
                      minute:
                        '2-digit',
                      timeZone:
                        activeArena.timezone ||
                        'America/Sao_Paulo',
                    }
                  );

                const endTime =
                  new Date(
                    reservation.end_at
                  ).toLocaleTimeString(
                    'pt-BR',
                    {
                      hour:
                        '2-digit',
                      minute:
                        '2-digit',
                      timeZone:
                        activeArena.timezone ||
                        'America/Sao_Paulo',
                    }
                  );

                const isPaid =
                  reservation.payment_status ===
                  'PAID';

                const isCancelled =
                  reservation.status ===
                  'CANCELLED';

                return (

                  <div
                    key={
                      reservation.id
                    }
                    className={`p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCancelled
                        ? 'opacity-50'
                        : 'hover:border-slate-700'
                    }`}
                  >

                    <div className="flex items-center gap-3">

                      <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-extrabold">
                        {startTime}
                      </div>

                      <div>

                        <p className="text-xs font-bold text-slate-200">
                          {reservation.customer?.full_name ||
                            'Cliente'}
                        </p>

                        <p className="text-[11px] text-slate-400">
                          {reservation.court?.name ||
                            'Quadra'}
                          {' • '}
                          {startTime}
                          {' às '}
                          {endTime}
                        </p>

                      </div>

                    </div>

                    <div className="flex items-center gap-3">

                      <span className="text-xs font-bold text-emerald-400">
                        R${' '}
                        {Number(
                          reservation.amount ||
                            0
                        ).toFixed(
                          2
                        )}
                      </span>

                      {isPaid ? (

                        <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                          PAGO
                        </span>

                      ) : (

                        <button
                          type="button"
                          onClick={() =>
                            handleMarkAsPaid(
                              reservation
                            )
                          }
                          className="px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[9px] font-bold cursor-pointer"
                        >
                          MARCAR PAGO
                        </button>

                      )}

                    </div>

                  </div>

                );
              }
            )

          ) : (

            <div className="py-10 text-center text-xs text-slate-400">
              Nenhuma reserva agendada para hoje.
            </div>

          )}

        </div>

      </div>

      {/* ======================================================
          MODAL NOVO CLIENTE
      ====================================================== */}

      {showNewClientModal && (

        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">

            <div className="flex items-center justify-between pb-3 border-b border-slate-800">

              <div className="flex items-center gap-2">

                <UserPlus className="w-5 h-5 text-purple-400" />

                <h3 className="text-base font-bold text-white">
                  Novo Cliente
                </h3>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowNewClientModal(
                    false
                  )
                }
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                handleCreateCustomer
              }
              className="space-y-4 mt-5"
            >

              <input
                type="text"
                required
                placeholder="Nome completo"
                value={
                  clientForm.fullName
                }
                onChange={(
                  event
                ) =>
                  setClientForm(
                    {
                      ...clientForm,
                      fullName:
                        event.target.value,
                    }
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />

              <input
                type="text"
                required
                placeholder="Telefone / WhatsApp"
                value={
                  clientForm.phone
                }
                onChange={(
                  event
                ) =>
                  setClientForm(
                    {
                      ...clientForm,
                      phone:
                        event.target.value,
                    }
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />

              <input
                type="email"
                placeholder="E-mail"
                value={
                  clientForm.email
                }
                onChange={(
                  event
                ) =>
                  setClientForm(
                    {
                      ...clientForm,
                      email:
                        event.target.value,
                    }
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />

              <textarea
                rows={3}
                placeholder="Observações"
                value={
                  clientForm.notes
                }
                onChange={(
                  event
                ) =>
                  setClientForm(
                    {
                      ...clientForm,
                      notes:
                        event.target.value,
                    }
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
              />

              <div className="flex justify-end gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setShowNewClientModal(
                      false
                    )
                  }
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
                >
                  Cadastrar Cliente
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ======================================================
          MODAL BLOQUEAR QUADRA
      ====================================================== */}

      {showBlockModal && (

        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">

            <div className="flex items-center justify-between pb-3 border-b border-slate-800">

              <div className="flex items-center gap-2">

                <Ban className="w-5 h-5 text-amber-400" />

                <h3 className="text-base font-bold text-white">
                  Bloquear Quadra
                </h3>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowBlockModal(
                    false
                  )
                }
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={
                handleCreateCourtBlock
              }
              className="space-y-4 mt-5"
            >

              <div>

                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quadra *
                </label>

                <select
                  required
                  value={
                    blockForm.courtId
                  }
                  onChange={(
                    event
                  ) =>
                    setBlockForm(
                      {
                        ...blockForm,
                        courtId:
                          event.target.value,
                      }
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >

                  {courts.map(
                    (court) => (

                      <option
                        key={
                          court.id
                        }
                        value={
                          court.id
                        }
                      >
                        {court.name}
                        {' ('}
                        {court.modality?.name ||
                          'Quadra'}
                        {')'}
                      </option>

                    )
                  )}

                </select>

              </div>

              <div>

                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Data *
                </label>

                <input
                  type="date"
                  required
                  value={
                    blockForm.date
                  }
                  onChange={(
                    event
                  ) =>
                    setBlockForm(
                      {
                        ...blockForm,
                        date:
                          event.target.value,
                      }
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Início *
                  </label>

                  <input
                    type="time"
                    required
                    value={
                      blockForm.startHour
                    }
                    onChange={(
                      event
                    ) =>
                      setBlockForm(
                        {
                          ...blockForm,
                          startHour:
                            event.target.value,
                        }
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />

                </div>

                <div>

                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Término *
                  </label>

                  <input
                    type="time"
                    required
                    value={
                      blockForm.endHour
                    }
                    onChange={(
                      event
                    ) =>
                      setBlockForm(
                        {
                          ...blockForm,
                          endHour:
                            event.target.value,
                        }
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />

                </div>

              </div>

              <div>

                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo *
                </label>

                <input
                  type="text"
                  required
                  value={
                    blockForm.reason
                  }
                  onChange={(
                    event
                  ) =>
                    setBlockForm(
                      {
                        ...blockForm,
                        reason:
                          event.target.value,
                      }
                    )
                  }
                  placeholder="Ex: Manutenção"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />

              </div>

              <div>

                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observações
                </label>

                <textarea
                  rows={3}
                  value={
                    blockForm.notes
                  }
                  onChange={(
                    event
                  ) =>
                    setBlockForm(
                      {
                        ...blockForm,
                        notes:
                          event.target.value,
                      }
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
                />

              </div>

              <div className="flex justify-end gap-2 pt-2">

                <button
                  type="button"
                  onClick={() =>
                    setShowBlockModal(
                      false
                    )
                  }
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Confirmar Bloqueio
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ======================================================
          DIAGNÓSTICO
      ====================================================== */}

      <DiagnosticTestsModal
        arenaId={
          activeArena.id
        }
        arenaName={
          activeArena.name
        }
        isOpen={
          showTestsModal
        }
        onClose={() =>
          setShowTestsModal(
            false
          )
        }
      />

    </div>
  );
};