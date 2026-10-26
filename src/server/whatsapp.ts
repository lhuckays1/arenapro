import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type ApiRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

export type ApiResponse = ServerResponse & {
  status?: (code: number) => ApiResponse;
  json?: (body: unknown) => void;
};

export type JsonRecord = Record<string, unknown>;

export function json(res: ApiResponse, statusCode: number, payload: JsonRecord): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(payload);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function requestBody(req: ApiRequest): JsonRecord {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body as JsonRecord;
  }
  return {};
}

export function header(req: ApiRequest, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || null;
  return typeof value === 'string' ? value : null;
}

export function getSupabaseClient(authorization?: string): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase não está configurado no servidor.');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(authorization ? { global: { headers: { Authorization: authorization } } } : {}),
  });
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function newWebhookToken(): string {
  return randomBytes(32).toString('hex');
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export async function requireArenaAdmin(
  req: ApiRequest,
  arenaId: string,
): Promise<{ supabase: SupabaseClient; userId: string }> {
  const authorization = header(req, 'authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!authorization || !token) throw new ApiError(401, 'Faça login para gerenciar o WhatsApp da arena.');

  const supabase = getSupabaseClient(authorization);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new ApiError(401, 'Sessão inválida. Entre novamente.');

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_arena_whatsapp_admin', {
    lookup_arena_id: arenaId,
  });
  if (roleError) throw new ApiError(500, 'Não foi possível validar as permissões da arena.');
  if (isAdmin !== true) throw new ApiError(403, 'Somente administradores da arena podem gerenciar o WhatsApp.');
  return { supabase, userId: userData.user.id };
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly upstreamStatusCode?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getEvolutionConfig(): { url: string; apiKey: string } {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!url || !apiKey) throw new ApiError(503, 'A integração Evolution API ainda não foi configurada no servidor.');
  return { url, apiKey };
}

export async function evolutionRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { url, apiKey } = getEvolutionConfig();
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: options.method || 'GET',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new ApiError(502, 'Não foi possível acessar a Evolution API.');
  }

  const responseText = await response.text();
  let parsed: unknown = null;
  try { parsed = responseText ? JSON.parse(responseText) : null; } catch { parsed = responseText; }
  if (!response.ok) {
    const method = options.method || 'GET';
    throw new ApiError(
      502,
      `Evolution API respondeu com HTTP ${response.status} ao acessar ${method} ${path}.`,
      response.status,
    );
  }
  return parsed as T;
}

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getConnectionState(value: unknown): string {
  if (!isRecord(value)) return 'disconnected';
  const instance = isRecord(value.instance) ? value.instance : {};
  const state = value.state ?? instance.state ?? instance.connectionStatus ?? value.status;
  return typeof state === 'string' ? state.toLowerCase() : 'disconnected';
}

export function getQrCode(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const qrcode = isRecord(value.qrcode) ? value.qrcode : {};
  const raw = value.base64 ?? qrcode.base64 ?? value.qrCode ?? qrcode.code;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  if (raw.startsWith('data:image/')) return raw;
  return `data:image/png;base64,${raw}`;
}

export function toConnectionStatus(state: string): 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' {
  if (['open', 'connected', 'authenticated'].includes(state)) return 'CONNECTED';
  if (['connecting', 'qr', 'pairing'].includes(state)) return 'CONNECTING';
  return 'DISCONNECTED';
}


