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

function shiftIsoDate(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function localSlotDateTime(value: unknown, timezone: string): { date: string; time: string } | null {
  if (typeof value !== 'string') return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.year || !values.month || !values.day || !values.hour || !values.minute) return null;
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
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

      const hasSlotDetails = ['slotDate', 'time', 'courtName', 'modality']
        .some((field) => body[field] !== undefined);
      if (hasSlotDetails) {
        const slotDate = requiredString(body.slotDate, 'slotDate', 10);
        const time = requiredString(body.time, 'time', 5);
        const courtName = requiredString(body.courtName, 'courtName', 120);
        const modality = requiredString(body.modality, 'modality', 120);
        if (!isIsoDate(slotDate) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
          throw new ApiError(400, 'Data ou horário local inválido.');
        }

        const currentLocal = localSlotDateTime(new Date().toISOString(), timezone);
        if (!currentLocal) throw new ApiError(500, 'Não foi possível validar o fuso horário da arena.');
        const availabilityDates = [slotDate];
        if (slotDate > currentLocal.date) availabilityDates.push(shiftIsoDate(slotDate, -1));

        const matchingSlots = new Map<string, JsonRecord>();
        for (const availabilityDate of availabilityDates) {
          const { data: availability, error: availabilityError } = await supabase.rpc('whatsapp_get_availability', {
            p_instance_name: instanceName,
            p_token_hash: tokenHash,
            p_date: availabilityDate,
          });
          if (availabilityError) throw new ApiError(409, availabilityError.message.slice(0, 250));
          if (!Array.isArray(availability)) continue;

          for (const slot of availability) {
            if (!isRecord(slot)) continue;
            if (
              normalizeSlotLabel(slot.court_name) !== normalizeSlotLabel(courtName) ||
              normalizeSlotLabel(slot.modality) !== normalizeSlotLabel(modality)
            ) continue;
            const local = localSlotDateTime(slot.start_at, timezone);
            if (local?.date !== slotDate || local.time !== time) continue;
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


