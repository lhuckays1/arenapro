import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MessageCircle, QrCode, RefreshCw, Unplug } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

interface ConnectionResponse {
  status?: ConnectionStatus;
  phoneNumber?: string | null;
  qrCode?: string | null;
  error?: string;
}

export const WhatsAppConnectionPage: React.FC<{ onNavigate: (path: string) => void }> = () => {
  const { activeArena, profile } = useAuth();
  const arenaId = activeArena?.id;
  const isArenaAdmin = profile?.role === 'ARENA_ADMIN' || profile?.role === 'SUPER_ADMIN';
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callApi = useCallback(async (action: 'status' | 'connect' | 'disconnect') => {
    if (!arenaId) throw new Error('Nenhuma arena está selecionada.');
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Sua sessão expirou. Entre novamente.');

    const response = await fetch('/api/whatsapp/admin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ arenaId, action }),
    });
    const result = await response.json() as ConnectionResponse;
    if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a conexão.');
    return result;
  }, [arenaId]);

  const refreshStatus = useCallback(async () => {
    try {
      const result = await callApi('status');
      const nextStatus = result.status || 'DISCONNECTED';
      setStatus(nextStatus);
      setPhoneNumber(result.phoneNumber || null);
      if (nextStatus === 'CONNECTED') setQrCode(null);
      return nextStatus;
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Falha ao consultar a conexão.');
      return null;
    }
  }, [callApi]);

  useEffect(() => {
    setStatus('DISCONNECTED');
    setPhoneNumber(null);
    setQrCode(null);
    setMessage(null);
    setError(null);
    if (!arenaId || !isArenaAdmin) return;
    void refreshStatus();
  }, [arenaId, isArenaAdmin, refreshStatus]);

  useEffect(() => {
    if (status !== 'CONNECTING' || !arenaId || !isArenaAdmin) return;
    const timer = window.setInterval(() => { void refreshStatus(); }, 5000);
    return () => window.clearInterval(timer);
  }, [arenaId, isArenaAdmin, refreshStatus, status]);

  const connect = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await callApi('connect');
      setStatus(result.status || 'CONNECTING');
      setPhoneNumber(result.phoneNumber || null);
      setQrCode(result.qrCode || null);
      setMessage(result.qrCode
        ? 'Leia o QR Code no WhatsApp da arena. Ele pode expirar; gere outro se necessário.'
        : 'Solicitação enviada. Atualizando o estado da conexão...');
      if (result.status === 'CONNECTED') setQrCode(null);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Não foi possível gerar o QR Code.');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await callApi('disconnect');
      setStatus(result.status || 'DISCONNECTED');
      setPhoneNumber(null);
      setQrCode(null);
      setMessage('WhatsApp desconectado desta arena.');
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'Não foi possível desconectar.');
    } finally {
      setLoading(false);
    }
  };

  if (!isArenaAdmin) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-100">
        Apenas administradores da arena podem conectar um WhatsApp.
      </div>
    );
  }

  const connected = status === 'CONNECTED';
  const statusLabel = connected ? 'Conectado' : status === 'CONNECTING' ? 'Aguardando leitura do QR Code' : 'Desconectado';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Integrações</p>
        <h1 className="mt-2 text-2xl font-black text-white">WhatsApp da arena</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Conecte o número usado por esta arena. As mensagens recebidas poderão iniciar reservas de quadras pelo atendimento automatizado.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-400">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{activeArena?.name || 'Arena ativa'}</h2>
              <p className="mt-1 text-xs text-slate-400">Cada arena conecta e administra o próprio número.</p>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : status === 'CONNECTING' ? 'animate-pulse bg-amber-400' : 'bg-slate-500'}`} />
                <span className={connected ? 'text-emerald-300' : status === 'CONNECTING' ? 'text-amber-300' : 'text-slate-400'}>{statusLabel}</span>
                {phoneNumber && <span className="text-slate-500">· {phoneNumber}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshStatus()}
              disabled={loading || !activeArena}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
            {!connected ? (
              <button
                type="button"
                onClick={() => void connect()}
                disabled={loading || !activeArena}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                {status === 'CONNECTING' ? 'Gerar novo QR Code' : 'Conectar WhatsApp'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void disconnect()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 px-4 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                Desconectar
              </button>
            )}
          </div>
        </div>

        {qrCode && !connected && (
          <div className="mt-7 flex flex-col items-center rounded-xl border border-slate-800 bg-slate-950 p-5 text-center">
            <p className="mb-4 text-sm font-bold text-white">Escaneie com o WhatsApp</p>
            <img src={qrCode} alt="QR Code para conectar o WhatsApp da arena" className="h-64 w-64 rounded-lg bg-white p-2" />
            <p className="mt-4 max-w-md text-xs leading-5 text-slate-400">
              No celular, abra <strong className="text-slate-200">WhatsApp → Aparelhos conectados → Conectar aparelho</strong> e leia este código.
            </p>
          </div>
        )}

        {status === 'CONNECTING' && !qrCode && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            Aguardando o QR Code ou a confirmação do WhatsApp. Use “Gerar novo QR Code” se esta tela não atualizar.
          </div>
        )}

        {connected && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-100">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            Este número está conectado. O atendimento automatizado poderá responder mensagens e preparar reservas para confirmação do cliente.
          </div>
        )}

        {message && <p className="mt-4 text-xs text-slate-300">{message}</p>}
        {error && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
      </section>

      <p className="text-xs leading-5 text-slate-500">
        Mantenha o celular conectado à internet durante o primeiro pareamento. O ArenaPro cria a reserva somente depois que o cliente confirma o código enviado pelo atendimento.
      </p>
    </div>
  );
};


