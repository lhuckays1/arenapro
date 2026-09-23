import React from 'react';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
  Volleyball,
} from 'lucide-react';

interface ClientHomePageProps {
  onNavigate: (path: string) => void;
}

export const ClientHomePage: React.FC<ClientHomePageProps> = ({
  onNavigate,
}) => {
  return (
    <div className="space-y-6">

      {/* =========================================================
          HERO
      ========================================================= */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30">
        {/* Background decorations */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="max-w-3xl">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              ArenaPro
            </div>

            {/* Title */}
            <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              Reserve sua quadra
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                de forma rápida.
              </span>
            </h1>

            {/* Description */}
            <p className="mt-4 max-w-2xl text-sm sm:text-base text-slate-400 leading-relaxed">
              Encontre uma arena, escolha sua modalidade, selecione a quadra
              e consulte os horários disponíveis para fazer sua reserva.
            </p>

            {/* CTA */}
            <div className="mt-7">
              <button
                type="button"
                onClick={() => onNavigate('/app/escolher-arena')}
                className="inline-flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
              >
                <Calendar className="w-5 h-5" />
                RESERVAR QUADRA
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================
          ATALHOS
      ========================================================= */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-white">
              Acesso rápido
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Acesse as principais funções da sua conta.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* RESERVAR */}
          <button
            type="button"
            onClick={() => onNavigate('/app/escolher-arena')}
            className="group text-left rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all"
          >
            <div className="flex items-start justify-between gap-4">

              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Volleyball className="w-5 h-5 text-emerald-400" />
              </div>

              <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-emerald-500 flex items-center justify-center transition">
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-950" />
              </div>

            </div>

            <h3 className="mt-4 text-sm font-black text-white">
              Reservar uma quadra
            </h3>

            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Escolha uma arena, modalidade, quadra e horário.
            </p>
          </button>

          {/* MINHAS RESERVAS */}
          <button
            type="button"
            onClick={() => onNavigate('/app/reservas')}
            className="group text-left rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-blue-500/40 hover:bg-slate-900/80 transition-all"
          >
            <div className="flex items-start justify-between gap-4">

              <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>

              <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-blue-500 flex items-center justify-center transition">
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-950" />
              </div>

            </div>

            <h3 className="mt-4 text-sm font-black text-white">
              Minhas reservas
            </h3>

            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Consulte suas reservas atuais e anteriores.
            </p>
          </button>

          {/* PERFIL */}
          <button
            type="button"
            onClick={() => onNavigate('/app/perfil')}
            className="group text-left rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-violet-500/40 hover:bg-slate-900/80 transition-all"
          >
            <div className="flex items-start justify-between gap-4">

              <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <UserRound className="w-5 h-5 text-violet-400" />
              </div>

              <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-violet-500 flex items-center justify-center transition">
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-950" />
              </div>

            </div>

            <h3 className="mt-4 text-sm font-black text-white">
              Meu perfil
            </h3>

            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Atualize seus dados pessoais e informações da conta.
            </p>
          </button>

        </div>
      </section>

      {/* =========================================================
          COMO FUNCIONA
      ========================================================= */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 overflow-hidden">

        <div className="p-6 sm:p-7 border-b border-slate-800">
          <h2 className="text-lg font-black text-white">
            Como reservar
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Faça sua reserva em poucos passos.
          </p>
        </div>

        <div className="p-6 sm:p-7">

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

            {/* PASSO 1 */}
            <div className="relative">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <span className="text-sm font-black text-emerald-400">
                    1
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-black text-white">
                    Escolha a arena
                  </h3>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Encontre uma arena disponível.
                  </p>
                </div>

              </div>

            </div>

            {/* PASSO 2 */}
            <div className="relative">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <span className="text-sm font-black text-blue-400">
                    2
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-black text-white">
                    Escolha a quadra
                  </h3>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Selecione modalidade e quadra.
                  </p>
                </div>

              </div>

            </div>

            {/* PASSO 3 */}
            <div className="relative">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <span className="text-sm font-black text-violet-400">
                    3
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-black text-white">
                    Escolha o horário
                  </h3>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Consulte os horários disponíveis.
                  </p>
                </div>

              </div>

            </div>

            {/* PASSO 4 */}
            <div className="relative">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <span className="text-sm font-black text-amber-400">
                    4
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-black text-white">
                    Confirme
                  </h3>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Revise e confirme sua reserva.
                  </p>
                </div>

              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================
          INFORMAÇÕES
      ========================================================= */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* CARD RESERVAS */}
        <button
          type="button"
          onClick={() => onNavigate('/app/reservas')}
          className="group text-left rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition"
        >
          <div className="flex items-center gap-4">

            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center">
              <Clock3 className="w-5 h-5 text-slate-300" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-white">
                Acompanhe seus horários
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Consulte rapidamente suas próximas reservas.
              </p>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition" />

          </div>
        </button>

        {/* CARD ARENAS */}
        <button
          type="button"
          onClick={() => onNavigate('/app/escolher-arena')}
          className="group text-left rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition"
        >
          <div className="flex items-center gap-4">

            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center">
              <Search className="w-5 h-5 text-slate-300" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-white">
                Procurar uma arena
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Pesquise arenas por nome, cidade ou localização.
              </p>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition" />

          </div>
        </button>

      </section>

      {/* =========================================================
          FOOTER INFO
      ========================================================= */}
      <section className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-5">

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">

          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="flex-1">
            <h3 className="text-xs font-black text-white">
              ArenaPro
            </h3>

            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
              Plataforma para encontrar arenas e realizar reservas
              esportivas de forma simples e segura.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/app/escolher-arena')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition shrink-0"
          >
            Encontrar arena
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

        </div>

      </section>

    </div>
  );
};

export default ClientHomePage;