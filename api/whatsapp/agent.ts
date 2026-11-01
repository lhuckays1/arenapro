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

function normalizeOutboundMessageHash(value: string): string {
  return sha256(value.normalize('NFKC').trim().replace(/\s+/g, ' '));
}

function conversationKey(instanceName: string, tokenHash: string, phone: string): string {
  return sha256(`${instanceName}:${tokenHash}:${phone}`);
}

async function requireInstance(
  instanceName: string,
  tokenHash: string,
): Promise<{ supabase: ReturnType<typeof getSupabaseClient>; arenaId: string; timezone: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('whatsapp_authorize_instance', {
    p_instance_name: instanceName,
    p_token_hash: tokenHash,
  });
  if (error) throw new ApiError(500, 'Não foi possível validar a conexão do WhatsApp.');
  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    !isRecord(data[0]) ||
    typeof data[0].arena_id !== 'string' ||
    typeof data[0].timezone !== 'string' ||
    !data[0].timezone.trim()
  ) {
    throw new ApiError(401, 'Conexão do WhatsApp não autorizada.');
  }
  return { supabase, arenaId: data[0].arena_id, timezone: data[0].timezone };
}


function normalizeSlotLabel(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
    : '';
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function localSlotTime(value: unknown, timezone: string): string | null {
  if (typeof value !== 'string') return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.hour || !values.minute) return null;
  return `${values.hour}:${values.minute}`;
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
    const { supabase, timezone } = await requireInstance(instanceName, tokenHash);
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
      let courtId: string;
      let startAt: string;

      const hasSlotDetails = ['availabilityDate', 'time', 'courtName', 'modality']
        .some((field) => body[field] !== undefined);
      if (hasSlotDetails) {
        const availabilityDate = requiredString(body.availabilityDate, 'availabilityDate', 10);
        const time = requiredString(body.time, 'time', 5);
        const courtName = requiredString(body.courtName, 'courtName', 120);
        const modality = requiredString(body.modality, 'modality', 120);
        if (!isIsoDate(availabilityDate) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
          throw new ApiError(400, 'Data ou horário local inválido.');
        }

        const { data: availability, error: availabilityError } = await supabase.rpc('whatsapp_get_availability', {
          p_instance_name: instanceName,
          p_token_hash: tokenHash,
          p_date: availabilityDate,
        });
        if (availabilityError) throw new ApiError(409, availabilityError.message.slice(0, 250));

        const matchingSlots = new Map<string, JsonRecord>();
        if (Array.isArray(availability)) {
          for (const slot of availability) {
            if (!isRecord(slot)) continue;
            if (
              normalizeSlotLabel(slot.court_name) !== normalizeSlotLabel(courtName) ||
              normalizeSlotLabel(slot.modality) !== normalizeSlotLabel(modality) ||
              localSlotTime(slot.start_at, timezone) !== time
            ) continue;
            if (typeof slot.court_id !== 'string' || typeof slot.start_at !== 'string') continue;
            matchingSlots.set(`${slot.court_id}|${slot.start_at}`, slot);
          }
        }

        const candidates = Array.from(matchingSlots.values());
        if (candidates.length !== 1) {
          throw new ApiError(409, 'Esse horário não está mais disponível. Consulte os horários novamente.');
        }
        courtId = requiredString(candidates[0].court_id, 'court_id', 36);
        startAt = requiredString(candidates[0].start_at, 'start_at', 40);
      } else {
        // Backward compatibility while the n8n workflow switches to user-facing slot fields.
        courtId = requiredString(body.courtId, 'courtId', 36);
        startAt = requiredString(body.startAt, 'startAt', 40);
      }

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
      const simpleConfirmation = body.simpleConfirmation === true
        && typeof body.messageText === 'string'
        && body.messageText.trim().toLocaleUpperCase('pt-BR') === 'SIM';
      const code = simpleConfirmation
        ? ''
        : requiredString(body.confirmationCode, 'confirmationCode', 12).toUpperCase();
      if (!simpleConfirmation && !/^[A-F0-9]{8}$/.test(code)) {
        throw new ApiError(400, 'Informe SIM ou o código de confirmação da oferta.');
      }
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

    if (action === 'handoff_status') {
      const phone = normalizePhone(requiredString(body.senderPhone, 'senderPhone', 40));
      if (phone.length < 6 || phone.length > 24) throw new ApiError(400, 'Telefone de conversa inválido.');
      const { data, error } = await supabase.rpc('whatsapp_get_handoff_status', {
        p_instance_name: instanceName,
        p_token_hash: tokenHash,
        p_conversation_key: conversationKey(instanceName, tokenHash, phone),
      });
      if (error) throw new ApiError(503, 'Não foi possível verificar se o atendimento humano está ativo.');
      return json(res, 200, isRecord(data) ? data : { paused: false });
    }

    if (action === 'classify_outbound') {
      const phone = normalizePhone(requiredString(body.senderPhone, 'senderPhone', 40));
      if (phone.length < 6 || phone.length > 24) throw new ApiError(400, 'Telefone de conversa inválido.');
      const messageId = typeof body.messageId === 'string' ? body.messageId.trim().slice(0, 160) : '';
      const messageText = typeof body.messageText === 'string' ? body.messageText.slice(0, 4000) : '';
      const contentHash = messageText.trim() ? normalizeOutboundMessageHash(messageText) : null;
      const { data, error } = await supabase.rpc('whatsapp_classify_outbound_event', {
        p_instance_name: instanceName,
        p_token_hash: tokenHash,
        p_conversation_key: conversationKey(instanceName, tokenHash, phone),
        p_message_id: messageId || null,
        p_content_hash: contentHash,
      });
      if (error) throw new ApiError(503, 'Não foi possível registrar a transferência para atendimento humano.');
      return json(res, 200, isRecord(data) ? data : { isBotMessage: false, paused: true });
    }

    if (action === 'send') {
      const phone = normalizePhone(requiredString(body.phone, 'phone', 40));
      const text = requiredString(body.text, 'text', 4000);
      if (phone.length < 10) throw new ApiError(400, 'Telefone de destino inválido.');

      // Mark the expected bot echo before calling Evolution to close the webhook race.
      const { data: markerId, error: markerError } = await supabase.rpc('whatsapp_begin_bot_outbound', {
        p_instance_name: instanceName,
        p_token_hash: tokenHash,
        p_conversation_key: conversationKey(instanceName, tokenHash, phone),
        p_content_hash: normalizeOutboundMessageHash(text),
      });
      if (markerError || typeof markerId !== 'string') {
        throw new ApiError(503, 'Não foi possível registrar a resposta automática antes do envio.');
      }

      let result: unknown;
      try {
        result = await evolutionRequest<unknown>(
          `/message/sendText/${encodeURIComponent(instanceName)}`,
          { method: 'POST', body: { number: phone, text } },
        );
      } catch (error) {
        await supabase.rpc('whatsapp_cancel_bot_outbound', {
          p_instance_name: instanceName,
          p_token_hash: tokenHash,
          p_outbound_id: markerId,
        });
        throw error;
      }

      const resultKey = isRecord(result) && isRecord(result.key) ? result.key : null;
      const messageId = typeof resultKey?.id === 'string' ? resultKey.id : null;
      const { error: trackingError } = await supabase.rpc('whatsapp_complete_bot_outbound', {
        p_instance_name: instanceName,
        p_token_hash: tokenHash,
        p_outbound_id: markerId,
        p_message_id: messageId,
      });
      return json(res, 200, {
        sent: true,
        format: 'text',
        echoTracked: !trackingError,
        result: isRecord(result) ? { key: result.key ?? null } : null,
      });
    }

    return json(res, 400, { error: 'Ação inválida.' } satisfies JsonRecord);
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Erro inesperado ao processar webhook.';
    return json(res, statusCode, { error: message });
  }
}


