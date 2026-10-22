import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../src/types';
import { cityKey, distanceInKm, findArenas, hasCoordinates, normalizeLocationText } from '../src/utils/location';

const arena = (id: string, updates: Partial<Arena> = {}): Arena => ({
  id, name: id, slug: id, city: 'Araxá', state: 'MG', timezone: 'America/Sao_Paulo', opening_time: '06:00',
  closing_time: '23:00', cancellation_limit_hours: 2, status: 'ACTIVE', created_at: '', updated_at: '', ...updates,
});
const here = { latitude: -19.59, longitude: -46.94 };

test('cidade sem acentos, espaços ou diferença de maiúsculas', () => {
  assert.equal(normalizeLocationText(' ARAXÁ '), 'araxa');
  assert.equal(findArenas([arena('a')], 'araxa', '', null, 25).length, 1);
});
test('UF distingue cidades homônimas e busca inclui endereço', () => {
  const arenas = [arena('a', { address: 'Rua das Palmeiras' }), arena('b', { state: 'SP' })];
  assert.deepEqual(findArenas(arenas, '', cityKey(arenas[0]), null, 25).map(x => x.arena.id), ['a']);
  assert.equal(findArenas(arenas, 'palmeiras', '', null, 25).length, 1);
});
test('coordenadas zero são válidas; ausentes, inválidas e infinitas não são', () => {
  assert.ok(hasCoordinates({ latitude: 0, longitude: 0 }));
  for (const point of [{latitude:null,longitude:null}, {latitude:NaN,longitude:0}, {latitude:91,longitude:0}, {latitude:0,longitude:181}, {latitude:Infinity,longitude:0}]) assert.equal(hasCoordinates(point), false);
});
test('distância Haversine conhecida, simetria, antípodas e ponto idêntico', () => {
  assert.equal(distanceInKm(here, here), 0);
  assert.ok(Math.abs(distanceInKm({latitude:0,longitude:0}, {latitude:0,longitude:1}) - 111.195) < 0.01);
  assert.equal(distanceInKm(here, {latitude:0,longitude:0}), distanceInKm({latitude:0,longitude:0}, here));
  assert.ok(Number.isFinite(distanceInKm({latitude:90,longitude:0}, {latitude:-90,longitude:0})));
});
test('proximidade aplica raio, ordenação, status e filtros juntos', () => {
  const arenas = [arena('longe', {latitude:-20,longitude:-46.94}), arena('sem-gps'),
    arena('perto', {...here, latitude:-19.60}), arena('inativa', {...here,status:'INACTIVE'}), arena('aqui',here)];
  const results = findArenas(arenas, '', '', here, 25);
  assert.deepEqual(results.map(x => x.arena.id), ['aqui','perto']);
  assert.equal(findArenas(arenas, 'perto', '', here, 25).length, 1);
  assert.equal(findArenas(arenas, '', '', here, 100).length, 3);
  assert.equal(findArenas(arenas, '', cityKey(arenas[0]), null, 25).length, 4);
});
test('arenas sem coordenadas permanecem na busca por cidade e ordem original', () => {
  const arenas = [arena('b'), arena('a')];
  assert.deepEqual(findArenas(arenas, '', '', null, 25).map(x => x.arena.id), ['b','a']);
  assert.ok(findArenas(arenas, '', '', null, 25).every(x => x.distance === null));
});
