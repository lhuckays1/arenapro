import React from 'react';
import { CourtBlock, Reservation } from '../../types';
import { Calendar, Clock, DollarSign, User, Phone, CheckCircle2, AlertCircle, Ban, Lock, Edit3 } from 'lucide-react';

interface AgendaListViewProps {
  reservations: Reservation[];
  courtBlocks: CourtBlock[];
  onSelectReservation: (reservation: Reservation) => void;
  onSelectBlock: (block: CourtBlock) => void;
}

export const AgendaListView: React.FC<AgendaListViewProps> = ({
  reservations,
  courtBlocks,
  onSelectReservation,
  onSelectBlock,
}) => {
  // Combine and sort by date/start_at
  const allItems = React.useMemo(() => {
    const resItems = reservations.map(r => ({
      type: 'reservation' as const,
      id: r.id,
      timestamp: new Date(r.start_at).getTime(),
      data: r,
    }));

    const blockItems = courtBlocks.map(b => ({
      type: 'block' as const,
      id: b.id,
      timestamp: new Date(b.start_at).getTime(),
      data: b,
    }));

    return [...resItems, ...blockItems].sort((a, b) => a.timestamp - b.timestamp);
  }, [reservations, courtBlocks]);

  if (allItems.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
        <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <Calendar className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-200">Nenhum agendamento ou bloqueio encontrado</p>
        <p className="text-xs text-slate-500">Altere os filtros de data, quadra ou status para visualizar mais itens.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fadeIn">
      {allItems.map((item) => {
        if (item.type === 'block') {
          const block = item.data;
          const startDate = new Date(block.start_at);
          const dateFormatted = startDate.toLocaleDateString('pt-BR');
          const timeFormatted = `${String(startDate.getUTCHours()).padStart(2, '0')}:00 - ${String(new Date(block.end_at).getUTCHours()).padStart(2, '0')}:00`;

          return (
            <div
              key={block.id}
              onClick={() => onSelectBlock(block)}
              className="bg-slate-900 border border-amber-500/30 hover:border-amber-400 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition shadow-md group"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Bloqueio Operacional</span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono font-semibold">
                      {block.court?.name || 'Quadra'}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100 mt-0.5">{block.reason}</h4>
                  {block.notes && <p className="text-xs text-slate-400 mt-0.5">{block.notes}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-200">{dateFormatted}</div>
                  <div className="text-xs text-amber-400/90 font-mono font-bold">{timeFormatted}</div>
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

        const res = item.data;
        const startDate = new Date(res.start_at);
        const dateFormatted = startDate.toLocaleDateString('pt-BR');
        const startTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(res.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const isCancelled = res.status === 'CANCELLED';
        const isPaid = res.payment_status === 'PAID';

        return (
          <div
            key={res.id}
            onClick={() => onSelectReservation(res)}
            className={`bg-slate-900 border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition shadow-md group ${
              isCancelled 
                ? 'border-rose-950/40 opacity-70 bg-slate-950/40' 
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isCancelled
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : res.status === 'CONFIRMED'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                <User className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-100">{res.customer?.full_name || 'Cliente'}</h4>
                  <span className="text-[10px] bg-slate-800 text-teal-400 px-2 py-0.5 rounded-full font-semibold border border-teal-500/20">
                    {res.court?.name}
                  </span>
                  {res.court?.modality?.name && (
                    <span className="text-[10px] text-slate-400">
                      • {res.court.modality.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  {res.customer?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{res.customer.phone}</span>
                    </span>
                  )}
                  {res.notes && <span className="truncate max-w-[200px]">"{res.notes}"</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">
              <div className="text-left sm:text-right">
                <div className="text-xs font-semibold text-slate-200">{dateFormatted}</div>
                <div className="text-xs text-teal-400 font-mono font-bold">{startTime} - {endTime}</div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-emerald-400 font-mono">
                  R$ {res.amount.toFixed(2)}
                </div>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md font-mono ${
                    isPaid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {res.payment_status}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                    res.status === 'CONFIRMED' ? 'bg-emerald-950 text-emerald-400' :
                    res.status === 'CANCELLED' ? 'bg-rose-950 text-rose-400' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {res.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
