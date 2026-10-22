import { Arena } from '../types';

export interface Coordinates { latitude: number; longitude: number }

export const normalizeLocationText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');

export function hasCoordinates(value: { latitude?: number | null; longitude?: number | null }): value is Coordinates {
  return typeof value.latitude === 'number' && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === 'number' && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}

export function distanceInKm(a: Coordinates, b: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function cityKey(arena: Pick<Arena, 'city' | 'state'>): string {
  return arena.city?.trim() ? `${normalizeLocationText(arena.city)}|${normalizeLocationText(arena.state || '')}` : '';
}

export function findArenas(arenas: Arena[], search: string, city: string, position: Coordinates | null, radius: number) {
  const term = normalizeLocationText(search);
  return arenas
    .filter(arena => arena.status === 'ACTIVE' && (!city || cityKey(arena) === city) &&
      (!term || [arena.name, arena.city, arena.state, arena.address, arena.description]
        .some(value => value && normalizeLocationText(value).includes(term))))
    .map(arena => ({ arena, distance: position && hasCoordinates(arena) ? distanceInKm(position, arena) : null }))
    .filter(item => !position || (item.distance !== null && item.distance <= radius))
    .sort((a, b) => position ? (a.distance ?? Infinity) - (b.distance ?? Infinity) : 0);
}

export function formatDistance(distance: number): string {
  return `${distance.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}
