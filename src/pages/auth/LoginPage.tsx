import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, Mail, Lock, ArrowRight, UserCheck, AlertCircle } from 'lucide-react';
import { UserRole } from '../../types';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { signIn, switchPersona, loading } = useAuth();
  const [email, setEmail] = useState('admin@arenaxp.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // Auth context updates profile, routing in App.tsx takes over
    } catch (err: any) {
      setError(err?.message || 'Erro ao realizar login. Verifique suas credenciais.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = async (role: UserRole) => {
    try {
      await switchPersona(role);
    } catch (err: any) {
      setError(err?.message || 'Erro ao alternar persona.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle sports ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-2xl shadow-xl shadow-emerald-500/20">
            A
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-slate-100 tracking-tight">
          Arena<span className="text-emerald-400">Pro</span>
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Plataforma SaaS de Gestão de Arenas &amp; Reservas Online
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@arena.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Senha
                </label>
                <button
                  type="button"
                  id="forgot-password-link"
                  onClick={() => onNavigate('/forgot-password')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={submitting || loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <span>{submitting ? 'Entrando...' : 'Acessar Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Access Bar */}
          <div className="pt-4 border-t border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 text-center mb-3">
              Acesso Rápido de Demonstração (1-Clique):
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="demo-login-admin"
                onClick={() => handleQuickDemo('ARENA_ADMIN')}
                className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition text-center cursor-pointer"
              >
                Admin da Arena
              </button>
              <button
                type="button"
                id="demo-login-client"
                onClick={() => handleQuickDemo('CLIENT')}
                className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition text-center cursor-pointer"
              >
                Área do Cliente
              </button>
              <button
                type="button"
                id="demo-login-staff"
                onClick={() => handleQuickDemo('ARENA_STAFF')}
                className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition text-center cursor-pointer"
              >
                Funcionário
              </button>
              <button
                type="button"
                id="demo-login-super"
                onClick={() => handleQuickDemo('SUPER_ADMIN')}
                className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition text-center cursor-pointer"
              >
                Super Admin
              </button>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-400">
              Não possui uma conta?{' '}
              <button
                id="go-to-register-btn"
                type="button"
                onClick={() => onNavigate('/register')}
                className="text-emerald-400 hover:text-emerald-300 font-bold ml-1 cursor-pointer"
              >
                Cadastre-se grátis
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
