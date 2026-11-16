import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const { EVOLUTION_GO_CONTROL_TOKEN: controlToken, EVOLUTION_GO_GLOBAL_KEY: globalKey,
  EVOLUTION_GO_EVENTS_URL: eventsUrl, EVOLUTION_GO_URL: goUrl } = process.env;

if (!controlToken || !globalKey || !eventsUrl || !goUrl) {
  throw new Error('Incomplete Evolution Go control configuration');
}

function sameCredential(received, expected) {
  const digest = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

async function fromGo(path, key, method = 'GET', body) {
  const response = await fetch(new URL(path, goUrl), {
    method,
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  });
  const result = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data: result?.data, error: result?.error };
}

function instanceName(arenaId) {
  return 'arenapro-' + createHash('sha256').update('evolution-go:' + arenaId).digest('hex').slice(0, 32);
}

async function inspect(arenaId, name, key) {
  const info = await fromGo('/instance/info/' + arenaId, globalKey);
  if (info.status === 404 || (info.status === 500 && info.error === 'record not found')) return null;
  if (!info.ok || info.data?.name !== name || info.data?.token !== key) {
    throw new Error('Instance mismatch');
  }
  return info.data;
}

async function getStatus(info, key, includeQr) {
  if (!info) return { status: 'DISCONNECTED' };
  const state = await fromGo('/instance/status', key);
  if (!state.ok || !state.data) throw new Error('Status query failed');
  const loggedIn = state.data.LoggedIn === true || state.data.loggedIn === true;
  const connected = state.data.Connected === true || state.data.connected === true;
  if (loggedIn && connected) {
    const phoneNumber = String(info.jid || '').match(/^(\d+)(?::\d+)?@s\.whatsapp\.net$/)?.[1] || null;
    return { status: 'CONNECTED', phoneNumber };
  }
  if (!includeQr || loggedIn) return { status: connected ? 'CONNECTING' : 'DISCONNECTED' };
  const qr = await fromGo('/instance/qr', key);
  const qrCode = qr.ok && [qr.data?.code, qr.data?.qrcode]
    .find((value) => typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value));
  return { status: connected || qrCode ? 'CONNECTING' : 'DISCONNECTED', qrCode: qrCode || null };
}

async function control(arenaId, action, phone) {
  const name = instanceName(arenaId);
  const key = createHmac('sha256', controlToken).update('whatsapp-instance:' + name).digest('hex');
  let info = await inspect(arenaId, name, key);
  if (action === 'status') return getStatus(info, key, Boolean(info?.webhook));
  if (action === 'disconnect') {
    if (!info) return { status: 'DISCONNECTED' };
    const loggedOut = await fromGo('/instance/logout', key, 'DELETE');
    if (!loggedOut.ok) {
      if (info.connected) throw new Error('Logout failed');
      const stopped = await fromGo('/instance/disconnect', key, 'POST', {});
      if (!stopped.ok) throw new Error('Disconnect failed');
    }
    return { status: 'DISCONNECTED' };
  }
  if (!info) {
    await fromGo('/instance/create', globalKey, 'POST', {
      instanceId: arenaId, name, token: key,
      advancedSettings: { ignoreGroups: true, ignoreStatus: true },
    });
    info = await inspect(arenaId, name, key);
    if (!info) throw new Error('Instance creation failed');
  }
  const current = await getStatus(info, key, false);
  if (current.status === 'CONNECTED') return current;
  const settings = await fromGo('/instance/' + arenaId + '/advanced-settings', key, 'PUT',
    { ignoreGroups: true, ignoreStatus: true });
  if (!settings.ok) throw new Error('Group settings failed');
  const connection = await fromGo('/instance/connect', key, 'POST', {
    webhookUrl: eventsUrl, subscribe: ['MESSAGE'],
  });
  if (!connection.ok) throw new Error('Connect failed');
  if (action === 'pair') {
    const result = await fromGo('/instance/pair', key, 'POST', { phone });
    const pairingCode = result.ok && (result.data?.PairingCode || result.data?.pairingCode || result.data?.code);
    if (!pairingCode) return { status: 'CONNECTING', reason: 'pairing_pending' };
    return { status: 'CONNECTING', pairingCode };
  }
  const refreshed = await inspect(arenaId, name, key);
  const latest = await getStatus(refreshed, key, true);
  return latest.status === 'DISCONNECTED' ? { ...latest, status: 'CONNECTING' } : latest;
}

createServer(async (request, response) => {
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  if (request.method !== 'POST' || request.url !== '/control') return send(404, { ok: false });
  if (!sameCredential(request.headers.authorization || '', 'Bearer ' + controlToken)) return send(401, { ok: false });
  try {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 4096) return send(413, { ok: false });
    }
    const { arenaId, action, phone } = JSON.parse(body);
    if (typeof arenaId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(arenaId) ||
        !['status', 'connect', 'pair', 'disconnect'].includes(action) ||
        (action === 'pair' && (typeof phone !== 'string' || !/^55[1-9]\d{9,10}$/.test(phone)))) {
      return send(400, { ok: false });
    }
    const result = await control(arenaId, action, phone);
    return send(result.reason ? 503 : 200, { ok: !result.reason, ...result });
  } catch {
    return send(503, { ok: false });
  }
}).listen(4010, '0.0.0.0');
