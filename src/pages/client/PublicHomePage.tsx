import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Volleyball,
} from 'lucide-react';

import { arenaService } from '../../services/arena.service';
import { Arena } from '../../types';

interface PublicHomePageProps {
  onNavigate: (path: string) => void;
}

export const PublicHomePage: React.FC<PublicHomePageProps> = ({
  onNavigate,
}) => {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadArenas = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await arenaService.getArenas();

      const activeArenas = (data || []).filter(
        (arena) => arena.status === 'ACTIVE',
      );

      setArenas(activeArenas);
    } catch (err: any) {
      console.error('Erro ao carregar arenas públicas:', err);

      setError(
        err?.message ||
          'Não foi possível carregar as arenas no momento.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArenas();
  }, []);

  const filteredArenas = arenas.filter((arena) => {
    const term = search.trim().toLowerCase();

    if (!term) return true;

    return (
      arena.name?.toLowerCase().includes(term) ||
      arena.city?.toLowerCase().includes(term) ||
      arena.state?.toLowerCase().includes(term) ||
      arena.description?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ======================================================
          HEADER
      ====================================================== */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* LOGO */}
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
                A
              </div>

              <div className="text-left">
                <div className="font-extrabold text-lg tracking-tight text-white">
                  Arena
                  <span className="text-emerald-400">
                    Pro
                  </span>
                </div>

                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
                  Reservas esportivas
                </div>
              </div>
            </button>

            {/* LOGIN */}
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold transition"
            >
              <ShieldCheck className="w-4 h-4" />
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================
          HERO
      ====================================================== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -top-32 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[11px] font-bold mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              RESERVE SUA QUADRA ONLINE
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.05]">
              Encontre uma arena
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                e reserve sua quadra.
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
              Escolha sua arena, encontre a quadra ideal e consulte os
              horários disponíveis para fazer sua reserva de forma rápida.
            </p>
          </div>

          {/* SEARCH */}
          <div className="mt-8 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por arena, cidade ou estado..."
                className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          ARENAS
      ====================================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Arenas disponíveis
            </h2>

            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Escolha uma arena para consultar as quadras e horários.
            </p>
          </div>

          <button
            type="button"
            onClick={loadArenas}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition disabled:opacity-50"
            title="Atualizar arenas"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading ? 'animate-spin' : ''
              }`}
            />
          </button>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-64 rounded-3xl bg-slate-900 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* ERROR */}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-rose-400" />
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-bold text-rose-300">
                  Não foi possível carregar as arenas
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={loadArenas}
                  className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EMPTY */}
        {!loading &&
          !error &&
          filteredArenas.length === 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-10 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-slate-500" />
              </div>

              <h3 className="mt-4 text-base font-bold text-white">
                Nenhuma arena encontrada
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {search
                  ? 'Tente alterar os termos da busca.'
                  : 'Ainda não existem arenas disponíveis.'}
              </p>
            </div>
          )}

        {/* ARENA CARDS */}
        {!loading &&
          !error &&
          filteredArenas.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredArenas.map((arena) => (
                <button
                  key={arena.id}
                  type="button"
                  onClick={() =>
                    onNavigate(`/arena/${arena.slug}`)
                  }
                  className="group text-left rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/5"
                >
                  {/* COVER */}
                  <div className="relative h-44 bg-gradient-to-br from-slate-800 via-slate-900 to-emerald-950/40 overflow-hidden">
                    {arena.logo_url ? (
                      <img
                        src={arena.logo_url}
                        alt={`Logo ${arena.name}`}
                        className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-3xl bg-slate-950/70 border border-slate-700 flex items-center justify-center">
                          <Volleyball className="w-9 h-9 text-emerald-400" />
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />

                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-end justify-between gap-3">
                        <h3 className="text-lg font-black text-white truncate">
                          {arena.name}
                        </h3>

                        <span className="shrink-0 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-[9px] font-black text-emerald-300 uppercase">
                          Ativa
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CONTENT */}
                  <div className="p-5">
                    {arena.description && (
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 min-h-[34px]">
                        {arena.description}
                      </p>
                    )}

                    <div className="mt-4 space-y-2.5">
                      {(arena.city || arena.state) && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {[arena.city, arena.state]
                              .filter(Boolean)
                              .join(' - ')}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          Reservas online
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 group-hover:text-white transition">
                        Ver arena
                      </span>

                      <span className="w-8 h-8 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500 text-emerald-400 group-hover:text-slate-950 flex items-center justify-center transition">
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
      </main>

      {/* ======================================================
          FOOTER
      ====================================================== */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              © {new Date().getFullYear()} ArenaPro
            </div>

            <div className="text-[10px] text-slate-700 uppercase tracking-wider font-bold">
              Gestão esportiva inteligente
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};