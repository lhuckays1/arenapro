import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { authService } from '../../services/auth.service';

interface ResetPasswordPageProps {
  onNavigate: (path: string) => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  onNavigate,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setHasRecoverySession(true);
          setCheckingSession(false);
        }
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (mounted) {
          setHasRecoverySession(Boolean(session));
        }
      } catch (err) {
        console.error('[AUTH] Erro ao validar sessão de recuperação:', err);
        if (mounted) {
          setHasRecoverySession(false);
        }
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setHasRecoverySession(Boolean(session));
        setCheckingSession(false);
        setError(null);
      } else if (session && !hasRecoverySession) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    checkRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hasRecoverySession]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!hasRecoverySession) {
      setError(
        'O link de recuperação é inválido ou expirou. Solicite um novo link.'
      );
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setSaving(true);

    try {
      await authService.updatePassword(newPassword);

      if (!mountedSafe()) return;

      setSuccess(true);
    } catch (err: any) {
      console.error('[AUTH] Erro ao atualizar senha:', err);

      if (mountedSafe()) {
        setError(
          err?.message ||
            'Não foi possível alterar sua senha. Solicite um novo link de recuperação.'
        );
      }
    } finally {
      if (mountedSafe()) {
        setSaving(false);
      }
    }
  };

  const mountedSafe = () => true;

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h1 className="text-xl font-black text-white">
            Validando recuperação
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Aguarde enquanto validamos seu link de recuperação.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-black text-white">
            Senha alterada!
          </h1>

          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Sua senha foi atualizada com sucesso. Agora você já pode entrar
            novamente no ArenaPro.
          </p>

          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black hover:from-emerald-400 hover:to-teal-400 transition"
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>

          <h1 className="text-xl font-black text-white">
            Link inválido ou expirado
          </h1>

          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Por segurança, o link de recuperação possui validade. Solicite
            uma nova recuperação de senha.
          </p>

          <div className="flex flex-col gap-2 mt-6">
            <button
              type="button"
              onClick={() => onNavigate('/forgot-password')}
              className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-black hover:bg-emerald-400 transition"
            >
              Solicitar novo link
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="w-full py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
            >
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o login
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-7 h-7" />
            </div>

            <h1 className="text-2xl font-black text-white">
              Criar nova senha
            </h1>

            <p className="text-sm text-slate-400 mt-2">
              Defina uma nova senha para acessar sua conta do ArenaPro.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="reset-new-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Nova senha
              </label>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  id="reset-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  minLength={6}
                  required
                  className="w-full pl-10 pr-11 py-3 bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                <button
                  type="button"
                  onClick={() => setShowNewPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  title={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="reset-confirm-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Confirmar nova senha
              </label>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Digite novamente"
                  minLength={6}
                  required
                  className="w-full pl-10 pr-11 py-3 bg-slate-950/80 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  title={
                    showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="reset-password-submit-btn"
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar nova senha'
                )}
              </button>
            </div>
          </form>

          <p className="text-[11px] text-slate-500 text-center mt-5">
            Por segurança, o link de recuperação só pode ser utilizado
            durante o período de validade definido pelo Supabase.
          </p>
        </div>
      </div>
    </div>
  );
};
