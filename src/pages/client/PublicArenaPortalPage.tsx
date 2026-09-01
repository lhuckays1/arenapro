import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { arenaService } from '../../services/arena.service';
import { Arena, Court, Modality } from '../../types';
import {
  Building2,
  MapPin,
  Phone,
  Clock,
  CalendarDays,
  Sparkles,
  ArrowRight,
  Shield,
  CheckCircle2,
  Users,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  AlertCircle
} from 'lucide-react';

interface PublicArenaPortalPageProps {
  slug?: string;
  onNavigate: (path: string) => void;
  onSelectBooking?: (arenaId: string, modalityId?: string, courtId?: string) => void;
}

export const PublicArenaPortalPage: React.FC<PublicArenaPortalPageProps> = ({
  slug,
  onNavigate,
  onSelectBooking,
}) => {
  const { user, profile, activeArena, setActiveArena, arenas } = useAuth();
  const [arena, setArena] = useState<Arena | null>(null);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPortal = async () => {
      setLoading(true);
      setError(null);
      try {
        let targetArena: Arena | null = null;

        if (slug) {
          targetArena = await arenaService.getArenaBySlug(slug);
        }

        // Fallback to activeArena or first available arena
        if (!targetArena) {
          if (activeArena) {
            targetArena = activeArena;
          } else {
            const list = await arenaService.getArenas();
            targetArena = list[0] || null;
          }
        }

        if (!targetArena) {
          setError('Arena não encontrada.');
          setLoading(false);
          return;
        }

        setArena(targetArena);
        setActiveArena(targetArena);

        // Fetch active modalities and courts for this arena
        const [loadedMods, loadedCourts] = await Promise.all([
          arenaService.getModalities(targetArena.id),
          arenaService.getCourts(targetArena.id),
        ]);

        setModalities(loadedMods.filter(m => m.status === 'ACTIVE'));
        setCourts(loadedCourts.filter(c => c.status === 'ACTIVE'));
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar os dados da arena.');
      } finally {
        setLoading(false);
      }
    };

    loadPortal();
  }, [slug, activeArena?.id]);

  const handleStartBooking = (modalityId?: string, courtId?: string) => {
    if (arena) {
      setActiveArena(arena);
      if (onSelectBooking) {
        onSelectBooking(arena.id, modalityId, courtId);
      }
    }
    onNavigate('/app/reservar');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-2xl animate-pulse">
          A
        </div>
        <p className="text-xs font-semibold text-slate-400">Carregando portal da arena...</p>
      </div>
    );
  }

  if (error || !arena) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Arena Não Encontrada</h2>
          <p className="text-xs text-slate-400">
            {error || 'Não conseguimos localizar o endereço da arena solicitada.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('/app/inicio')}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 shadow-md">
              {arena.logo_url ? (
                <img src={arena.logo_url} alt={arena.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                'A'
              )}
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-white tracking-tight leading-tight">{arena.name}</h1>
              <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Reserva Online Oficial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <button
                id="portal-my-account-btn"
                onClick={() => onNavigate('/app/inicio')}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
              >
                Minha Conta
              </button>
            ) : (
              <button
                id="portal-login-btn"
                onClick={() => onNavigate('/login')}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
              >
                Entrar
              </button>
            )}

            <button
              id="portal-header-reserve-btn"
              onClick={() => handleStartBooking()}
              className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Reservar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-8">
        {/* Arena Hero Card */}
        <section className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 p-6 sm:p-8 shadow-2xl overflow-hidden">
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Agendamento Rápido em Tempo Real</span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                {arena.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                {arena.description || 'A melhor infraestrutura de quadras esportivas com areia tratada, iluminação LED e vestiários completos.'}
              </p>
            </div>

            {/* Info Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">
                  {arena.address ? `${arena.address}, ${arena.city} - ${arena.state}` : `${arena.city} - ${arena.state}`}
                </span>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Horário: {arena.opening_time} às {arena.closing_time}</span>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{arena.whatsapp || arena.phone || '(11) 99999-9999'}</span>
              </div>
            </div>

            {/* Primary Action */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                id="portal-hero-cta"
                onClick={() => handleStartBooking()}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition flex items-center gap-2 cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Ver Horários Disponíveis</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {arena.whatsapp && (
                <a
                  href={`https://wa.me/55${arena.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-emerald-500/40 text-slate-200 font-bold text-xs transition flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>Falar no WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Modalities Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Modalidades Esportivas</h3>
              <p className="text-xs text-slate-400">Escolha seu esporte e confira as quadras disponíveis</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              {modalities.length} modalidades
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modalities.map((mod) => {
              const courtCount = courts.filter(c => c.modality_id === mod.id).length;
              return (
                <div
                  key={mod.id}
                  id={`portal-modality-${mod.id}`}
                  className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition group"
                >
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-lg group-hover:scale-105 transition">
                      ⚽
                    </div>
                    <h4 className="text-base font-extrabold text-white">{mod.name}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {mod.description || 'Pratique com amigos em quadras de alta qualidade.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {courtCount} {courtCount === 1 ? 'quadra disponível' : 'quadras disponíveis'}
                    </span>
                    <button
                      onClick={() => handleStartBooking(mod.id)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1"
                    >
                      <span>RESERVAR</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Courts Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Quadras &amp; Estrutura</h3>
              <p className="text-xs text-slate-400">Ambientes projetados para o máximo desempenho e conforto</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courts.map((court) => (
              <div
                key={court.id}
                id={`portal-court-${court.id}`}
                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="relative h-44 w-full overflow-hidden bg-slate-950">
                    <img
                      src={court.image_url || 'https://images.unsplash.com/photo-1543351611-58f69d7c1781?w=800&q=80'}
                      alt={court.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-xl text-[11px] font-bold text-emerald-400 border border-slate-800">
                      {court.modality?.name || 'Quadra Esportiva'}
                    </div>
                    <div className="absolute bottom-3 right-3 bg-slate-950/90 backdrop-blur px-3 py-1 rounded-xl text-xs font-black text-white border border-slate-700">
                      R$ {court.price.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ hora</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-2">
                    <h4 className="text-base font-bold text-white">{court.name}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {court.description || 'Piso profissional, areia higienizada e iluminação.'}
                    </p>

                    <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400 font-medium">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Capacidade: até {court.capacity || 4} atletas</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <button
                    id={`court-book-btn-${court.id}`}
                    onClick={() => handleStartBooking(court.modality_id, court.id)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Escolher Horário</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Other Arenas Switcher Footer */}
        {arenas.length > 1 && (
          <section className="pt-6 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 mb-3">Conheça também outras arenas da rede:</h4>
            <div className="flex flex-wrap gap-2">
              {arenas.map(a => (
                <button
                  key={a.id}
                  onClick={() => {
                    setActiveArena(a);
                    onNavigate(`/arena/${a.slug}`);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    a.id === arena.id
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {a.name} ({a.city})
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
