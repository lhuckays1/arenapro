import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddressMatches, searchArenaAddress } from '../src/services/geocoding.service';

const feature = (properties = {}, coordinates: unknown[] = [-46.94,-19.59]) => ({
  properties: { countrycode:'BR',city:'Araxá',state:'Minas Gerais',street:'Rua de Teste',housenumber:'100', ...properties },
  geometry: { coordinates },
});
test('converte GeoJSON longitude/latitude e reconhece cidade sem acento', () => {
  const [result] = parseAddressMatches({features:[feature()]}, 'Araxa', 'mg');
  assert.equal(result.latitude, -19.59); assert.equal(result.longitude, -46.94);
  assert.equal(result.approximate, false); assert.match(result.label, /Araxá/);
});
test('descarta centro de cidade, outro município, UF, país e coordenadas inválidas', () => {
  const features = [feature({city:'Uberaba'}),feature({state:'São Paulo'}),feature({countrycode:'PT'}),
    feature({}, [null,null]), feature({},[181,91]), feature({street:'',osm_key:'place',osm_value:'city'})];
  assert.deepEqual(parseAddressMatches({features}, 'Araxá','MG'), []);
  assert.deepEqual(parseAddressMatches({} as any, 'Araxá','MG'), []);
  assert.deepEqual(parseAddressMatches(null as any, 'Araxá','MG'), []);
});
test('rua sem número é explicitamente aproximada e resultados duplicados são removidos', () => {
  const f = feature({housenumber:'',street:'',name:'Rua de Teste',osm_key:'highway'});
  const results = parseAddressMatches({features:[f,f]},'Araxá','MG');
  assert.equal(results.length, 1); assert.equal(results[0].approximate, true);
});
test('busca valida campos, envia somente endereço comercial, usa cache e trata falhas', async () => {
  const originalFetch = globalThis.fetch, originalNow = Date.now;
  let time = 100000; Date.now = () => time;
  let count = 0;
  globalThis.fetch = (async (input: URL, init: RequestInit) => {
    count++;
    assert.equal(input.origin, 'https://photon.komoot.io');
    assert.equal(input.searchParams.get('countrycode'), 'BR');
    assert.equal(input.searchParams.has('lat'), false); assert.equal(input.searchParams.has('lon'), false);
    assert.equal(init.credentials,'omit');
    return {ok:true,json: async () => ({features:[feature()]})} as Response;
  }) as typeof fetch;
  try {
    const signal = new AbortController().signal;
    await assert.rejects(searchArenaAddress('', 'Araxá','MG',signal), /Preencha/);
    await assert.rejects(searchArenaAddress('Rua Teste','Araxá','ZZ',signal), /UF válida/);
    const a = await searchArenaAddress('Rua de Teste, 100','Araxá','MG',signal);
    assert.equal(a.length, 1);
    await searchArenaAddress('Rua de Teste, 100','Araxá','MG',signal); assert.equal(count,1);
    await assert.rejects(searchArenaAddress('Outra rua, 1','Araxá','MG',signal), /Aguarde/);
    time += 2000;
    globalThis.fetch = (async () => ({ok:false})) as typeof fetch;
    await assert.rejects(searchArenaAddress('Outra rua, 1','Araxá','MG',signal), /indisponível/);
    time += 2000;
    globalThis.fetch = (async (_input, init) => { assert.ok(init?.signal); throw new DOMException('Aborted','AbortError'); }) as typeof fetch;
    await assert.rejects(searchArenaAddress('Outra rua, 2','Araxá','MG',signal), /Aborted/);
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
});
