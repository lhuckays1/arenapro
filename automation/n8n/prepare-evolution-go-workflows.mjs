import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const [exportPath, eventsPath, controlPath] = process.argv.slice(2);
const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
const source = Array.isArray(exported) ? exported[0] : exported;
const nodes = structuredClone(source.nodes);
const get = (name) => {
  const node = nodes.find((item) => item.name === name);
  assert.ok(node, name);
  return node;
};

const webhook = get('Evolution Go Webhook');
webhook.parameters.path = 'arenapro-evolution-go-events';
webhook.webhookId = randomUUID();
const adapter = get('Adapt Evolution Go Event').parameters;
const original = adapter.jsCode;
adapter.jsCode = original
  .replace(/^const (GO_TEST_INSTANCE|ARENA_INSTANCE|ARENA_WEBHOOK_TOKEN|GO_INSTANCE_TOKEN) = .*;\r?\n/gm, '')
  .replace(
    /  if \(str\(payload\.instanceName.*\r?\n  if \(str\(payload\.instanceToken.*\r?\n/,
    [
      '  const instanceName = str(payload.instanceName || payload.instance);',
      '  const token = str(payload.instanceToken);',
      '  if (!/^arenapro-[a-f0-9]{32}$/.test(instanceName) || !/^[a-f0-9]{64}$/.test(token)) continue;',
      '',
    ].join('\n'),
  )
  .replaceAll('ARENA_INSTANCE', 'instanceName')
  .replaceAll('ARENA_WEBHOOK_TOKEN', 'token');
assert.ok(adapter.jsCode.includes('const token = str(payload.instanceToken);'));
assert.ok(!adapter.jsCode.includes('GO_INSTANCE_TOKEN') && !adapter.jsCode.includes('GO_TEST_INSTANCE'));
assert.ok(!/['"][a-f0-9]{64}['"]/i.test(adapter.jsCode), 'The workflow must not embed the test credentials');

const adapt = new Function('$input', adapter.jsCode);
const token = 'a'.repeat(64);
const instanceName = 'arenapro-' + 'b'.repeat(32);
const sample = {
  event: 'Message', instanceName, instanceToken: token,
  data: {
    Info: { Chat: '5500000000000@s.whatsapp.net', ID: 'fixture', IsGroup: false },
    Message: { templateButtonReplyMessage: { selectedID: 'SIM ABCD1234' } },
  },
};
const input = (body) => ({ all: () => [{ json: { body } }] });
const [tap] = adapt(input(sample));
assert.equal(tap.json.body.instanceName, instanceName);
assert.equal(tap.json.headers['x-arenapro-webhook'], token);
assert.equal(tap.json.body.data.text, 'SIM ABCD1234');
assert.equal(adapt(input({ ...sample, event: 'ButtonClick' })).length, 0);
sample.data.Info.IsGroup = true;
assert.equal(adapt(input(sample)).length, 0);

const settings = {
  executionOrder: 'v1',
  saveDataSuccessExecution: 'none',
  saveDataErrorExecution: 'none',
  saveManualExecutions: false,
  saveExecutionProgress: false,
};

writeFileSync(eventsPath, JSON.stringify([{
  id: 'ArenaProEvoGoEvents',
  name: 'ArenaPro - Reservas WhatsApp (Evolution Go)',
  active: false,
  nodes,
  connections: source.connections,
  settings,
}]), { mode: 0o600 });

const controlWebhook = {
  id: randomUUID(), name: 'ArenaPro Control', type: 'n8n-nodes-base.webhook',
  typeVersion: 2, position: [0, 0], webhookId: randomUUID(),
  parameters: { httpMethod: 'POST', path: 'arenapro-evolution-go-control', responseMode: 'lastNode', options: {} },
};
const proxy = {
  id: randomUUID(), name: 'Call private control', type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2, position: [240, 0],
  parameters: {
    method: 'POST',
    url: 'http://arenapro-evolution-go-control:4010/control',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Authorization', value: "={{ $json.headers.authorization || '' }}" }] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ $json.body }}',
    options: { timeout: 15000, response: { response: { neverError: true } } },
  },
};
writeFileSync(controlPath, JSON.stringify([{
  id: 'ArenaProEvoGoControl',
  name: 'ArenaPro - Pareamento WhatsApp (Evolution Go)',
  active: false,
  nodes: [controlWebhook, proxy],
  connections: { [controlWebhook.name]: { main: [[{ node: proxy.name, type: 'main', index: 0 }]] } },
  settings,
}]), { mode: 0o600 });
