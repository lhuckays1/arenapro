import React, { useMemo } from 'react';
import {
  Court,
  CourtBlock,
  Reservation,
} from '../../types';

import {
  Calendar,
  Clock,
  Lock,
  Plus,
  CheckCircle2,
  ChevronRight,
  User,
} from 'lucide-react';

import {
  addCalendarDays,
  getArenaDate,
  getArenaTime,
  getTodayArenaDate,
} from '../../utils/agendaDate';

interface AgendaWeeklyViewProps {
  courts: Court[];
  reservations: Reservation[];
  courtBlocks: CourtBlock[];
  selectedDate: string;
  onSelectSlot: (
    court: Court,
    hour: string,
    date: string
  ) => void;
  onSelectReservation: (
    reservation: Reservation
  ) => void;
  onSelectBlock: (
    block: CourtBlock
  ) => void;
  onSelectDay: (
    dateStr: string
  ) => void;
}

export const AgendaWeeklyView: React.FC<
  AgendaWeeklyViewProps
> = ({
  courts,
  reservations,
  courtBlocks,
  selectedDate,
  onSelectSlot,
  onSelectReservation,
  onSelectBlock,
  onSelectDay,
}) => {
  // ==========================================================
  // SEMANA ATUAL
  // ==========================================================

  const weekDays = useMemo(() => {
    /*
     * selectedDate é uma data de calendário:
     * YYYY-MM-DD
     *
     * Não utilizamos UTC para descobrir o dia da semana.
     */

    const baseDate =
      new Date(
        `${selectedDate}T12:00:00`
      );

    const dayOfWeek =
      baseDate.getDay();

    const diffToMonday =
      dayOfWeek === 0
        ? -6
        : 1 - dayOfWeek;

    const monday =
      new Date(baseDate);

    monday.setDate(
      monday.getDate() +
        diffToMonday
    );

    const dayNames = [
      'SEG',
      'TER',
      'QUA',
      'QUI',
      'SEX',
      'SÁB',
      'DOM',
    ];

    return Array.from(
      { length: 7 },
      (_, index) => {
        const day =
          new Date(monday);

        day.setDate(
          monday.getDate() +
            index
        );

        const year =
          day.getFullYear();

        const month =
          String(
            day.getMonth() + 1
          ).padStart(2, '0');

        const dayNumber =
          String(
            day.getDate()
          ).padStart(2, '0');

        const isoDate =
          `${year}-${month}-${dayNumber}`;

        return {
          label: `${dayNames[index]} ${dayNumber}/${month}`,
          dayName:
            dayNames[index],
          dayNumber:
            day.getDate(),
          isoDate,
          isToday:
            isoDate ===
            getTodayArenaDate(),
          isSelected:
            isoDate ===
            selectedDate,
        };
      }
    );
  }, [selectedDate]);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-fadeIn">

      <div className="overflow-x-auto">

        <div className="min-w-[900px] grid grid-cols-7 divide-x divide-slate-800/80">

          {weekDays.map((day) => {

            // ==================================================
            // RESERVAS DO DIA
            // ==================================================

            const dayReservations =
              reservations
                .filter((reservation) => {
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
                    day.isoDate
                  );
                })
                .sort(
                  (a, b) =>
                    new Date(
                      a.start_at
                    ).getTime() -
                    new Date(
                      b.start_at
                    ).getTime()
                );

            // ==================================================
            // BLOQUEIOS DO DIA
            // ==================================================

            const dayBlocks =
              courtBlocks
                .filter((block) => {
                  return (
                    getArenaDate(
                      block.start_at
                    ) ===
                    day.isoDate
                  );
                })
                .sort(
                  (a, b) =>
                    new Date(
                      a.start_at
                    ).getTime() -
                    new Date(
                      b.start_at
                    ).getTime()
                );

            return (
              <div
                key={day.isoDate}
                className={`flex flex-col min-h-[480px] bg-slate-900/40 transition ${
                  day.isSelected
                    ? 'bg-slate-800/20'
                    : ''
                }`}
              >

                {/* ==================================================
                    CABEÇALHO DO DIA
                ================================================== */}

                <div
                  onClick={() =>
                    onSelectDay(
                      day.isoDate
                    )
                  }
                  className={`p-3 border-b border-slate-800 flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                    day.isToday
                      ? 'bg-emerald-500/10 border-b-emerald-500/40 text-emerald-400'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >

                  <div className="flex items-center gap-1.5">

                    <span className="text-xs font-bold tracking-wider">
                      {day.dayName}
                    </span>

                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                        day.isToday
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                  </div>

                  <div className="text-[10px] text-slate-400 font-medium">
                    {dayReservations.length}{' '}
                    {dayReservations.length ===
                    1
                      ? 'reserva'
                      : 'reservas'}
                  </div>

                </div>

                {/* ==================================================
                    ITENS DO DIA
                ================================================== */}

                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[500px]">

                  {/* ==================================================
                      BLOQUEIOS
                  ================================================== */}

                  {dayBlocks.map(
                    (block) => (
                      <div
                        key={block.id}
                        onClick={() =>
                          onSelectBlock(
                            block
                          )
                        }
                        className="p-2 rounded-2xl bg-slate-950/90 border border-amber-500/30 text-[11px] cursor-pointer hover:border-amber-400 hover:bg-slate-950 transition space-y-1 shadow-sm"
                      >

                        <div className="flex items-center justify-between text-[10px] font-bold text-amber-400 gap-2">

                          <span className="flex items-center gap-1 truncate">
                            <Lock className="w-3 h-3 shrink-0" />
                            <span>
                              Bloqueio
                            </span>
                          </span>

                          <span className="font-mono whitespace-nowrap">
                            {getArenaTime(
                              block.start_at
                            )}
                            {' - '}
                            {getArenaTime(
                              block.end_at
                            )}
                          </span>

                        </div>

                        <div className="text-slate-200 font-semibold truncate">
                          {block.reason ||
                            'Bloqueio operacional'}
                        </div>

                        <div className="text-[9px] text-slate-500">
                          {block.court?.name ||
                            'Quadra'}
                        </div>

                      </div>
                    )
                  )}

                  {/* ==================================================
                      RESERVAS
                  ================================================== */}

                  {dayReservations.map(
                    (reservation) => {

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
                          className={`p-2.5 rounded-2xl border text-[11px] cursor-pointer transition shadow-sm ${
                            isPending
                              ? 'bg-orange-950/30 border-orange-500/40 hover:border-orange-400 hover:bg-orange-950/50'
                              : isConfirmed
                              ? 'bg-blue-950/30 border-blue-500/40 hover:border-blue-400 hover:bg-blue-950/50'
                              : 'bg-indigo-950/30 border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-950/50'
                          }`}
                        >

                          <div className="flex items-center justify-between gap-2">

                            <div className="flex items-center gap-1.5 min-w-0">

                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isPending
                                    ? 'bg-orange-400'
                                    : isConfirmed
                                    ? 'bg-blue-400'
                                    : 'bg-indigo-400'
                                }`}
                              />

                              <User className="w-3 h-3 text-slate-400 shrink-0" />

                              <span className="font-bold text-slate-100 truncate">
                                {reservation.customer?.full_name ||
                                  'Cliente'}
                              </span>

                            </div>

                            <span
                              className={`text-[8px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                isPaid
                                  ? 'text-emerald-300 bg-emerald-500/20'
                                  : 'text-orange-300 bg-orange-500/10'
                              }`}
                            >
                              {isPaid
                                ? 'PAGO'
                                : 'PEND'}
                            </span>

                          </div>

                          <div className="flex items-center justify-between gap-2 mt-1.5">

                            <span className="text-[10px] text-slate-400 truncate">
                              {reservation.court?.name ||
                                'Quadra'}
                            </span>

                            <span className="font-mono text-[10px] text-teal-300 whitespace-nowrap">
                              {getArenaTime(
                                reservation.start_at
                              )}
                              {' - '}
                              {getArenaTime(
                                reservation.end_at
                              )}
                            </span>

                          </div>

                          <div className="flex items-center justify-between mt-1">

                            <span className="text-[10px] text-emerald-400 font-semibold">
                              R${' '}
                              {Number(
                                reservation.amount ||
                                  0
                              ).toFixed(2)}
                            </span>

                            <span className="text-[9px] text-slate-500">
                              {reservation.status ===
                              'COMPLETED'
                                ? 'Concluída'
                                : reservation.status ===
                                  'NO_SHOW'
                                ? 'No-show'
                                : reservation.status ===
                                  'CANCELLED'
                                ? 'Cancelada'
                                : ''}
                            </span>

                          </div>

                        </div>
                      );
                    }
                  )}

                  {/* ==================================================
                      VAZIO
                  ================================================== */}

                  {dayReservations.length ===
                    0 &&
                    dayBlocks.length ===
                      0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectDay(
                            day.isoDate
                          )
                        }
                        className="w-full min-h-[120px] rounded-2xl border border-dashed border-slate-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-emerald-400 transition cursor-pointer"
                      >

                        <Plus className="w-5 h-5" />

                        <span className="text-[10px] font-semibold">
                          Nenhum agendamento
                        </span>

                        <span className="text-[9px]">
                          Clique para abrir o dia
                        </span>

                      </button>
                    )}

                </div>

                {/* ==================================================
                    RODAPÉ
                ================================================== */}

                <div className="px-3 py-2 border-t border-slate-800/70 bg-slate-950/30">

                  <div className="flex items-center justify-between">

                    <span className="text-[9px] text-slate-500">
                      {dayBlocks.length}{' '}
                      {dayBlocks.length ===
                      1
                        ? 'bloqueio'
                        : 'bloqueios'}
                    </span>

                    <ChevronRight className="w-3 h-3 text-slate-600" />

                  </div>

                </div>

              </div>
            );
          })}

        </div>

      </div>

      {/* ======================================================
          LEGENDA
      ====================================================== */}

      <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-3">

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-[10px] text-slate-400">
              Confirmada
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="text-[10px] text-slate-400">
              Pendente
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[10px] text-slate-400">
              Bloqueio
            </span>
          </div>

        </div>

      </div>

    </div>
  );
};