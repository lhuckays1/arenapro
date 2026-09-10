import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { signIn, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setError(
        err?.message ||
        'Erro ao realizar login. Verifique suas credenciais.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">

      {/* Subtle sports ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Logo / Branding */}
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

      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">

        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* E-mail */}
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

            {/* Senha */}
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

            {/* Login Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={submitting || loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <span>
                {submitting ? 'Entrando...' : 'Acessar Sistema'}
              </span>

              <ArrowRight className="w-4 h-4" />
            </button>

          </form>

          {/* Register */}
          <div className="text-center pt-6 mt-6 border-t border-slate-800">

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