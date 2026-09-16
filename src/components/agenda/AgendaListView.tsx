import React from 'react';

import {
  CourtBlock,
  Reservation,
} from '../../types';

import {
  Calendar,
  Clock,
  DollarSign,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Ban,
  Lock,
  Edit3,
} from 'lucide-react';

import {
  formatArenaDate,
  getArenaTime,
} from '../../utils/agendaDate';

interface AgendaListViewProps {
  reservations: Reservation[];
  courtBlocks: CourtBlock[];
  onSelectReservation: (
    reservation: Reservation
  ) => void;
  onSelectBlock: (
    block: CourtBlock
  ) => void;
}

export const AgendaListView: React.FC<
  AgendaListViewProps
> = ({
  reservations,
  courtBlocks,
  onSelectReservation,
  onSelectBlock,
}) => {

  // ==========================================================
  // TODOS OS ITENS
  // ==========================================================

  const allItems = React.useMemo(() => {

    const reservationItems =
      reservations.map(
        (reservation) => ({
          type:
            'reservation' as const,

          id:
            reservation.id,

          timestamp:
            new Date(
              reservation.start_at
            ).getTime(),

          data:
            reservation,
        })
      );

    const blockItems =
      courtBlocks.map(
        (block) => ({
          type:
            'block' as const,

          id:
            block.id,

          timestamp:
            new Date(
              block.start_at
            ).getTime(),

          data:
            block,
        })
      );

    return [
      ...reservationItems,
      ...blockItems,
    ].sort(
      (a, b) =>
        a.timestamp -
        b.timestamp
    );

  }, [
    reservations,
    courtBlocks,
  ]);

  // ==========================================================
  // VAZIO
  // ==========================================================

  if (
    allItems.length === 0
  ) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">

        <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <Calendar className="w-6 h-6" />
        </div>

        <p className="text-sm font-semibold text-slate-200">
          Nenhum agendamento ou bloqueio encontrado
        </p>

        <p className="text-xs text-slate-500">
          Altere os filtros de data, quadra ou status para visualizar mais itens.
        </p>

      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-3 animate-fadeIn">

      {allItems.map(
        (item) => {

          // ==================================================
          // BLOQUEIO
          // ==================================================

          if (
            item.type ===
            'block'
          ) {

            const block =
              item.data;

            const dateFormatted =
              formatArenaDate(
                block.start_at
              );

            const startTime =
              getArenaTime(
                block.start_at
              );

            const endTime =
              getArenaTime(
                block.end_at
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
                className="bg-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition shadow-md group"
              >

                <div className="flex items-start sm:items-center gap-3">

                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">

                    <div className="flex items-center gap-2 flex-wrap">

                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                        Bloqueio Operacional
                      </span>

                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono font-semibold">
                        {block.court?.name ||
                          'Quadra'}
                      </span>

                    </div>

                    <h4 className="text-sm font-semibold text-slate-100 mt-0.5 truncate">
                      {block.reason ||
                        'Bloqueio operacional'}
                    </h4>

                    {block.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {block.notes}
                      </p>
                    )}

                  </div>

                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">

                  <div className="text-right">

                    <div className="text-xs font-semibold text-slate-200">
                      {dateFormatted}
                    </div>

                    <div className="text-xs text-amber-400/90 font-mono font-bold">
                      {startTime}
                      {' - '}
                      {endTime}
                    </div>

                  </div>

                  <button
                    type="button"
                    className="px-3 py-1.5 bg-slate-800 group-hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer"
                  >
                    Gerenciar
                  </button>

                </div>

              </div>
            );
          }

          // ==================================================
          // RESERVA
          // ==================================================

          const reservation =
            item.data;

          const dateFormatted =
            formatArenaDate(
              reservation.start_at
            );

          const startTime =
            getArenaTime(
              reservation.start_at
            );

          const endTime =
            getArenaTime(
              reservation.end_at
            );

          const isCancelled =
            reservation.status ===
            'CANCELLED';

          const isPending =
            reservation.status ===
            'PENDING';

          const isCompleted =
            reservation.status ===
            'COMPLETED';

          const isNoShow =
            reservation.status ===
            'NO_SHOW';

          const isPaid =
            reservation.payment_status ===
            'PAID';

          let statusLabel =
            'Confirmada';

          if (
            isPending
          ) {
            statusLabel =
              'Pendente';
          }

          if (
            isCompleted
          ) {
            statusLabel =
              'Concluída';
          }

          if (
            isNoShow
          ) {
            statusLabel =
              'Não compareceu';
          }

          if (
            isCancelled
          ) {
            statusLabel =
              'Cancelada';
          }

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
              className={`bg-slate-900 border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer transition shadow-md group ${
                isCancelled
                  ? 'border-rose-500/20 hover:border-rose-400/40'
                  : isPending
                  ? 'border-orange-500/30 hover:border-orange-400'
                  : 'border-blue-500/30 hover:border-blue-400'
              }`}
            >

              {/* CLIENTE */}

              <div className="flex items-start sm:items-center gap-3 min-w-0">

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCancelled
                      ? 'bg-rose-500/10 text-rose-400'
                      : isPending
                      ? 'bg-orange-500/10 text-orange-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}
                >
                  <User className="w-5 h-5" />
                </div>

                <div className="min-w-0">

                  <div className="flex items-center gap-2 flex-wrap">

                    <h4 className="text-sm font-bold text-slate-100 truncate">
                      {reservation.customer?.full_name ||
                        'Cliente'}
                    </h4>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        isCancelled
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : isPending
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                          : isCompleted
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {statusLabel}
                    </span>

                  </div>

                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 flex-wrap">

                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {dateFormatted}
                    </span>

                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {startTime}
                      {' - '}
                      {endTime}
                    </span>

                    {reservation.customer?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {reservation.customer.phone}
                      </span>
                    )}

                  </div>

                </div>

              </div>

              {/* QUADRA */}

              <div className="flex items-center gap-2 lg:min-w-[180px]">

                <div className="text-right lg:text-left">

                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                    Quadra
                  </div>

                  <div className="text-xs text-slate-200 font-semibold">
                    {reservation.court?.name ||
                      'Quadra'}
                  </div>

                  <div className="text-[10px] text-teal-400">
                    {reservation.court?.modality?.name ||
                      'Modalidade'}
                  </div>

                </div>

              </div>

              {/* VALOR */}

              <div className="flex items-center justify-between lg:justify-end gap-5">

                <div className="text-right">

                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                    Valor
                  </div>

                  <div className="text-sm font-black text-emerald-400">
                    R${' '}
                    {Number(
                      reservation.amount ||
                        0
                    ).toFixed(2)}
                  </div>

                  <div
                    className={`text-[9px] font-bold ${
                      isPaid
                        ? 'text-emerald-400'
                        : 'text-orange-400'
                    }`}
                  >
                    {isPaid
                      ? 'PAGO'
                      : 'PAGAMENTO PENDENTE'}
                  </div>

                </div>

                <button
                  type="button"
                  className="px-3 py-1.5 bg-slate-800 group-hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3 h-3" />
                  Gerenciar
                </button>

              </div>

            </div>
          );
        }
      )}

    </div>
  );
};