import React, { useMemo } from 'react';
import { Court, CourtBlock, Reservation } from '../../types';
import { Clock, Lock, CheckCircle2, AlertCircle, Plus, DollarSign, User } from 'lucide-react';

interface AgendaDailyViewProps {
  courts: Court[];
  reservations: Reservation[];
  courtBlocks: CourtBlock[];
  selectedDate: string; // YYYY-MM-DD
  openingTime: string; // e.g. "06:00"
  closingTime: string; // e.g. "23:00"
  onSelectSlot: (court: Court, hour: string) => void;
  onSelectReservation: (reservation: Reservation) => void;
  onSelectBlock: (block: CourtBlock) => void;
}

export const AgendaDailyView: React.FC<AgendaDailyViewProps> = ({
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
  // Generate operating hours array
  const hoursList = useMemo(() => {
    const startHour = parseInt(openingTime.split(':')[0], 10) || 6;
    let endHour = parseInt(closingTime.split(':')[0], 10) || 23;
    if (endHour === 0) endHour = 24;

    const list: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
      const formatted = String(h % 24).padStart(2, '0') + ':00';
      list.push(formatted);
    }
    return list;
  }, [openingTime, closingTime]);

  // Filter reservations and blocks for the selected day
  const dayReservations = useMemo(() => {
    return reservations.filter(r => {
      if (r.status === 'CANCELLED') return false;
      const resDate = r.start_at.split('T')[0];
      return resDate === selectedDate;
    });
  }, [reservations, selectedDate]);

  const dayBlocks = useMemo(() => {
    return courtBlocks.filter(b => {
      const blockDate = b.start_at.split('T')[0];
      return blockDate === selectedDate;
    });
  }, [courtBlocks, selectedDate]);

  if (courts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
        <p className="text-sm font-semibold text-slate-300">Nenhuma quadra encontrada para os filtros selecionados.</p>
        <p className="text-xs text-slate-500">Cadastre novas quadras ou ajuste seus filtros na barra superior.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-fadeIn">
      <div className="overflow-x-auto">
        <div className="min-w-[800px] divide-y divide-slate-800/80">
          {/* Header Row: Court Names & Modality Badges */}
          <div 
            className="grid gap-2 p-3 bg-slate-950/90 text-xs font-bold text-slate-300 sticky top-0 z-10 backdrop-blur-md"
            style={{ gridTemplateColumns: `90px repeat(${courts.length}, minmax(160px, 1fr))` }}
          >
            <div className="flex items-center justify-center font-mono text-[11px] text-slate-500 uppercase tracking-wider">
              Horário
            </div>

            {courts.map((court) => (
              <div 
                key={court.id} 
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 flex flex-col justify-between space-y-1 shadow-sm"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-bold text-slate-100">{court.name}</span>
                  <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-teal-400 border border-teal-500/20">
                    {court.modality?.name || 'Esporte'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>Cap: {court.capacity || 4} atletas</span>
                  <span className="text-emerald-400 font-bold">R$ {court.price.toFixed(2)}/h</span>
                </div>
              </div>
            ))}
          </div>

          {/* Time Slots Grid */}
          <div className="divide-y divide-slate-800/40">
            {hoursList.map((hour) => {
              const hourInt = parseInt(hour.split(':')[0], 10);

              return (
                <div
                  key={hour}
                  className="grid gap-2 p-2 items-center hover:bg-slate-850/40 transition group"
                  style={{ gridTemplateColumns: `90px repeat(${courts.length}, minmax(160px, 1fr))` }}
                >
                  {/* Time Label Column */}
                  <div className="font-mono text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 py-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition" />
                    <span>{hour}</span>
                  </div>

                  {/* Court Cells */}
                  {courts.map((court) => {
                    // Check if there is an active reservation in this slot
                    const matchedRes = dayReservations.find((r) => {
                      if (r.court_id !== court.id) return false;
                      const resHour = new Date(r.start_at).getUTCHours();
                      return resHour === hourInt;
                    });

                    // Check if there is a court block in this slot
                    const matchedBlock = dayBlocks.find((b) => {
                      if (b.court_id !== court.id) return false;
                      const bStartHour = new Date(b.start_at).getUTCHours();
                      const bEndHour = new Date(b.end_at).getUTCHours();
                      return hourInt >= bStartHour && hourInt < bEndHour;
                    });

                    // 1. BLOCKED CELL
                    if (matchedBlock) {
                      return (
                        <div
                          key={court.id}
                          onClick={() => onSelectBlock(matchedBlock)}
                          className="h-14 rounded-2xl bg-slate-950/80 border border-amber-500/30 p-2 flex flex-col justify-between text-xs cursor-pointer hover:border-amber-400 hover:bg-slate-950 transition shadow-inner"
                          title={`Bloqueio: ${matchedBlock.reason}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>BLOQUEADO</span>
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {new Date(matchedBlock.start_at).getUTCHours()}:00 - {new Date(matchedBlock.end_at).getUTCHours()}:00
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-300 truncate font-medium">
                            {matchedBlock.reason}
                          </p>
                        </div>
                      );
                    }

                    // 2. RESERVED CELL
                    if (matchedRes) {
                      const isConfirmed = matchedRes.status === 'CONFIRMED';
                      const isPending = matchedRes.status === 'PENDING';
                      const isPaid = matchedRes.payment_status === 'PAID';

                      return (
                        <div
                          key={court.id}
                          onClick={() => onSelectReservation(matchedRes)}
                          className={`h-14 rounded-2xl p-2 flex flex-col justify-between text-xs cursor-pointer transition shadow-md ${
                            isConfirmed
                              ? 'bg-emerald-950/30 border border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/50'
                              : isPending
                              ? 'bg-amber-950/30 border border-amber-500/40 hover:border-amber-400 hover:bg-amber-950/50'
                              : 'bg-indigo-950/30 border border-indigo-500/40 hover:border-indigo-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 truncate">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConfirmed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                              <span className="font-bold text-slate-100 text-[11px] truncate">
                                {matchedRes.customer?.full_name || 'Cliente'}
                              </span>
                            </div>
                            <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                              isPaid ? 'text-emerald-300 bg-emerald-500/20' : 'text-slate-400 bg-slate-800'
                            }`}>
                              {isPaid ? 'PAGO' : 'PEND'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                            <span>R$ {matchedRes.amount.toFixed(2)}</span>
                            <span className="text-[10px] text-teal-300 font-mono">
                              {new Date(matchedRes.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(matchedRes.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // 3. FREE CELL (Available for Booking)
                    return (
                      <div
                        key={court.id}
                        onClick={() => onSelectSlot(court, hour)}
                        className="h-14 rounded-2xl bg-slate-950/30 border border-dashed border-slate-800/80 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition p-2 flex items-center justify-center text-xs cursor-pointer group/cell"
                      >
                        <div className="opacity-0 group-hover/cell:opacity-100 flex items-center gap-1 text-emerald-400 text-[11px] font-bold transition">
                          <Plus className="w-3.5 h-3.5" />
                          <span>Reservar</span>
                        </div>
                        <span className="group-hover/cell:hidden text-[10px] font-medium text-slate-600">
                          Disponível
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
