import type { ApiRequest, ApiResponse, JsonRecord } from '../../src/server/whatsapp.js';
import {
  ApiError,
  evolutionRequest,
  getSupabaseClient,
  header,
  isRecord,
  json,
  normalizePhone,
  requestBody,
  sha256,
} from '../../src/server/whatsapp.js';

function requiredString(value: unknown, name: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new ApiError(400, `Campo inválido: ${name}.`);
  }
  return value.trim();
}

async function requireInstance(
  instanceName: string,
  tokenHash: string,
): Promise<{ supabase: ReturnType<typeof getSupabaseClient>; arenaId: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('whatsapp_authorize_instance', {
    p_instance_name: instanceName,
    p_token_hash: tokenHash,
  });
  if (error) throw new ApiError(500, 'Não foi possível validar a conexão do WhatsApp.');
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0]) || typeof data[0].arena_id !== 'string') {
    throw new ApiError(401, 'Conexão do WhatsApp não autorizada.');
  }
  return { supabase, arenaId: data[0].arena_id };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  try {
    const body = requestBody(req);
    const instanceName = requiredString(body.instanceName, 'instanceName', 100);
    if (!/^arenapro-[a-f0-9]{32}$/.test(instanceName)) throw new ApiError(400, 'Instância inválida.');
    const token = header(req, 'x-arenapro-webhook')
      || header(req, 'authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
      || '';
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new ApiError(401, 'Credencial do webhook inválida.');
    const tokenHash = sha256(token);
    const { supabase } = await requireInstance(instanceName, tokenHash);
    const action = requiredString(body.action, 'action', 40);

    if (action === 'authorize') {
      const { data, error } = await supabase.rpc('whatsapp_authorize_instance', {
        p_instance_name: instanceName,
        p_token_hash: tokenHash,
      });
      if (error || !Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
        throw new ApiError(401, 'Conexão do WhatsApp não autorizada.');
      }
      return json(res, 200, {
        authorized: true,
        arena: {
          name: data[0].arena_name,
          city: data[0].city,
          state: data[0].state,
          timezone: data[0].timezone,
        },
      });
    }

    if (action === 'availability') {
      const date = requiredString(body.date, 'date', 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'Informe a data no formato AAAA-MM-DD.');
      const { data, error } = await supabase.rpc('whatsapp_get_availability', {
        p_instance_name: instanceName,
        p_token_hash: tokenHash,
        p_date: date,
      });
      if (error) throw new ApiError(400, error.message.slice(0, 250));
      return json(res, 200, { availability: data ?? [] });
    }

    if (action === 'create_offer') {
      const phone = normalizePhone(requiredString(body.senderPhone, 'senderPhone', 40));
      const customerName = requiredString(body.customerName, 'customerName', 120);
      const courtId = requiredString(body.courtId, 'courtId', 36);
      const startAt = requiredString(body.startAt, 'startAt', 40);
      if (!/^[0-9a-f-]{36}$/i.test(courtId) || Number.isNaN(Date.parse(startAt))) {
        throw new ApiError(400, 'Quadra ou horário inválido.');
      }
      const { data, error } = await supabase.rpc('whatsapp_create_booking_offer', {
        p_instance_name: instanceName,
        p_token_hash: tokenHash,
        p_sender_phone: phone,
        p_customer_name: customerName,
        p_court_id: courtId,
        p_start_at: startAt,
      });
      if (error) throw new ApiError(409, error.message.slice(0, 250));
      return json(res, 200, { offer: data });
    }

    if (action === 'confirm') {
      const phone = normalizePhone(requiredString(body.senderPhone, 'senderPhone', 40));
      const code = requiredString(body.confirmationCode, 'confirmationCode', 12).toUpperCase();
      const messageId = requiredString(body.messageId, 'messageId', 160);
      const { data, error } = await supabase.rpc('whatsapp_confirm_booking', {
        p_instance_name: instanceName,
        p_token_hash: tokenHash,
        p_sender_phone: phone,
        p_confirmation_code: code,
        p_message_id: messageId,
      });
      if (error) throw new ApiError(409, error.message.slice(0, 250));
      return json(res, 200, { booking: data });
    }

    if (action === 'connection_status') {
      const state = requiredString(body.status, 'status', 20).toUpperCase();
      const status = state === 'OPEN' || state === 'CONNECTED' ? 'CONNECTED'
        : state === 'CONNECTING' || state === 'QR' ? 'CONNECTING'
        : state === 'CLOSE' || state === 'CLOSED' || state === 'DISCONNECTED' ? 'DISCONNECTED'
        : 'ERROR';
      const phoneNumber = typeof body.phoneNumber === 'string' ? normalizePhone(body.phoneNumber) : null;
      const { data, error } = await supabase.rpc('whatsapp_set_connection_status', {
        p_instance_name: instanceName,
        p_token_hash: tokenHash,
        p_status: status,
        p_phone_number: phoneNumber,
      });
      if (error || data !== true) throw new ApiError(401, 'Não foi possível atualizar o status da conexão.');
      return json(res, 200, { status });
    }

    if (action === 'send') {
      const phone = normalizePhone(requiredString(body.phone, 'phone', 40));
      const text = requiredString(body.text, 'text', 4000);
      if (phone.length < 10) throw new ApiError(400, 'Telefone de destino inválido.');
      // Authorization has already bound this instance to a valid arena token.
      const result = await evolutionRequest<unknown>(
        `/message/sendText/${encodeURIComponent(instanceName)}`,
        { method: 'POST', body: { number: phone, text } },
      );
      return json(res, 200, { sent: true, result: isRecord(result) ? { key: result.key ?? null } : null });
    }

    return json(res, 400, { error: 'Ação inválida.' } satisfies JsonRecord);
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Erro inesperado ao processar webhook.';
    return json(res, statusCode, { error: message });
  }
}


