import { createHmac } from 'node:crypto';
import { ApiError, isRecord, sha256 } from './whatsapp.js';

export const evolutionGoInstanceName = (arenaId: string) =>
  'arenapro-' + sha256('evolution-go:' + arenaId.toLowerCase()).slice(0, 32);

export function evolutionGoConfig() {
  const url = process.env.ARENAPRO_EVOLUTION_GO_CONTROL_URL;
  const secret = process.env.ARENAPRO_EVOLUTION_GO_CONTROL_TOKEN;
  return url && secret ? { url, secret } : null;
}

export function evolutionGoToken(secret: string, instanceName: string): string {
  return createHmac('sha256', secret).update('whatsapp-instance:' + instanceName).digest('hex');
}

type Action = 'status' | 'connect' | 'pair' | 'disconnect';
type State = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export async function evolutionGoControl(
  config: NonNullable<ReturnType<typeof evolutionGoConfig>>,
  arenaId: string,
  action: Action,
  phone?: string,
) {
  let response: Response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + config.secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ arenaId, action, phone }),
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
  } catch {
    throw new ApiError(503, 'O serviço do WhatsApp está temporariamente indisponível.');
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(result) || result.ok !== true) {
    const message = isRecord(result) && result.reason === 'pairing_pending'
      ? 'O WhatsApp ainda está preparando o pareamento. Tente gerar o código novamente em instantes.'
      : 'Não foi possível atualizar a conexão com o WhatsApp. Tente novamente em instantes.';
    throw new ApiError(503, message);
  }
  const status = result.status;
  if (status !== 'CONNECTED' && status !== 'CONNECTING' && status !== 'DISCONNECTED') {
    throw new ApiError(503, 'O serviço retornou um status de conexão inválido.');
  }
  return {
    status: status as State,
    phoneNumber: typeof result.phoneNumber === 'string' ? result.phoneNumber : null,
    qrCode: typeof result.qrCode === 'string' && /^data:image\/png;base64,[a-z0-9+/=]+$/i.test(result.qrCode)
      ? result.qrCode : null,
    pairingCode: typeof result.pairingCode === 'string' && /^[\dA-Z]{4}-?[\dA-Z]{4}$/i.test(result.pairingCode)
      ? result.pairingCode : null,
  };
}
