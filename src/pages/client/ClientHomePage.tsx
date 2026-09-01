import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { Court, Modality, Reservation } from '../../types';
import {
  CalendarDays,
  MapPin,
  Clock,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Users,
  Shield,
  ArrowRight
} from 'lucide-react';

interface ClientHomePageProps {
  onNavigate: (path: string) => void;
}

export const ClientHomePage: React.FC<ClientHomePageProps> = ({ onNavigate }) => {
  const { activeArena, profile, user } = useAuth();
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [nextReservation, setNextReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeArena) return;
    const load = async () => {
      setLoading(true);
      try {
        const [mods, crts, clientRes] = await Promise.all([
          arenaService.getModalities(activeArena.id),
          arenaService.getCourts(activeArena.id),
          user ? arenaService.getClientReservations(user.id, activeArena.id) : Promise.resolve([]),
        ]);

        setModalities(mods.filter(m => m.status === 'ACTIVE'));
        setCourts(crts.filter(c => c.status === 'ACTIVE'));

        // Find next upcoming confirmed reservation
        const now = new Date().toISOString();
        const upcoming = clientRes.filter(r => r.end_at >= now && r.status === 'CONFIRMED');
        if (upcoming.length > 0) {
          // Nearest in time
          upcoming.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
          setNextReservation(upcoming[0]);
        } else {
          setNextReservation(null);
        }
      } catch (e) {
        console.error('Error loading client home:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeArena?.id, user?.id]);

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'Atleta';

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Olá, {firstName}</span>
            <span>👋</span>
          </h1>
          <p className="text-xs text-slate-400">
            Reserve sua próxima partida na <strong className="text-emerald-400">{activeArena?.name}</strong>.
          </p>
        </div>

        {activeArena?.slug && (
          <button
            onClick={() => onNavigate(`/arena/${activeArena.slug}`)}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-emerald-400 hover:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>Ver Portal Público</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* PRÓXIMA RESERVA Card (If exists) */}
      {nextReservation && (
        <section className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/40">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Sua Próxima Partida
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {nextReservation.court?.name}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div className="space-y-0.5">
              <span className="text-xs text-slate-400 block">Data &amp; Horário</span>
              <p className="text-base font-extrabold text-white">
                {new Date(nextReservation.start_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} •{' '}
                <span className="text-emerald-400">
                  {new Date(nextReservation.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-xs text-slate-400 block">Status &amp; Valor</span>
              <p className="text-xs font-bold text-slate-200">
                Confirmada • R$ {(nextReservation.amount || 80).toFixed(2)}
              </p>
            </div>

            <div className="sm:text-right">
              <button
                id="view-next-reservation-btn"
                onClick={() => onNavigate('/app/minhas-reservas')}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition cursor-pointer"
              >
                Ver Detalhes
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Reservation CTA Hero */}
      <section className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 p-6 shadow-xl space-y-4">
        <div>
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
            Agendamento Rápido
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Garanta seu horário na quadra
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-lg">
            Selecione a modalidade, quadra e o melhor horário em poucos toques.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            id="hero-reserve-quadra-btn"
            onClick={() => onNavigate('/app/reservar')}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition flex items-center gap-2 cursor-pointer"
          >
            <CalendarDays className="w-4 h-4" />
            <span>RESERVAR QUADRA</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            id="hero-my-reservations-btn"
            onClick={() => onNavigate('/app/minhas-reservas')}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl transition cursor-pointer"
          >
            Minhas Reservas
          </button>
        </div>
      </section>

      {/* Modalidades Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">Modalidades na Arena</h2>
          <span className="text-xs text-slate-400">{modalities.length} ativas</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {modalities.map((m) => {
            const courtCount = courts.filter(c => c.modality_id === m.id).length;
            return (
              <div
                key={m.id}
                id={`home-modality-${m.id}`}
                onClick={() => onNavigate('/app/reservar')}
                className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-800/80 transition cursor-pointer flex flex-col justify-between space-y-2 group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">⚽</span>
                  <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition">{m.name}</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400">
                  {courtCount} {courtCount === 1 ? 'quadra' : 'quadras'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Courts Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200">Quadras Disponíveis</h2>
          <button
            onClick={() => onNavigate('/app/reservar')}
            className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-0.5"
          >
            <span>Ver todas</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {courts.map((court) => (
            <div
              key={court.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg flex flex-col justify-between"
            >
              <div>
                {court.image_url && (
                  <div className="h-36 w-full overflow-hidden relative">
                    <img
                      src={court.image_url}
                      alt={court.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-xl text-xs font-black text-emerald-400">
                      R$ {court.price.toFixed(2)}/h
                    </div>
                  </div>
                )}
                <div className="p-4 space-y-1">
                  <h3 className="text-sm font-bold text-white">{court.name}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{court.description}</p>
                </div>
              </div>

              <div className="p-4 pt-0">
                <button
                  id={`home-court-reserve-${court.id}`}
                  onClick={() => onNavigate('/app/reservar')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 text-xs font-black rounded-xl transition cursor-pointer"
                >
                  Reservar esta Quadra
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
