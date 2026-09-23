import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  ArrowRight,
  Building2,
  Loader2,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react';

import { arenaService } from '../../services/arena.service';
import { Arena } from '../../types';

interface ArenaSelectionPageProps {
  onNavigate: (path: string) => void;
}

export const ArenaSelectionPage: React.FC<ArenaSelectionPageProps> = ({
  onNavigate,
}) => {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadArenas = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await arenaService.getArenas();

        if (!mounted) return;

        // Somente arenas ativas podem ser apresentadas
        // para o cliente.
        const activeArenas = data.filter(
          (arena) => arena.status === 'ACTIVE'
        );

        setArenas(activeArenas);
      } catch (err: any) {
        if (!mounted) return;

        console.error('Erro ao carregar arenas:', err);

        setError(
          err?.message ||
            'Não foi possível carregar as arenas disponíveis.'
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadArenas();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredArenas = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return arenas;
    }

    return arenas.filter((arena) => {
      return (
        arena.name.toLowerCase().includes(term) ||
        arena.city?.toLowerCase().includes(term) ||
        arena.state?.toLowerCase().includes(term) ||
        arena.address?.toLowerCase().includes(term)
      );
    });
  }, [arenas, search]);

  const handleSelectArena = (arena: Arena) => {
    if (!arena.slug) return;

    onNavigate(`/arena/${arena.slug}/reservar`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10 animate-fadeIn">

      {/* HEADER */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() => onNavigate('/app/inicio')}
            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center"
            title="Voltar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Escolha sua Arena
            </h1>

            <p className="text-xs text-slate-400 mt-1">
              Selecione onde você deseja reservar sua próxima partida.
            </p>
          </div>

        </div>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por arena, cidade ou endereço..."
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition"
        />
      </div>

      {/* ERROR */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-14 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />

          <p className="text-xs font-semibold text-slate-400">
            Carregando arenas disponíveis...
          </p>
        </div>
      )}

      {/* EMPTY */}
      {!loading && !error && filteredArenas.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-14 text-center">

          <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7" />
          </div>

          <h2 className="text-sm font-bold text-white">
            Nenhuma arena encontrada
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            {search
              ? 'Tente buscar por outro nome ou cidade.'
              : 'Não existem arenas disponíveis para reserva no momento.'}
          </p>

        </div>
      )}

      {/* ARENAS */}
      {!loading && filteredArenas.length > 0 && (
        <div className="space-y-3">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-200">
                Arenas disponíveis
              </h2>

              <p className="text-[11px] text-slate-500 mt-0.5">
                {filteredArenas.length}{' '}
                {filteredArenas.length === 1
                  ? 'arena encontrada'
                  : 'arenas encontradas'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

            {filteredArenas.map((arena) => (
              <button
                key={arena.id}
                type="button"
                onClick={() => handleSelectArena(arena)}
                className="group text-left bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-200"
              >

                {/* IMAGEM / LOGO */}
                <div className="relative h-40 bg-gradient-to-br from-slate-800 to-slate-950 overflow-hidden">

                  {arena.logo_url ? (
                    <img
                      src={arena.logo_url}
                      alt={arena.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Building2 className="w-8 h-8" />
                      </div>
                    </div>
                  )}

                  {/* OVERLAY */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                  {/* STATUS */}
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Disponível
                    </span>
                  </div>

                  {/* NOME */}
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-base font-black text-white truncate">
                      {arena.name}
                    </h3>
                  </div>

                </div>

                {/* CONTEÚDO */}
                <div className="p-4 space-y-4">

                  {arena.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                      {arena.description}
                    </p>
                  )}

                  <div className="flex items-start gap-2 text-xs text-slate-400">

                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />

                    <div className="min-w-0">
                      <p className="text-slate-300 font-semibold truncate">
                        {arena.city}
                        {arena.state ? ` - ${arena.state}` : ''}
                      </p>

                      {arena.address && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {arena.address}
                        </p>
                      )}
                    </div>

                  </div>

                  {/* ACTION */}
                  <div className="pt-3 border-t border-slate-800">

                    <div className="w-full py-2.5 px-4 rounded-xl bg-slate-800 group-hover:bg-emerald-500 group-hover:text-slate-950 text-slate-200 text-xs font-black flex items-center justify-center gap-2 transition">

                      <span>
                        RESERVAR NESTA ARENA
                      </span>

                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />

                    </div>

                  </div>

                </div>

              </button>
            ))}

          </div>
        </div>
      )}

    </div>
  );
};

export default ArenaSelectionPage;