import React, { useMemo } from 'react';
import { Court, CourtBlock, Reservation } from '../../types';
import { Calendar, Clock, Lock, Plus, CheckCircle2, ChevronRight, User } from 'lucide-react';

interface AgendaWeeklyViewProps {
  courts: Court[];
  reservations: Reservation[];
  courtBlocks: CourtBlock[];
  selectedDate: string; // YYYY-MM-DD
  onSelectSlot: (court: Court, hour: string, date: string) => void;
  onSelectReservation: (reservation: Reservation) => void;
  onSelectBlock: (block: CourtBlock) => void;
  onSelectDay: (dateStr: string) => void;
}

export const AgendaWeeklyView: React.FC<AgendaWeeklyViewProps> = ({
  courts,
  reservations,
  courtBlocks,
  selectedDate,
  onSelectSlot,
  onSelectReservation,
  onSelectBlock,
  onSelectDay,
}) => {
  // Generate 7 days of the selected week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const current = new Date(selectedDate + 'T12:00:00.000Z');
    const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 1 = Monday...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(current);
    monday.setUTCDate(current.getUTCDate() + diffToMonday);

    const days = [];
    const dayNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      const isoStr = d.toISOString().split('T')[0];
      const dayNum = d.getUTCDate();
      const monthNum = d.getUTCMonth() + 1;
      const isToday = isoStr === new Date().toISOString().split('T')[0];
      const isSelected = isoStr === selectedDate;

      days.push({
        label: `${dayNames[i]} ${dayNum < 10 ? '0' + dayNum : dayNum}/${monthNum < 10 ? '0' + monthNum : monthNum}`,
        dayName: dayNames[i],
        dayNumber: dayNum,
        isoDate: isoStr,
        isToday,
        isSelected,
      });
    }
    return days;
  }, [selectedDate]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-fadeIn">
      {/* 7 Days Columns Container */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px] grid grid-cols-7 divide-x divide-slate-800/80">
          {weekDays.map((day) => {
            const dayRes = reservations.filter(r => {
              if (r.status === 'CANCELLED') return false;
              return r.start_at.split('T')[0] === day.isoDate;
            });

            const dayBlk = courtBlocks.filter(b => {
              return b.start_at.split('T')[0] === day.isoDate;
            });

            return (
              <div 
                key={day.isoDate} 
                className={`flex flex-col min-h-[480px] bg-slate-900/40 transition ${
                  day.isSelected ? 'bg-slate-800/20' : ''
                }`}
              >
                {/* Day Header */}
                <div 
                  onClick={() => onSelectDay(day.isoDate)}
                  className={`p-3 border-b border-slate-800 flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                    day.isToday 
                      ? 'bg-emerald-500/10 border-b-emerald-500/40 text-emerald-400' 
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold tracking-wider">{day.dayName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                      day.isToday ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200'
                    }`}>
                      {day.dayNumber}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {dayRes.length} {dayRes.length === 1 ? 'reserva' : 'reservas'}
                  </div>
                </div>

                {/* Day Items List */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[500px]">
                  {/* Blocks */}
                  {dayBlk.map((block) => (
                    <div
                      key={block.id}
                      onClick={() => onSelectBlock(block)}
                      className="p-2 rounded-2xl bg-slate-950/90 border border-amber-500/30 text-[11px] cursor-pointer hover:border-amber-400 transition space-y-1 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-400">
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Bloqueio</span>
                        </span>
                        <span className="font-mono">
                          {new Date(block.start_at).getUTCHours()}:00-{new Date(block.end_at).getUTCHours()}:00
                        </span>
                      </div>
                      <div className="text-slate-300 font-medium truncate text-[10px]">
                        {block.court?.name || 'Quadra'}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">
                        {block.reason}
                      </div>
                    </div>
                  ))}

                  {/* Reservations */}
                  {dayRes.map((res) => {
                    const isConfirmed = res.status === 'CONFIRMED';
                    const startTime = new Date(res.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const endTime = new Date(res.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={res.id}
                        onClick={() => onSelectReservation(res)}
                        className={`p-2.5 rounded-2xl border text-[11px] cursor-pointer transition space-y-1.5 shadow-md ${
                          isConfirmed
                            ? 'bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/40'
                            : 'bg-amber-950/25 border-amber-500/40 hover:border-amber-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-100 truncate text-[11px]">
                            {res.customer?.full_name || 'Cliente'}
                          </span>
                          <span className="text-[9px] font-mono text-teal-400 font-bold shrink-0">
                            {startTime}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="truncate">{res.court?.name}</span>
                          <span className="text-emerald-400 font-semibold font-mono">R${res.amount}</span>
                        </div>
                      </div>
                    );
                  })}

                  {dayRes.length === 0 && dayBlk.length === 0 && (
                    <div 
                      onClick={() => {
                        if (courts.length > 0) {
                          onSelectSlot(courts[0], '18:00', day.isoDate);
                        }
                      }}
                      className="h-28 rounded-2xl border border-dashed border-slate-800/60 hover:border-emerald-500/40 hover:bg-emerald-500/5 flex flex-col items-center justify-center text-center p-3 text-slate-600 hover:text-emerald-400 transition cursor-pointer gap-1 group"
                    >
                      <Plus className="w-4 h-4 group-hover:scale-110 transition" />
                      <span className="text-[10px] font-semibold">Horários Livres</span>
                    </div>
                  )}
                </div>

                {/* Footer Quick Action */}
                <div className="p-2 border-t border-slate-800/80 shrink-0">
                  <button
                    onClick={() => {
                      if (courts.length > 0) {
                        onSelectSlot(courts[0], '18:00', day.isoDate);
                      }
                    }}
                    className="w-full py-1.5 px-2 bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 rounded-xl text-[10px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nova Reserva</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
