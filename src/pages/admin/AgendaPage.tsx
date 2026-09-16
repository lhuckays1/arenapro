import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';

import {
  Court,
  CourtBlock,
  Customer,
  Modality,
  Reservation,
} from '../../types';

import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Lock,
  LayoutGrid,
  List,
  CalendarRange,
  DollarSign,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';

import { ReservationModal } from '../../components/agenda/ReservationModal';
import { CourtBlockModal } from '../../components/agenda/CourtBlockModal';
import { AgendaDailyView } from '../../components/agenda/AgendaDailyView';
import { AgendaWeeklyView } from '../../components/agenda/AgendaWeeklyView';
import { AgendaListView } from '../../components/agenda/AgendaListView';

import {
  addCalendarDays,
  buildArenaDateTime,
  getArenaDate,
  getTodayArenaDate,
} from '../../utils/agendaDate';

export const AgendaPage: React.FC<{
  onNavigate: (
    path: string
  ) => void;
}> = ({
  onNavigate,
}) => {
  const {
    activeArena,
  } = useAuth();

  // ==========================================================
  // DATA STATE
  // ==========================================================

  const [
    courts,
    setCourts,
  ] = useState<Court[]>([]);

  const [
    modalities,
    setModalities,
  ] = useState<Modality[]>([]);

  const [
    customers,
    setCustomers,
  ] = useState<Customer[]>([]);

  const [
    reservations,
    setReservations,
  ] = useState<Reservation[]>([]);

  const [
    courtBlocks,
    setCourtBlocks,
  ] = useState<CourtBlock[]>([]);

  const [
    loading,
    setLoading,
  ] = useState<boolean>(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState<boolean>(false);

  // ==========================================================
  // VIEW / FILTER STATE
  // ==========================================================

  /*
   * A Agenda deve abrir SEMPRE no modo semanal.
   */
  const [
    viewMode,
    setViewMode,
  ] = useState<
    'daily' | 'weekly' | 'list'
  >('weekly');

  /*
   * Usa a data da arena, e não UTC do navegador.
   */
  const [
    selectedDate,
    setSelectedDate,
  ] = useState<string>(
    getTodayArenaDate()
  );

  const [
    selectedModalityId,
    setSelectedModalityId,
  ] = useState<string>('ALL');

  const [
    selectedCourtId,
    setSelectedCourtId,
  ] = useState<string>('ALL');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<string>('ALL');

  // ==========================================================
  // MODAL STATE
  // ==========================================================

  const [
    isResModalOpen,
    setIsResModalOpen,
  ] = useState<boolean>(false);

  const [
    resModalMode,
    setResModalMode,
  ] = useState<
    'create' | 'edit' | 'view'
  >('create');

  const [
    selectedReservation,
    setSelectedReservation,
  ] =
    useState<
      Partial<Reservation> | null
    >(null);

  const [
    isBlockModalOpen,
    setIsBlockModalOpen,
  ] = useState<boolean>(false);

  const [
    selectedBlock,
    setSelectedBlock,
  ] =
    useState<
      Partial<CourtBlock> | null
    >(null);

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  const loadData = async (
    showLoading: boolean = true
  ) => {
    if (!activeArena) {
      return;
    }

    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [
        crts,
        mods,
        custs,
        res,
        blks,
      ] = await Promise.all([
        arenaService.getCourts(
          activeArena.id
        ),

        arenaService.getModalities(
          activeArena.id
        ),

        arenaService.getCustomers(
          activeArena.id
        ),

        arenaService.getReservations(
          activeArena.id
        ),

        arenaService.getCourtBlocks(
          activeArena.id
        ),
      ]);

      /*
       * IMPORTANTE:
       *
       * Atualizamos os estados individualmente.
       * Os KPIs usam esses estados e serão
       * recalculados automaticamente pelo useMemo.
       */
      setCourts(crts);
      setModalities(mods);
      setCustomers(custs);
      setReservations(res);
      setCourtBlocks(blks);

    } catch (error) {
      console.error(
        'Erro ao carregar dados da agenda:',
        error
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  // ==========================================================
  // LOAD WHEN ARENA CHANGES
  // ==========================================================

  useEffect(() => {
    if (!activeArena) {
      return;
    }

    /*
     * Sempre que mudar a arena:
     *
     * - volta para hoje;
     * - mantém a Agenda semanal;
     * - limpa filtros de quadra/modalidade/status.
     */
    setSelectedDate(
      getTodayArenaDate()
    );

    setViewMode(
      'weekly'
    );

    setSelectedModalityId(
      'ALL'
    );

    setSelectedCourtId(
      'ALL'
    );

    setStatusFilter(
      'ALL'
    );

    void loadData(
      true
    );
  }, [
    activeArena?.id,
  ]);

  // ==========================================================
  // DATE NAVIGATION
  // ==========================================================

  const handlePrevDate =
    () => {
      const step =
        viewMode ===
        'weekly'
          ? 7
          : 1;

      setSelectedDate(
        addCalendarDays(
          selectedDate,
          -step
        )
      );
    };

  const handleNextDate =
    () => {
      const step =
        viewMode ===
        'weekly'
          ? 7
          : 1;

      setSelectedDate(
        addCalendarDays(
          selectedDate,
          step
        )
      );
    };

  const handleToday =
    () => {
      setSelectedDate(
        getTodayArenaDate()
      );
    };

  // ==========================================================
  // FILTERED COURTS
  // ==========================================================

  const filteredCourts =
    useMemo(() => {
      return courts.filter(
        (
          court
        ) => {

          if (
            selectedModalityId !==
              'ALL' &&
            court.modality_id !==
              selectedModalityId
          ) {
            return false;
          }

          if (
            selectedCourtId !==
              'ALL' &&
            court.id !==
              selectedCourtId
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      courts,
      selectedModalityId,
      selectedCourtId,
    ]);

  // ==========================================================
  // FILTERED RESERVATIONS
  // ==========================================================

  const filteredReservations =
    useMemo(() => {
      return reservations.filter(
        (
          reservation
        ) => {

          if (
            selectedCourtId !==
              'ALL' &&
            reservation.court_id !==
              selectedCourtId
          ) {
            return false;
          }

          if (
            selectedModalityId !==
              'ALL'
          ) {
            const reservationModalityId =
              reservation.court
                ?.modality_id;

            if (
              reservationModalityId !==
              selectedModalityId
            ) {
              return false;
            }
          }

          if (
            statusFilter !==
              'ALL' &&
            reservation.status !==
              statusFilter
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      reservations,
      selectedCourtId,
      selectedModalityId,
      statusFilter,
    ]);

  // ==========================================================
  // FILTERED BLOCKS
  // ==========================================================

  const filteredBlocks =
    useMemo(() => {
      return courtBlocks.filter(
        (
          block
        ) => {

          if (
            selectedCourtId !==
              'ALL' &&
            block.court_id !==
              selectedCourtId
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      courtBlocks,
      selectedCourtId,
    ]);

  // ==========================================================
  // SELECTED WEEK
  // ==========================================================

  const selectedWeekDays =
    useMemo(() => {
      const baseDate =
        new Date(
          `${selectedDate}T12:00:00`
        );

      const jsDay =
        baseDate.getDay();

      /*
       * Segunda = 0
       * Domingo = 6
       */
      const diffToMonday =
        jsDay === 0
          ? -6
          : 1 - jsDay;

      const monday =
        addCalendarDays(
          selectedDate,
          diffToMonday
        );

      return Array.from(
        {
          length: 7,
        },
        (
          _,
          index
        ) =>
          addCalendarDays(
            monday,
            index
          )
      );
    }, [
      selectedDate,
    ]);

  // ==========================================================
  // PERIOD RANGE
  // ==========================================================

  const periodStartDate =
    useMemo(() => {

      if (
        viewMode ===
        'weekly'
      ) {
        return selectedWeekDays[0];
      }

      if (
        viewMode ===
        'daily'
      ) {
        return selectedDate;
      }

      /*
       * Na lista, usamos a menor
       * data encontrada nas reservas.
       *
       * Como a lista é operacional,
       * os KPIs acompanham todo o
       * conjunto atualmente carregado.
       */
      return null;

    }, [
      viewMode,
      selectedDate,
      selectedWeekDays,
    ]);

  const periodEndDate =
    useMemo(() => {

      if (
        viewMode ===
        'weekly'
      ) {
        return selectedWeekDays[6];
      }

      if (
        viewMode ===
        'daily'
      ) {
        return selectedDate;
      }

      return null;

    }, [
      viewMode,
      selectedDate,
      selectedWeekDays,
    ]);

  // ==========================================================
  // RESERVATIONS IN CURRENT PERIOD
  // ==========================================================

  const currentPeriodReservations =
    useMemo(() => {

      return filteredReservations.filter(
        (
          reservation
        ) => {

          /*
           * Canceladas não são consideradas
           * reservas ativas.
           */
          if (
            reservation.status ===
            'CANCELLED'
          ) {
            return false;
          }

          /*
           * Lista:
           * todos os registros filtrados.
           */
          if (
            viewMode ===
            'list'
          ) {
            return true;
          }

          const reservationDate =
            getArenaDate(
              reservation.start_at
            );

          if (
            periodStartDate &&
            reservationDate <
              periodStartDate
          ) {
            return false;
          }

          if (
            periodEndDate &&
            reservationDate >
              periodEndDate
          ) {
            return false;
          }

          return true;
        }
      );

    }, [
      filteredReservations,
      viewMode,
      periodStartDate,
      periodEndDate,
    ]);

  // ==========================================================
  // BLOCKS IN CURRENT PERIOD
  // ==========================================================

  const currentPeriodBlocks =
    useMemo(() => {

      return filteredBlocks.filter(
        (
          block
        ) => {

          if (
            viewMode ===
            'list'
          ) {
            return true;
          }

          const blockDate =
            getArenaDate(
              block.start_at
            );

          if (
            periodStartDate &&
            blockDate <
              periodStartDate
          ) {
            return false;
          }

          if (
            periodEndDate &&
            blockDate >
              periodEndDate
          ) {
            return false;
          }

          return true;
        }
      );

    }, [
      filteredBlocks,
      viewMode,
      periodStartDate,
      periodEndDate,
    ]);

  // ==========================================================
  // KPI METRICS
  // ==========================================================

  const metrics =
    useMemo(() => {

      /*
       * QUANTIDADE DE RESERVAS
       */
      const count =
        currentPeriodReservations.length;

      /*
       * RECEITA PREVISTA
       */
      const revenue =
        currentPeriodReservations.reduce(
          (
            total,
            reservation
          ) => {

            const amount =
              Number(
                reservation.amount ||
                  0
              );

            if (
              !Number.isFinite(
                amount
              )
            ) {
              return total;
            }

            return (
              total +
              amount
            );
          },
          0
        );

      /*
       * HORAS EM QUADRA
       *
       * Calculadas através dos timestamps
       * reais armazenados no banco.
       */
      const hours =
        currentPeriodReservations.reduce(
          (
            total,
            reservation
          ) => {

            const start =
              new Date(
                reservation.start_at
              ).getTime();

            const end =
              new Date(
                reservation.end_at
              ).getTime();

            if (
              !Number.isFinite(
                start
              ) ||
              !Number.isFinite(
                end
              )
            ) {
              return total;
            }

            const duration =
              (
                end -
                start
              ) /
              3600000;

            if (
              duration <=
              0
            ) {
              return total;
            }

            return (
              total +
              duration
            );
          },
          0
        );

      /*
       * BLOQUEIOS
       */
      const blocks =
        currentPeriodBlocks.length;

      return {
        count,
        hours,
        revenue,
        blocks,
      };

    }, [
      currentPeriodReservations,
      currentPeriodBlocks,
    ]);

  // ==========================================================
  // FORMAT KPI HOURS
  // ==========================================================

  const formattedHours =
    useMemo(() => {

      if (
        metrics.hours ===
        0
      ) {
        return '0h';
      }

      const rounded =
        Math.round(
          metrics.hours *
            100
        ) / 100;

      return `${rounded}h`;

    }, [
      metrics.hours,
    ]);

  // ==========================================================
  // FORMAT KPI REVENUE
  // ==========================================================

  const formattedRevenue =
    useMemo(() => {

      return metrics.revenue.toLocaleString(
        'pt-BR',
        {
          minimumFractionDigits:
            2,
          maximumFractionDigits:
            2,
        }
      );

    }, [
      metrics.revenue,
    ]);

  // ==========================================================
  // SELECT EMPTY SLOT
  // ==========================================================

  const handleSelectSlot = (
    court: Court,
    hour: string,
    customDate?: string
  ) => {

    if (
      !activeArena
    ) {
      return;
    }

    const targetDate =
      customDate ||
      selectedDate;

    const startAt =
      buildArenaDateTime(
        targetDate,
        hour
      );

    /*
     * Calcula o horário seguinte.
     */
    const [
      hourPart,
      minutePart,
    ] =
      hour
        .split(':')
        .map(Number);

    const startMinutes =
      (
        hourPart *
        60
      ) +
      (
        minutePart ||
        0
      );

    const endMinutes =
      startMinutes +
      60;

    const endHour =
      Math.floor(
        endMinutes /
          60
      ) % 24;

    const endMinute =
      endMinutes %
      60;

    const endTime =
      `${String(
        endHour
      ).padStart(
        2,
        '0'
      )}:${String(
        endMinute
      ).padStart(
        2,
        '0'
      )}`;

    const endDate =
      endMinutes >=
      1440
        ? addCalendarDays(
            targetDate,
            1
          )
        : targetDate;

    const endAt =
      buildArenaDateTime(
        endDate,
        endTime
      );

    setSelectedReservation(
      {
        arena_id:
          activeArena.id,

        court_id:
          court.id,

        start_at:
          startAt,

        end_at:
          endAt,

        status:
          'CONFIRMED',

        payment_status:
          'PENDING',

        payment_method:
          'PIX',
      }
    );

    setResModalMode(
      'create'
    );

    setIsResModalOpen(
      true
    );
  };

  // ==========================================================
  // SELECT RESERVATION
  // ==========================================================

  const handleSelectReservation =
    (
      reservation: Reservation
    ) => {

      setSelectedReservation(
        reservation
      );

      setResModalMode(
        'view'
      );

      setIsResModalOpen(
        true
      );
    };

  // ==========================================================
  // SELECT BLOCK
  // ==========================================================

  const handleSelectBlock =
    (
      block: CourtBlock
    ) => {

      setSelectedBlock(
        block
      );

      setIsBlockModalOpen(
        true
      );
    };

  // ==========================================================
  // CLOSE RESERVATION MODAL
  // ==========================================================

  const handleCloseReservationModal =
    () => {

      setIsResModalOpen(
        false
      );

      /*
       * Limpa o registro selecionado
       * depois de fechar.
       */
      setSelectedReservation(
        null
      );
    };

  // ==========================================================
  // CLOSE BLOCK MODAL
  // ==========================================================

  const handleCloseBlockModal =
    () => {

      setIsBlockModalOpen(
        false
      );

      setSelectedBlock(
        null
      );
    };

  // ==========================================================
  // REFRESH AFTER RESERVATION OPERATION
  // ==========================================================

  const handleReservationSuccess =
    async () => {

      /*
       * Não mostra a tela "Carregando grade..."
       *
       * Apenas atualiza os dados.
       *
       * Isso faz com que os KPIs mudem
       * imediatamente após:
       *
       * - criar;
       * - editar;
       * - cancelar;
       * - excluir.
       */
      await loadData(
        false
      );
    };

  // ==========================================================
  // REFRESH AFTER BLOCK OPERATION
  // ==========================================================

  const handleBlockSuccess =
    async () => {

      await loadData(
        false
      );
    };

  // ==========================================================
  // RESET FILTERS
  // ==========================================================

  const handleResetFilters =
    () => {

      setSelectedModalityId(
        'ALL'
      );

      setSelectedCourtId(
        'ALL'
      );

      setStatusFilter(
        'ALL'
      );
    };

  // ==========================================================
  // NO ACTIVE ARENA
  // ==========================================================

  if (
    !activeArena
  ) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">

        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h2 className="text-base font-bold text-white">
          Nenhuma arena selecionada
        </h2>

        <p className="text-xs text-slate-400 mt-1">
          Selecione uma arena para acessar a agenda operacional.
        </p>

      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* ======================================================
          HEADER / CONTROLS
      ====================================================== */}

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">

        {/* ====================================================
            TITLE + ACTIONS
        ==================================================== */}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

          {/* TITLE */}

          <div className="flex items-center gap-3">

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold shrink-0">

              <CalendarIcon className="w-6 h-6" />

            </div>

            <div>

              <div className="flex items-center gap-2">

                <h2 className="text-lg font-bold text-white tracking-tight">
                  Agenda & Reservas
                </h2>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {activeArena.name ||
                    'Arena'}
                </span>

              </div>

              <p className="text-xs text-slate-400">
                Grade operacional com validação instantânea contra duplicação de horários
              </p>

            </div>

          </div>

          {/* ACTIONS */}

          <div className="flex items-center flex-wrap gap-2.5">

            <button
              id="btn-refresh-agenda"
              type="button"
              onClick={() =>
                void loadData(
                  true
                )
              }
              disabled={
                loading ||
                refreshing
              }
              className="px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >

              <RotateCcw
                className={`w-4 h-4 ${
                  refreshing ||
                  loading
                    ? 'animate-spin'
                    : ''
                }`}
              />

              <span>
                Atualizar
              </span>

            </button>

            <button
              id="btn-block-court"
              type="button"
              onClick={() => {

                setSelectedBlock(
                  null
                );

                setIsBlockModalOpen(
                  true
                );

              }}
              className="px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-500/30 hover:border-amber-400 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >

              <Lock className="w-4 h-4" />

              <span>
                Bloquear Horário
              </span>

            </button>

            <button
              id="btn-new-reservation"
              type="button"
              onClick={() => {

                setSelectedReservation(
                  null
                );

                setResModalMode(
                  'create'
                );

                setIsResModalOpen(
                  true
                );

              }}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
            >

              <Plus className="w-4 h-4 stroke-[2.5]" />

              <span>
                Nova Reserva
              </span>

            </button>

          </div>

        </div>

        {/* ====================================================
            NAVIGATION / VIEW / FILTERS
        ==================================================== */}

        <div className="pt-3 border-t border-slate-800 flex flex-col xl:flex-row items-center justify-between gap-3 flex-wrap">

          {/* DATE NAVIGATION */}

          <div className="flex items-center gap-1.5 w-full xl:w-auto">

            <button
              type="button"
              onClick={
                handlePrevDate
              }
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={
                viewMode ===
                'weekly'
                  ? 'Semana anterior'
                  : 'Dia anterior'
              }
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={
                handleToday
              }
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 hover:text-emerald-400 hover:border-emerald-500/40 transition cursor-pointer"
            >
              Hoje
            </button>

            <div className="relative">

              <input
                id="agenda-date-picker"
                type="date"
                value={
                  selectedDate
                }
                onChange={(
                  event
                ) =>
                  setSelectedDate(
                    event.target
                      .value
                  )
                }
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              />

            </div>

            <button
              type="button"
              onClick={
                handleNextDate
              }
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={
                viewMode ===
                'weekly'
                  ? 'Próxima semana'
                  : 'Próximo dia'
              }
            >
              <ChevronRight className="w-4 h-4" />
            </button>

          </div>

          {/* VIEW SWITCHER */}

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-2xl p-1 gap-1">

            <button
              type="button"
              onClick={() =>
                setViewMode(
                  'weekly'
                )
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode ===
                'weekly'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >

              <CalendarRange className="w-3.5 h-3.5" />

              <span>
                Semanal
              </span>

            </button>

            <button
              type="button"
              onClick={() =>
                setViewMode(
                  'daily'
                )
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode ===
                'daily'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >

              <LayoutGrid className="w-3.5 h-3.5" />

              <span>
                Diário
              </span>

            </button>

            <button
              type="button"
              onClick={() =>
                setViewMode(
                  'list'
                )
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode ===
                'list'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >

              <List className="w-3.5 h-3.5" />

              <span>
                Lista
              </span>

            </button>

          </div>

          {/* FILTERS */}

          <div className="flex items-center gap-2 flex-wrap w-full xl:w-auto justify-end">

            {/* MODALITY */}

            <select
              value={
                selectedModalityId
              }
              onChange={(
                event
              ) =>
                setSelectedModalityId(
                  event.target
                    .value
                )
              }
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >

              <option value="ALL">
                Todas as Modalidades
              </option>

              {modalities.map(
                (
                  modality
                ) => (

                  <option
                    key={
                      modality.id
                    }
                    value={
                      modality.id
                    }
                  >
                    {modality.name}
                  </option>

                )
              )}

            </select>

            {/* COURT */}

            <select
              value={
                selectedCourtId
              }
              onChange={(
                event
              ) =>
                setSelectedCourtId(
                  event.target
                    .value
                )
              }
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >

              <option value="ALL">
                Todas as Quadras
              </option>

              {courts.map(
                (
                  court
                ) => (

                  <option
                    key={
                      court.id
                    }
                    value={
                      court.id
                    }
                  >
                    {court.name}
                  </option>

                )
              )}

            </select>

            {/* STATUS */}

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value
                )
              }
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >

              <option value="ALL">
                Todos os Status
              </option>

              <option value="CONFIRMED">
                Confirmadas
              </option>

              <option value="PENDING">
                Pendentes
              </option>

              <option value="COMPLETED">
                Concluídas
              </option>

              <option value="CANCELLED">
                Canceladas
              </option>

              <option value="NO_SHOW">
                Não Compareceu
              </option>

            </select>

            {/* RESET */}

            {(selectedModalityId !==
              'ALL' ||
              selectedCourtId !==
                'ALL' ||
              statusFilter !==
                'ALL') && (

              <button
                type="button"
                onClick={
                  handleResetFilters
                }
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 transition cursor-pointer"
                title="Limpar filtros"
              >

                <SlidersHorizontal className="w-4 h-4" />

              </button>

            )}

          </div>

        </div>

      </div>

      {/* ======================================================
          REFRESH INDICATOR
      ====================================================== */}

      {refreshing && (
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">

          <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />

          <span>
            Atualizando agenda...
          </span>

        </div>
      )}

      {/* ======================================================
          KPI
      ====================================================== */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* RESERVATIONS */}

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">

          <div>

            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Reservas Ativas
            </span>

            <div className="text-xl font-extrabold text-white mt-0.5">
              {metrics.count}
            </div>

          </div>

          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">

            <Clock className="w-5 h-5" />

          </div>

        </div>

        {/* HOURS */}

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">

          <div>

            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Horas em Quadra
            </span>

            <div className="text-xl font-extrabold text-white mt-0.5">
              {formattedHours}
            </div>

          </div>

          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">

            <TrendingUp className="w-5 h-5" />

          </div>

        </div>

        {/* REVENUE */}

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">

          <div>

            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Receita Prevista
            </span>

            <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">
              R${' '}
              {formattedRevenue}
            </div>

          </div>

          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">

            <DollarSign className="w-5 h-5" />

          </div>

        </div>

        {/* BLOCKS */}

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">

          <div>

            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Bloqueios Ativos
            </span>

            <div className="text-xl font-extrabold text-amber-400 mt-0.5">
              {metrics.blocks}
            </div>

          </div>

          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">

            <Lock className="w-5 h-5" />

          </div>

        </div>

      </div>

      {/* ======================================================
          MAIN VIEW
      ====================================================== */}

      {loading ? (

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">

          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />

          <p className="text-xs font-semibold text-slate-300">
            Carregando grade da arena...
          </p>

        </div>

      ) : (

        <>

          {/* ==================================================
              DAILY
          ================================================== */}

          {viewMode ===
            'daily' && (

            <AgendaDailyView
              courts={
                filteredCourts
              }
              reservations={
                filteredReservations
              }
              courtBlocks={
                filteredBlocks
              }
              selectedDate={
                selectedDate
              }
              openingTime={
                activeArena.opening_time ||
                '06:00'
              }
              closingTime={
                activeArena.closing_time ||
                '23:00'
              }
              onSelectSlot={(
                court,
                hour
              ) =>
                handleSelectSlot(
                  court,
                  hour
                )
              }
              onSelectReservation={
                handleSelectReservation
              }
              onSelectBlock={
                handleSelectBlock
              }
            />

          )}

          {/* ==================================================
              WEEKLY
          ================================================== */}

          {viewMode ===
            'weekly' && (

            <AgendaWeeklyView
              courts={
                filteredCourts
              }
              reservations={
                filteredReservations
              }
              courtBlocks={
                filteredBlocks
              }
              selectedDate={
                selectedDate
              }
              onSelectSlot={(
                court,
                hour,
                date
              ) =>
                handleSelectSlot(
                  court,
                  hour,
                  date
                )
              }
              onSelectReservation={
                handleSelectReservation
              }
              onSelectBlock={
                handleSelectBlock
              }
              onSelectDay={(
                date
              ) => {

                setSelectedDate(
                  date
                );

                /*
                 * Ao clicar em um dia da
                 * visão semanal, abre o
                 * modo diário.
                 */
                setViewMode(
                  'daily'
                );

              }}
            />

          )}

          {/* ==================================================
              LIST
          ================================================== */}

          {viewMode ===
            'list' && (

            <AgendaListView
              reservations={
                filteredReservations
              }
              courtBlocks={
                filteredBlocks
              }
              onSelectReservation={
                handleSelectReservation
              }
              onSelectBlock={
                handleSelectBlock
              }
            />

          )}

        </>

      )}

      {/* ======================================================
          RESERVATION MODAL
      ====================================================== */}

      {activeArena && (

        <ReservationModal
          isOpen={
            isResModalOpen
          }
          onClose={
            handleCloseReservationModal
          }
          onSuccess={
            handleReservationSuccess
          }
          arenaId={
            activeArena.id
          }
          courts={
            courts
          }
          customers={
            customers
          }
          initialData={
            selectedReservation
          }
          mode={
            resModalMode
          }
        />

      )}

      {/* ======================================================
          BLOCK MODAL
      ====================================================== */}

      {activeArena && (

        <CourtBlockModal
          isOpen={
            isBlockModalOpen
          }
          onClose={
            handleCloseBlockModal
          }
          onSuccess={
            handleBlockSuccess
          }
          arenaId={
            activeArena.id
          }
          courts={
            courts
          }
          initialData={
            selectedBlock
          }
        />

      )}

    </div>
  );
};