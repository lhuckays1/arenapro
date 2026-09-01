import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { Shield, UserCheck, Users, User, RefreshCw, Terminal } from 'lucide-react';
import { isDevelopment, isSupabaseConfigured } from '../../lib/supabase';

interface PersonaSwitcherProps {
  onOpenTestSuite?: () => void;
}

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({ onOpenTestSuite }) => {
  const { profile, switchPersona, loading } = useAuth();

  // Persona switching is only for the local sandbox.
  // With a real Supabase project it is hidden to avoid masking real authentication/RLS.
  if (!isDevelopment || isSupabaseConfigured) {
    return null;
  }

  const personas: { role: UserRole; label: string; name: string; icon: React.ReactNode; color: string }[] = [
    {
      role: 'SUPER_ADMIN',
      label: 'Super Admin',
      name: 'Lucas Silva',
      icon: <Shield className="w-3.5 h-3.5" />,
      color: 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30',
    },
    {
      role: 'ARENA_ADMIN',
      label: 'Admin Arena',
      name: 'Rodrigo Gestor',
      icon: <UserCheck className="w-3.5 h-3.5" />,
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30',
    },
    {
      role: 'ARENA_STAFF',
      label: 'Funcionário',
      name: 'Carlos Atendente',
      icon: <Users className="w-3.5 h-3.5" />,
      color: 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30',
    },
    {
      role: 'CLIENT',
      label: 'Cliente',
      name: 'Mariana Costa',
      icon: <User className="w-3.5 h-3.5" />,
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30',
    },
  ];

  return (
    <div className="bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 z-30">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Ambiente de Desenvolvimento:
        </span>
        <span className="hidden sm:inline text-slate-500">Alternar Persona de Teste:</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {personas.map((p) => {
          const isActive = profile?.role === p.role;
          return (
            <button
              key={p.role}
              id={`persona-btn-${p.role.toLowerCase()}`}
              onClick={() => switchPersona(p.role)}
              disabled={loading}
              className={`px-2.5 py-1 rounded-md border font-medium transition flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-950 font-bold ' + p.color
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {p.icon}
              <span>{p.label}</span>
              {isActive && <span className="text-[10px] opacity-75 hidden md:inline">({p.name})</span>}
            </button>
          );
        })}

        {onOpenTestSuite && (
          <button
            id="run-integrity-suite-header-btn"
            onClick={onOpenTestSuite}
            className="ml-2 px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Validação de Integridade (14 Testes)</span>
          </button>
        )}
      </div>
    </div>
  );
};
