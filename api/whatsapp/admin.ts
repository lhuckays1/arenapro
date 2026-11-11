import type { ApiRequest, ApiResponse } from '../../src/server/whatsapp.js';
import {
  ApiError,
  evolutionRequest,
  getConnectionState,
  getQrCode,
  isRecord,
  json,
  newWebhookToken,
  requireArenaAdmin,
  requestBody,
  sha256,
  toConnectionStatus,
} from '../../src/server/whatsapp.js';

const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'];
const PREVIEW_TYPEBOT_ARENA_ID = 'de000000-0000-4000-8000-000000000001';

function isTypebotPreview(): boolean {
  return process.env.VERCEL_ENV === 'preview'
    && process.env.ARENAPRO_CHATBOT_PROVIDER === 'typebot';
}

function getTypebotConfig(): { url: string; typebot: string } {
  const url = process.env.ARENAPRO_TYPEBOT_URL?.replace(/\/+$/, '');
  const typebot = process.env.ARENAPRO_TYPEBOT_ID?.trim();
  if (!url || !typebot) {
    throw new ApiError(503, 'A integração Typebot ainda não foi configurada para este Preview.');
  }
  return { url, typebot };
}

async function configurePreviewTypebot(instanceName: string): Promise<void> {
  const { url, typebot } = getTypebotConfig();

  try {
    await evolutionRequest(`/typebot/set/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: {
        enabled: true,
        url,
        typebot,
        triggerType: 'all',
        expire: 30,
        keywordFinish: 'SAIR',
        delayMessage: 600,
        unknownMessage: 'Não entendi sua mensagem. Pode explicar de outra forma?',
        listeningFromMe: false,
        stopBotFromMe: true,
        keepOpen: false,
        debounceTime: 1000,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.upstreamStatusCode === 400) {
      throw new ApiError(
        503,
        'A Evolution recusou o Typebot. Confirme se TYPEBOT_ENABLED=true e se a URL e o fluxo estão corretos.',
      );
    }
    throw error;
  }

  // Desliga somente o webhook da instância de demonstração para não duplicar
  // respostas com o n8n. O domínio .invalid impede entregas caso seja reativado.
  await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: 'POST',
    body: {
      webhook: {
        enabled: false,
        url: 'https://example.invalid/disabled-preview',
        byEvents: false,
        base64: false,
        events: [],
      },
    },
  });
}

function getWebhookUrl(): string {
  const url = process.env.ARENAPRO_N8N_WEBHOOK_URL;
  if (!url) throw new ApiError(503, 'A URL do webhook do n8n ainda não foi configurada.');
  return url;
}

function getPhoneNumber(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const instance = isRecord(value.instance) ? value.instance : {};
  const phone = value.number ?? value.phoneNumber ?? instance.number ?? instance.ownerJid;
  return typeof phone === 'string' ? phone.replace(/@s\.whatsapp\.net$/, '') : null;
}

async function updateStatus(
  supabase: Awaited<ReturnType<typeof requireArenaAdmin>>['supabase'],
  arenaId: string,
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR',
  phoneNumber?: string | null,
  error?: string | null,
) {
  const { error: updateError } = await supabase.rpc('update_arena_whatsapp_connection', {
    p_arena_id: arenaId,
    p_status: status,
    p_phone_number: phoneNumber || null,
    p_last_error: error || null,
  });
  if (updateError) throw new ApiError(500, 'Não foi possível atualizar o status da conexão no ArenaPro.');
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  try {
    const body = requestBody(req);
    const arenaId = typeof body.arenaId === 'string' ? body.arenaId : '';
    const action = typeof body.action === 'string' ? body.action : '';
    if (!arenaId || !/^[0-9a-f-]{36}$/i.test(arenaId)) throw new ApiError(400, 'Arena inválida.');
    const { supabase } = await requireArenaAdmin(req, arenaId);
    if (
      isTypebotPreview()
      && arenaId !== (process.env.ARENAPRO_TYPEBOT_PREVIEW_ARENA_ID || PREVIEW_TYPEBOT_ARENA_ID)
    ) {
      throw new ApiError(403, 'No Preview, o WhatsApp está limitado à arena fictícia de demonstração.');
    }

    const { data: connection, error: connectionError } = await supabase
      .from('arena_whatsapp_connections')
      .select('arena_id, instance_name, status, phone_number, connected_at, last_event_at')
      .eq('arena_id', arenaId)
      .maybeSingle();
    if (connectionError) throw new ApiError(500, 'Não foi possível consultar a conexão do WhatsApp.');

    if (action === 'status') {
      if (!connection) return json(res, 200, { status: 'DISCONNECTED', phoneNumber: null });
      const response = await evolutionRequest<unknown>(
        `/instance/connectionState/${encodeURIComponent(connection.instance_name)}`,
      );
      const status = toConnectionStatus(getConnectionState(response));
      await updateStatus(supabase, arenaId, status, getPhoneNumber(response));
      return json(res, 200, {
        status,
        phoneNumber: getPhoneNumber(response) || connection.phone_number || null,
      });
    }

    if (action === 'disconnect') {
      if (!connection) return json(res, 200, { status: 'DISCONNECTED' });
      try {
        await evolutionRequest(
          `/instance/logout/${encodeURIComponent(connection.instance_name)}`,
          { method: 'DELETE' },
        );
      } catch {
        // Evolution may already have logged out the device. Keep the DB state
        // consistent and let the next connection attempt fetch a fresh QR.
      }
      await updateStatus(supabase, arenaId, 'DISCONNECTED');
      return json(res, 200, { status: 'DISCONNECTED' });
    }

    if (action !== 'connect') throw new ApiError(400, 'Ação inválida.');

    const instanceName = connection?.instance_name || `arenapro-${arenaId.replace(/-/g, '').toLowerCase()}`;
    const token = newWebhookToken();
    const { error: registerError } = await supabase.rpc('register_arena_whatsapp_connection', {
      p_arena_id: arenaId,
      p_instance_name: instanceName,
      p_token_hash: sha256(token),
    });
    if (registerError) throw new ApiError(500, 'Não foi possível registrar a conexão protegida da arena.');

    let instanceResponse: unknown;
    if (!connection) {
      try {
        instanceResponse = await evolutionRequest('/instance/create', {
          method: 'POST',
          body: { instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' },
        });
      } catch (createError) {
        // Recover an instance created by a previous interrupted attempt.
        try {
          instanceResponse = await evolutionRequest(
            `/instance/connectionState/${encodeURIComponent(instanceName)}`,
          );
        } catch {
          throw createError;
        }
      }
    } else {
      try {
        instanceResponse = await evolutionRequest(
          `/instance/connectionState/${encodeURIComponent(instanceName)}`,
        );
      } catch (stateError) {
        if (!(stateError instanceof ApiError) || stateError.upstreamStatusCode !== 404) {
          throw stateError;
        }

        // The database row can outlive a failed first attempt. Recreate the
        // provider instance when its connection-state endpoint confirms a 404.
        instanceResponse = await evolutionRequest('/instance/create', {
          method: 'POST',
          body: { instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' },
        });
      }
      if (getConnectionState(instanceResponse) !== 'open') {
        instanceResponse = await evolutionRequest(
          `/instance/connect/${encodeURIComponent(instanceName)}`,
          { method: 'GET' },
        );
      }
    }

    if (isTypebotPreview()) {
      await configurePreviewTypebot(instanceName);
    } else {
      await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        body: {
          webhook: {
            enabled: true,
            url: getWebhookUrl(),
            byEvents: false,
            base64: false,
            events: WEBHOOK_EVENTS,
            headers: { 'X-ArenaPro-Webhook': token },
          },
        },
      });
    }

    let qrCode = getQrCode(instanceResponse);
    const statusFromInstance = toConnectionStatus(getConnectionState(instanceResponse));
    if (!qrCode && statusFromInstance !== 'CONNECTED') {
      const qrResponse = await evolutionRequest<unknown>(
        `/instance/connect/${encodeURIComponent(instanceName)}`,
      );
      qrCode = getQrCode(qrResponse);
    }

    const finalStatus = statusFromInstance === 'CONNECTED' ? 'CONNECTED' : 'CONNECTING';
    await updateStatus(supabase, arenaId, finalStatus, getPhoneNumber(instanceResponse));
    return json(res, 200, {
      status: finalStatus,
      phoneNumber: getPhoneNumber(instanceResponse),
      qrCode,
      qrExpiresInSeconds: qrCode ? 45 : null,
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Erro inesperado ao gerenciar WhatsApp.';
    return json(res, statusCode, { error: message });
  }
}


