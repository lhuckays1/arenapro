import React, { useMemo } from 'react';
import {
  Court,
  CourtBlock,
  Reservation,
} from '../../types';

import {
  Clock,
  Lock,
  Plus,
  User,
  DollarSign,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import {
  getArenaDate,
  getArenaTime,
  getTodayArenaDate,
} from '../../utils/agendaDate';

interface AgendaDailyViewProps {
  courts: Court[];
  reservations: Reservation[];
  courtBlocks: CourtBlock[];
  selectedDate: string; // YYYY-MM-DD
  openingTime: string; // ex: 06:00
  closingTime: string; // ex: 23:00
  onSelectSlot: (
    court: Court,
    hour: string
  ) => void;
  onSelectReservation: (
    reservation: Reservation
  ) => void;
  onSelectBlock: (
    block: CourtBlock
  ) => void;
}

interface TimelineItem {
  startMinutes: number;
  endMinutes: number;
  top: number;
  height: number;
}

const SLOT_HEIGHT = 72;

const timeToMinutes = (
  time: string
): number => {
  const [hours, minutes] =
    time.split(':').map(Number);

  return (
    (hours || 0) * 60 +
    (minutes || 0)
  );
};

const dateTimeToMinutes = (
  value: string | Date
): number => {
  const time = getArenaTime(value);
  return timeToMinutes(time);
};

const formatMinutes = (
  totalMinutes: number
): string => {
  const normalized =
    ((totalMinutes % 1440) +
      1440) %
    1440;

  const hours = Math.floor(
    normalized / 60
  );

  const minutes =
    normalized % 60;

  return `${String(hours).padStart(
    2,
    '0'
  )}:${String(minutes).padStart(
    2,
    '0'
  )}`;
};

const calculateTimelineItem = (
  startMinutes: number,
  endMinutes: number,
  openingMinutes: number
): TimelineItem => {
  let normalizedEnd =
    endMinutes;

  /*
   * Trata corretamente intervalos que
   * passam da meia-noite.
   *
   * Exemplo:
   * 23:00 -> 00:00
   */
  if (
    normalizedEnd <=
      startMinutes
  ) {
    normalizedEnd += 1440;
  }

  const top =
    ((startMinutes -
      openingMinutes) /
      60) *
    SLOT_HEIGHT;

  const height =
    ((normalizedEnd -
      startMinutes) /
      60) *
    SLOT_HEIGHT;

  return {
    startMinutes,
    endMinutes:
      normalizedEnd,
    top,
    height: Math.max(
      SLOT_HEIGHT,
      height
    ),
  };
};

export const AgendaDailyView: React.FC<
  AgendaDailyViewProps
> = ({
  courts,
  reservations,
  courtBlocks,
  selectedDate,
  openingTime = '06:00',
  closingTime = '23:00',
  onSelectSlot,
  onSelectReservation,
  onSelectBlock,
}) => {
  // ==========================================================
  // OPERATING HOURS
  // ==========================================================

  const openingMinutes =
    timeToMinutes(
      openingTime
    );

  const closingMinutesRaw =
    timeToMinutes(
      closingTime
    );

  /*
   * Quando a arena fecha 00:00,
   * consideramos 24:00 como limite.
   */
  const closingMinutes =
    closingMinutesRaw === 0
      ? 1440
      : closingMinutesRaw;

  // ==========================================================
  // HOURS LIST
  // ==========================================================

  const hoursList =
    useMemo(() => {
      const result: string[] = [];

      const startHour = Math.floor(
        openingMinutes / 60
      );

      const endHour =
        Math.ceil(
          closingMinutes / 60
        );

      for (
        let hour = startHour;
        hour < endHour;
        hour++
      ) {
        const normalized =
          hour % 24;

        result.push(
          `${String(
            normalized
          ).padStart(
            2,
            '0'
          )}:00`
        );
      }

      return result;
    }, [
      openingMinutes,
      closingMinutes,
    ]);

  // ==========================================================
  // FILTER DAY RESERVATIONS
  // ==========================================================

  const dayReservations =
    useMemo(() => {
      return reservations.filter(
        (reservation) => {
          if (
            reservation.status ===
            'CANCELLED'
          ) {
            return false;
          }

          return (
            getArenaDate(
              reservation.start_at
            ) ===
            selectedDate
          );
        }
      );
    }, [
      reservations,
      selectedDate,
    ]);

  // ==========================================================
  // FILTER DAY BLOCKS
  // ==========================================================

  const dayBlocks =
    useMemo(() => {
      return courtBlocks.filter(
        (block) => {
          return (
            getArenaDate(
              block.start_at
            ) ===
            selectedDate
          );
        }
      );
    }, [
      courtBlocks,
      selectedDate,
    ]);

  // ==========================================================
  // TIMELINE HEIGHT
  // ==========================================================

  const timelineHeight =
    hoursList.length *
    SLOT_HEIGHT;

  // ==========================================================
  // RESERVATION POSITION
  // ==========================================================

  const getReservationTimeline =
    (
      reservation: Reservation
    ) => {
      const startMinutes =
        dateTimeToMinutes(
          reservation.start_at
        );

      const endMinutes =
        dateTimeToMinutes(
          reservation.end_at
        );

      return calculateTimelineItem(
        startMinutes,
        endMinutes,
        openingMinutes
      );
    };

  // ==========================================================
  // BLOCK POSITION
  // ==========================================================

  const getBlockTimeline = (
    block: CourtBlock
  ) => {
    const startMinutes =
      dateTimeToMinutes(
        block.start_at
      );

    const endMinutes =
      dateTimeToMinutes(
        block.end_at
      );

    return calculateTimelineItem(
      startMinutes,
      endMinutes,
      openingMinutes
    );
  };

  // ==========================================================
  // FIND RESERVATION FOR SLOT
  // ==========================================================

  const getReservationForSlot =
    (
      courtId: string,
      slotStartMinutes: number,
      slotEndMinutes: number
    ) => {
      return dayReservations.find(
        (reservation) => {
          if (
            reservation.court_id !==
            courtId
          ) {
            return false;
          }

          const reservationStart =
            dateTimeToMinutes(
              reservation.start_at
            );

          let reservationEnd =
            dateTimeToMinutes(
              reservation.end_at
            );

          if (
            reservationEnd <=
            reservationStart
          ) {
            reservationEnd +=
              1440;
          }

          /*
           * Intervalos matemáticos:
           *
           * slotStart < reservationEnd
           * &&
           * slotEnd > reservationStart
           */
          return (
            slotStartMinutes <
              reservationEnd &&
            slotEndMinutes >
              reservationStart
          );
        }
      );
    };

  // ==========================================================
  // FIND BLOCK FOR SLOT
  // ==========================================================

  const getBlockForSlot =
    (
      courtId: string,
      slotStartMinutes: number,
      slotEndMinutes: number
    ) => {
      return dayBlocks.find(
        (block) => {
          if (
            block.court_id !==
            courtId
          ) {
            return false;
          }

          const blockStart =
            dateTimeToMinutes(
              block.start_at
            );

          let blockEnd =
            dateTimeToMinutes(
              block.end_at
            );

          if (
            blockEnd <=
            blockStart
          ) {
            blockEnd +=
              1440;
          }

          return (
            slotStartMinutes <
              blockEnd &&
            slotEndMinutes >
              blockStart
          );
        }
      );
    };

  // ==========================================================
  // EMPTY COURTS
  // ==========================================================

  if (
    courts.length === 0
  ) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">

        <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>

        <p className="text-sm font-semibold text-slate-300">
          Nenhuma quadra encontrada
        </p>

        <p className="text-xs text-slate-500">
          Cadastre novas quadras ou ajuste os filtros da agenda.
        </p>

      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-fadeIn">

      <div className="overflow-x-auto">

        <div
          className="min-w-[900px]"
        >

          {/* ==================================================
              HEADER
          ================================================== */}

          <div
            className="grid gap-2 p-3 bg-slate-950/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md"
            style={{
              gridTemplateColumns:
                `90px repeat(${courts.length}, minmax(190px, 1fr))`,
            }}
          >

            {/* TIME HEADER */}

            <div className="flex items-center justify-center">

              <span className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Horário
              </span>

            </div>

            {/* COURTS */}

            {courts.map(
              (court) => (

                <div
                  key={
                    court.id
                  }
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-sm"
                >

                  <div className="flex items-center justify-between gap-2">

                    <span className="truncate text-sm font-bold text-slate-100">
                      {court.name}
                    </span>

                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-teal-400 border border-teal-500/20">
                      {court.modality?.name ||
                        'Esporte'}
                    </span>

                  </div>

                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">

                    <span>
                      Cap:{' '}
                      {court.capacity ||
                        4}{' '}
                      atletas
                    </span>

                    <span className="text-emerald-400 font-bold">
                      R${' '}
                      {Number(
                        court.price ||
                          0
                      ).toFixed(
                        2
                      )}
                      /h
                    </span>

                  </div>

                </div>

              )
            )}

          </div>

          {/* ==================================================
              TIMELINE AREA
          ================================================== */}

          <div
            className="grid gap-2 p-2"
            style={{
              gridTemplateColumns:
                `90px repeat(${courts.length}, minmax(190px, 1fr))`,
            }}
          >

            {/* =================================================
                TIME COLUMN
            ================================================= */}

            <div
              className="relative"
              style={{
                height:
                  timelineHeight,
              }}
            >

              {hoursList.map(
                (
                  hour,
                  index
                ) => (

                  <div
                    key={
                      hour
                    }
                    className="absolute left-0 right-0 flex items-center justify-center"
                    style={{
                      top:
                        index *
                        SLOT_HEIGHT,
                      height:
                        SLOT_HEIGHT,
                    }}
                  >

                    <div className="flex items-center gap-1.5">

                      <Clock className="w-3.5 h-3.5 text-slate-500" />

                      <span className="font-mono text-xs font-bold text-slate-400">
                        {hour}
                      </span>

                    </div>

                  </div>

                )
              )}

            </div>

            {/* =================================================
                COURT COLUMNS
            ================================================= */}

            {courts.map(
              (court) => {

                const courtReservations =
                  dayReservations.filter(
                    (
                      reservation
                    ) =>
                      reservation.court_id ===
                      court.id
                  );

                const courtBlocks =
                  dayBlocks.filter(
                    (block) =>
                      block.court_id ===
                      court.id
                  );

                return (

                  <div
                    key={
                      court.id
                    }
                    className="relative"
                    style={{
                      height:
                        timelineHeight,
                    }}
                  >

                    {/* ========================================
                        HOURLY BACKGROUND SLOTS
                    ======================================== */}

                    {hoursList.map(
                      (
                        hour,
                        index
                      ) => {

                        const slotStart =
                          openingMinutes +
                          index *
                            60;

                        const slotEnd =
                          slotStart +
                          60;

                        const reservation =
                          getReservationForSlot(
                            court.id,
                            slotStart,
                            slotEnd
                          );

                        const block =
                          getBlockForSlot(
                            court.id,
                            slotStart,
                            slotEnd
                          );

                        /*
                         * Quando uma reserva ou bloqueio
                         * ocupa este horário, não deixamos
                         * o slot livre receber clique.
                         *
                         * A reserva/bloqueio será desenhado
                         * por cima pela camada de timeline.
                         */

                        return (

                          <div
                            key={`${court.id}-${hour}`}
                            onClick={() => {

                              if (
                                reservation ||
                                block
                              ) {
                                return;
                              }

                              onSelectSlot(
                                court,
                                hour
                              );

                            }}
                            className={`absolute left-0 right-0 p-1 ${
                              reservation ||
                              block
                                ? 'cursor-default'
                                : 'cursor-pointer'
                            }`}
                            style={{
                              top:
                                index *
                                SLOT_HEIGHT,
                              height:
                                SLOT_HEIGHT,
                            }}
                          >

                            <div
                              className={`h-full rounded-2xl border transition ${
                                reservation ||
                                block
                                  ? 'border-transparent bg-transparent'
                                  : 'border-dashed border-slate-800/90 bg-slate-950/20 hover:border-emerald-500/60 hover:bg-emerald-500/5'
                              }`}
                            >

                              {!reservation &&
                                !block && (
                                  <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition">

                                    <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">

                                      <Plus className="w-3.5 h-3.5" />

                                      <span>
                                        Disponível
                                      </span>

                                    </div>

                                  </div>
                                )}

                            </div>

                          </div>

                        );
                      }
                    )}

                    {/* ========================================
                        GRID LINES
                    ======================================== */}

                    {hoursList.map(
                      (
                        hour,
                        index
                      ) => (

                        <div
                          key={`line-${court.id}-${hour}`}
                          className="absolute left-0 right-0 border-t border-slate-800/30 pointer-events-none"
                          style={{
                            top:
                              index *
                              SLOT_HEIGHT,
                          }}
                        />

                      )
                    )}

                    {/* ========================================
                        RESERVATIONS
                    ======================================== */}

                    {courtReservations.map(
                      (
                        reservation
                      ) => {

                        const timeline =
                          getReservationTimeline(
                            reservation
                          );

                        /*
                         * Ignora reservas que começam
                         * antes da abertura e ficam
                         * completamente fora da grade.
                         */

                        const bottom =
                          timeline.top +
                          timeline.height;

                        if (
                          bottom <=
                          0 ||
                          timeline.top >=
                            timelineHeight
                        ) {
                          return null;
                        }

                        const visibleTop =
                          Math.max(
                            4,
                            timeline.top +
                              4
                          );

                        const visibleBottom =
                          Math.min(
                            timelineHeight -
                              4,
                            bottom -
                              4
                          );

                        const visibleHeight =
                          Math.max(
                            52,
                            visibleBottom -
                              visibleTop
                          );

                        const isConfirmed =
                          reservation.status ===
                          'CONFIRMED';

                        const isPending =
                          reservation.status ===
                          'PENDING';

                        const isPaid =
                          reservation.payment_status ===
                          'PAID';

                        return (

                          <div
                            key={
                              reservation.id
                            }
                            onClick={() =>
                              onSelectReservation(
                                reservation
                              )
                            }
                            className={`absolute left-1 right-1 rounded-2xl p-3 cursor-pointer transition shadow-xl z-10 overflow-hidden ${
                              isPending
                                ? 'bg-amber-950/90 border border-amber-500/50 hover:border-amber-300 hover:bg-amber-950'
                                : isConfirmed
                                ? 'bg-indigo-950/90 border border-indigo-500/50 hover:border-indigo-300 hover:bg-indigo-950'
                                : 'bg-slate-800/95 border border-slate-600 hover:border-slate-400'
                            }`}
                            style={{
                              top:
                                visibleTop,
                              height:
                                visibleHeight,
                            }}
                            title={`Reserva: ${
                              reservation
                                .customer
                                ?.full_name ||
                              'Cliente'
                            }`}
                          >

                            {/* TOP */}

                            <div className="flex items-start justify-between gap-2">

                              <div className="flex items-center gap-1.5 min-w-0">

                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isPending
                                      ? 'bg-amber-400'
                                      : isConfirmed
                                      ? 'bg-indigo-400'
                                      : 'bg-slate-400'
                                  }`}
                                />

                                <User className="w-3.5 h-3.5 text-slate-300 shrink-0" />

                                <span className="font-bold text-white text-xs truncate">
                                  {reservation
                                    .customer
                                    ?.full_name ||
                                    'Cliente'}
                                </span>

                              </div>

                              <span
                                className={`shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                  isPaid
                                    ? 'text-emerald-300 bg-emerald-500/20'
                                    : 'text-amber-300 bg-amber-500/10'
                                }`}
                              >
                                {isPaid
                                  ? 'PAGO'
                                  : 'PENDENTE'}
                              </span>

                            </div>

                            {/* TIME */}

                            <div className="mt-2 flex items-center justify-between gap-2">

                              <div className="flex items-center gap-1 text-teal-300">

                                <Clock className="w-3 h-3" />

                                <span className="font-mono text-[10px] font-bold">
                                  {getArenaTime(
                                    reservation.start_at
                                  )}
                                  {' - '}
                                  {getArenaTime(
                                    reservation.end_at
                                  )}
                                </span>

                              </div>

                              <div className="flex items-center gap-1 text-emerald-300">

                                <DollarSign className="w-3 h-3" />

                                <span className="text-[10px] font-bold">
                                  R${' '}
                                  {Number(
                                    reservation.amount ||
                                      0
                                  ).toFixed(
                                    2
                                  )}
                                </span>

                              </div>

                            </div>

                            {/* STATUS */}

                            {visibleHeight >=
                              110 && (

                              <div className="mt-2 flex items-center gap-1 text-[9px] text-slate-400">

                                {isPaid ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 text-amber-400" />
                                )}

                                <span>
                                  {reservation.status ===
                                  'CONFIRMED'
                                    ? 'Reserva confirmada'
                                    : reservation.status ===
                                      'PENDING'
                                    ? 'Pagamento pendente'
                                    : reservation.status}
                                </span>

                              </div>

                            )}

                          </div>

                        );
                      }
                    )}

                    {/* ========================================
                        COURT BLOCKS
                    ======================================== */}

                    {courtBlocks.map(
                      (block) => {

                        const timeline =
                          getBlockTimeline(
                            block
                          );

                        const bottom =
                          timeline.top +
                          timeline.height;

                        if (
                          bottom <=
                          0 ||
                          timeline.top >=
                            timelineHeight
                        ) {
                          return null;
                        }

                        const visibleTop =
                          Math.max(
                            4,
                            timeline.top +
                              4
                          );

                        const visibleBottom =
                          Math.min(
                            timelineHeight -
                              4,
                            bottom -
                              4
                          );

                        const visibleHeight =
                          Math.max(
                            52,
                            visibleBottom -
                              visibleTop
                          );

                        return (

                          <div
                            key={
                              block.id
                            }
                            onClick={() =>
                              onSelectBlock(
                                block
                              )
                            }
                            className="absolute left-1 right-1 rounded-2xl bg-amber-950/90 border border-amber-500/50 hover:border-amber-300 hover:bg-amber-950 p-3 cursor-pointer transition shadow-xl z-20 overflow-hidden"
                            style={{
                              top:
                                visibleTop,
                              height:
                                visibleHeight,
                            }}
                            title={`Bloqueio: ${
                              block.reason
                            }`}
                          >

                            <div className="flex items-start justify-between gap-2">

                              <div className="flex items-center gap-1.5 min-w-0">

                                <Lock className="w-4 h-4 text-amber-400 shrink-0" />

                                <span className="text-xs font-bold text-amber-300 truncate">
                                  BLOQUEADO
                                </span>

                              </div>

                              <span className="font-mono text-[9px] text-amber-300/80 shrink-0">
                                {getArenaTime(
                                  block.start_at
                                )}
                                {' - '}
                                {getArenaTime(
                                  block.end_at
                                )}
                              </span>

                            </div>

                            <div className="mt-2 text-[11px] font-semibold text-slate-200 truncate">
                              {block.reason ||
                                'Bloqueio operacional'}
                            </div>

                            {visibleHeight >=
                              100 &&
                              block.notes && (

                                <div className="mt-1 text-[9px] text-slate-400 line-clamp-2">
                                  {
                                    block.notes
                                  }
                                </div>

                              )}

                          </div>

                        );
                      }
                    )}

                  </div>

                );
              }
            )}

          </div>

        </div>

      </div>

      {/* ======================================================
          LEGEND
      ====================================================== */}

      <div className="border-t border-slate-800 bg-slate-950/50 px-4 py-3">

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px]">

          <div className="flex items-center gap-1.5">

            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />

            <span className="text-slate-400">
              Reserva confirmada
            </span>

          </div>

          <div className="flex items-center gap-1.5">

            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />

            <span className="text-slate-400">
              Pagamento pendente
            </span>

          </div>

          <div className="flex items-center gap-1.5">

            <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />

            <span className="text-slate-400">
              Horário bloqueado
            </span>

          </div>

          <div className="flex items-center gap-1.5">

            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-emerald-500" />

            <span className="text-slate-400">
              Disponível
            </span>

          </div>

        </div>

      </div>

    </div>
  );
};