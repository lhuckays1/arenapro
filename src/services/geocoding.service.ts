import { Coordinates, hasCoordinates, normalizeLocationText } from '../utils/location';

export interface AddressMatch extends Coordinates { label: string; approximate: boolean }

const states: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

interface PhotonFeature {
  geometry?: { coordinates?: unknown[] };
  properties?: Record<string, unknown>;
}

// Searches run only on explicit administrator action. Never send client GPS to the provider.
const cache = new Map<string, AddressMatch[]>();
let lastSearch = 0;

export function parseAddressMatches(data: { features?: PhotonFeature[] }, city: string, uf: string): AddressMatch[] {
  const expectedState = states[uf.toUpperCase()];
  if (!expectedState || !Array.isArray(data?.features)) return [];
  return data.features.flatMap(feature => {
    const p = feature?.properties;
    const coordinates = feature?.geometry?.coordinates;
    if (!p || !Array.isArray(coordinates)) return [];
    const point = { latitude: coordinates[1], longitude: coordinates[0] };
    if (!hasCoordinates(point as Coordinates)) return [];
    const text = (key: string) => typeof p[key] === 'string' ? p[key] as string : '';
    if (text('countrycode').toUpperCase() !== 'BR' ||
      normalizeLocationText(text('city')) !== normalizeLocationText(city) ||
      ![uf, expectedState].some(state => normalizeLocationText(state) === normalizeLocationText(text('state')))) return [];
    // A city or neighborhood centroid must never silently become the arena's position.
    if (!text('street') && text('osm_key') !== 'highway') return [];
    const label = [...new Set([text('name'), text('street'), text('housenumber'), text('district'), text('city'), text('state')].filter(Boolean))].join(', ');
    return [{ ...point as Coordinates, label, approximate: !text('housenumber') }];
  }).filter((match, index, all) => all.findIndex(m => m.latitude === match.latitude && m.longitude === match.longitude) === index);
}

export async function searchArenaAddress(address: string, city: string, uf: string, signal: AbortSignal): Promise<AddressMatch[]> {
  const state = states[uf.trim().toUpperCase()];
  if (!address.trim() || !city.trim() || !state) throw new Error('Preencha endereço completo, cidade e uma UF válida antes de buscar.');
  const key = normalizeLocationText([address, city, uf].join(', '));
  if (cache.has(key)) return cache.get(key)!;
  if (Date.now() - lastSearch < 1500) throw new Error('Aguarde um instante antes de buscar novamente.');
  lastSearch = Date.now();
  const url = new URL(import.meta.env?.VITE_GEOCODING_URL || 'https://photon.komoot.io/api/');
  url.searchParams.set('q', [address.trim(), city.trim(), state, 'Brasil'].join(', '));
  url.searchParams.set('countrycode', 'BR');
  url.searchParams.set('limit', '8');
  const response = await fetch(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('A busca de endereço está indisponível. Tente novamente mais tarde ou use a localização atual.');
  const matches = parseAddressMatches(await response.json(), city, uf.trim());
  if (cache.size >= 30) cache.clear();
  cache.set(key, matches);
  return matches;
}
