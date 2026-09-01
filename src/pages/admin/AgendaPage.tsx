import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { Court, CourtBlock, Customer, Modality, Reservation } from '../../types';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  Lock, 
  Filter, 
  LayoutGrid, 
  List, 
  CalendarRange, 
  DollarSign, 
  RotateCcw, 
  Sparkles,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react';
import { ReservationModal } from '../../components/agenda/ReservationModal';
import { CourtBlockModal } from '../../components/agenda/CourtBlockModal';
import { AgendaDailyView } from '../../components/agenda/AgendaDailyView';
import { AgendaWeeklyView } from '../../components/agenda/AgendaWeeklyView';
import { AgendaListView } from '../../components/agenda/AgendaListView';

export const AgendaPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { activeArena } = useAuth();

  // Data state
  const [courts, setCourts] = useState<Court[]>([]);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courtBlocks, setCourtBlocks] = useState<CourtBlock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter & Navigation state
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'list'>('weekly');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedModalityId, setSelectedModalityId] = useState<string>('ALL');
  const [selectedCourtId, setSelectedCourtId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isResModalOpen, setIsResModalOpen] = useState(false);
  const [resModalMode, setResModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedReservation, setSelectedReservation] = useState<Partial<Reservation> | null>(null);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<Partial<CourtBlock> | null>(null);

  // Load all required data
  const loadData = async () => {
    if (!activeArena) return;
    setLoading(true);
    try {
      const [crts, mods, custs, res, blks] = await Promise.all([
        arenaService.getCourts(activeArena.id),
        arenaService.getModalities(activeArena.id),
        arenaService.getCustomers(activeArena.id),
        arenaService.getReservations(activeArena.id),
        arenaService.getCourtBlocks(activeArena.id),
      ]);
      setCourts(crts);
      setModalities(mods);
      setCustomers(custs);
      setReservations(res);
      setCourtBlocks(blks);
    } catch (err) {
      console.error('Error loading agenda data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeArena]);

  // Date step navigations
  const handlePrevDate = () => {
    const d = new Date(selectedDate + 'T12:00:00.000Z');
    const step = viewMode === 'weekly' ? 7 : 1;
    d.setUTCDate(d.getUTCDate() - step);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDate = () => {
    const d = new Date(selectedDate + 'T12:00:00.000Z');
    const step = viewMode === 'weekly' ? 7 : 1;
    d.setUTCDate(d.getUTCDate() + step);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Filtered Courts based on modality and court select
  const filteredCourts = useMemo(() => {
    return courts.filter(c => {
      if (selectedModalityId !== 'ALL' && c.modality_id !== selectedModalityId) return false;
      if (selectedCourtId !== 'ALL' && c.id !== selectedCourtId) return false;
      return true;
    });
  }, [courts, selectedModalityId, selectedCourtId]);

  // Filtered Reservations based on filters & date
  const filteredReservations = useMemo(() => {
    return reservations.filter(r => {
      if (selectedCourtId !== 'ALL' && r.court_id !== selectedCourtId) return false;
      if (selectedModalityId !== 'ALL' && r.court?.modality_id !== selectedModalityId) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      return true;
    });
  }, [reservations, selectedCourtId, selectedModalityId, statusFilter]);

  // Filtered Blocks
  const filteredBlocks = useMemo(() => {
    return courtBlocks.filter(b => {
      if (selectedCourtId !== 'ALL' && b.court_id !== selectedCourtId) return false;
      return true;
    });
  }, [courtBlocks, selectedCourtId]);

  // Summary Metrics calculation for the selected period
  const metrics = useMemo(() => {
    const currentPeriodReservations = filteredReservations.filter(r => {
      if (r.status === 'CANCELLED') return false;
      if (viewMode === 'daily') {
        return r.start_at.split('T')[0] === selectedDate;
      }
      return true;
    });

    const activeBlocksCount = filteredBlocks.filter(b => {
      if (viewMode === 'daily') {
        return b.start_at.split('T')[0] === selectedDate;
      }
      return true;
    }).length;

    const totalRevenue = currentPeriodReservations.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalHours = currentPeriodReservations.reduce((acc, curr) => {
      const s = new Date(curr.start_at).getTime();
      const e = new Date(curr.end_at).getTime();
      return acc + ((e - s) / 3600000);
    }, 0);

    return {
      count: currentPeriodReservations.length,
      hours: totalHours,
      revenue: totalRevenue,
      blocks: activeBlocksCount,
    };
  }, [filteredReservations, filteredBlocks, viewMode, selectedDate]);

  // Handler: Click empty slot
  const handleSelectSlot = (court: Court, hour: string, customDate?: string) => {
    const targetDate = customDate || selectedDate;
    const [h] = hour.split(':');
    const startH = String(parseInt(h, 10)).padStart(2, '0');
    const endH = String((parseInt(h, 10) + 1) % 24).padStart(2, '0');

    setSelectedReservation({
      arena_id: activeArena?.id,
      court_id: court.id,
      start_at: `${targetDate}T${startH}:00:00.000Z`,
      end_at: `${targetDate}T${endH}:00:00.000Z`,
      status: 'CONFIRMED',
      payment_status: 'PENDING',
      payment_method: 'PIX',
    });
    setResModalMode('create');
    setIsResModalOpen(true);
  };

  // Handler: Click existing reservation
  const handleSelectReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setResModalMode('view');
    setIsResModalOpen(true);
  };

  // Handler: Click block
  const handleSelectBlock = (block: CourtBlock) => {
    setSelectedBlock(block);
    setIsBlockModalOpen(true);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header & Operational Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold shrink-0">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Agenda & Reservas</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {activeArena?.name || 'Arena'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Grade operacional com validação instantânea contra duplicação de horários
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              id="btn-block-court"
              type="button"
              onClick={() => {
                setSelectedBlock(null);
                setIsBlockModalOpen(true);
              }}
              className="px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-500/30 hover:border-amber-400 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Lock className="w-4 h-4" />
              <span>Bloquear Horário</span>
            </button>

            <button
              id="btn-new-reservation"
              type="button"
              onClick={() => {
                setSelectedReservation(null);
                setResModalMode('create');
                setIsResModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nova Reserva</span>
            </button>
          </div>
        </div>

        {/* Date Navigator, View Switcher & Filters */}
        <div className="pt-3 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 flex-wrap">
          {/* Date Selector with Step controls */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              onClick={handlePrevDate}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 hover:text-emerald-400 hover:border-emerald-500/40 transition cursor-pointer"
            >
              Hoje
            </button>

            <div className="relative">
              <input
                id="agenda-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 font-bold px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleNextDate}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Próximo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* View Mode Toggle: Weekly / Daily / List */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-2xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Semanal</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Diário</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>

          {/* Dropdown Filters (Modality, Court, Status) */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            <select
              value={selectedModalityId}
              onChange={(e) => setSelectedModalityId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Todas as Modalidades</option>
              {modalities.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            <select
              value={selectedCourtId}
              onChange={(e) => setSelectedCourtId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">Todas as Quadras</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Real-Time Operational KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reservas Ativas</span>
            <div className="text-xl font-extrabold text-white mt-0.5">{metrics.count}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Horas em Quadra</span>
            <div className="text-xl font-extrabold text-white mt-0.5">{metrics.hours}h</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Receita Prevista</span>
            <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">
              R$ {metrics.revenue.toFixed(2)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Bloqueios Ativos</span>
            <div className="text-xl font-extrabold text-amber-400 mt-0.5">{metrics.blocks}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-300">Carregando grade da arena...</p>
        </div>
      ) : (
        <>
          {viewMode === 'daily' && (
            <AgendaDailyView
              courts={filteredCourts}
              reservations={filteredReservations}
              courtBlocks={filteredBlocks}
              selectedDate={selectedDate}
              openingTime={activeArena?.opening_time || '06:00'}
              closingTime={activeArena?.closing_time || '23:00'}
              onSelectSlot={(court, hour) => handleSelectSlot(court, hour)}
              onSelectReservation={handleSelectReservation}
              onSelectBlock={handleSelectBlock}
            />
          )}

          {viewMode === 'weekly' && (
            <AgendaWeeklyView
              courts={filteredCourts}
              reservations={filteredReservations}
              courtBlocks={filteredBlocks}
              selectedDate={selectedDate}
              onSelectSlot={(court, hour, d) => handleSelectSlot(court, hour, d)}
              onSelectReservation={handleSelectReservation}
              onSelectBlock={handleSelectBlock}
              onSelectDay={(dateStr) => {
                setSelectedDate(dateStr);
                setViewMode('daily');
              }}
            />
          )}

          {viewMode === 'list' && (
            <AgendaListView
              reservations={filteredReservations}
              courtBlocks={filteredBlocks}
              onSelectReservation={handleSelectReservation}
              onSelectBlock={handleSelectBlock}
            />
          )}
        </>
      )}

      {/* Reservation Modal */}
      {activeArena && (
        <ReservationModal
          isOpen={isResModalOpen}
          onClose={() => setIsResModalOpen(false)}
          onSuccess={loadData}
          arenaId={activeArena.id}
          courts={courts}
          customers={customers}
          initialData={selectedReservation}
          mode={resModalMode}
        />
      )}

      {/* Court Block Modal */}
      {activeArena && (
        <CourtBlockModal
          isOpen={isBlockModalOpen}
          onClose={() => setIsBlockModalOpen(false)}
          onSuccess={loadData}
          arenaId={activeArena.id}
          courts={courts}
          initialData={selectedBlock}
        />
      )}
    </div>
  );
};
