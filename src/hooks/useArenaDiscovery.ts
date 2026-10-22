import { useEffect, useRef, useState } from 'react';
import { Arena } from '../types';
import { cityKey, Coordinates, findArenas, hasCoordinates } from '../utils/location';

export function useArenaDiscovery(arenas: Arena[], search: string) {
  const [city, setCity] = useState('');
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [radius, setRadius] = useState(25);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const request = useRef(0);
  const pending = useRef(false);
  useEffect(() => () => { request.current += 1; }, []);

  const cancelLocation = () => {
    request.current += 1;
    pending.current = false;
    setLocating(false);
    setPosition(null);
    setLocationError(null);
  };

  const useCurrentLocation = () => {
    if (pending.current) return;
    setLocationError(null);
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationError('A localização não está disponível. Escolha uma cidade ou use a busca.');
      return;
    }
    const id = ++request.current;
    pending.current = true;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (id !== request.current) return;
      pending.current = false;
      setLocating(false);
      if (!hasCoordinates(coords)) {
        setLocationError('O navegador não retornou uma localização válida. Escolha uma cidade.');
        return;
      }
      setPosition({ latitude: coords.latitude, longitude: coords.longitude });
      setCity('');
    }, error => {
      if (id !== request.current) return;
      pending.current = false;
      setLocating(false);
      setLocationError(error.code === 1
        ? 'Permissão de localização negada. Você pode escolher uma cidade ou autorizar o acesso no navegador.'
        : 'Não foi possível obter sua localização. Tente novamente ou escolha uma cidade.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  };

  const cities = [...new Map(arenas.filter(a => a.status === 'ACTIVE' && cityKey(a)).map(a =>
    [cityKey(a), { value: cityKey(a), label: [a.city?.trim(), a.state?.trim()].filter(Boolean).join(' - ') }]
  )).values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  return {
    city, cities, position, radius, setRadius, locating, locationError,
    useCurrentLocation,
    selectCity: (value: string) => { cancelLocation(); setCity(value); },
    clear: () => { cancelLocation(); setCity(''); },
    results: findArenas(arenas, search, city, position, radius),
    missingCoordinates: arenas.filter(a => a.status === 'ACTIVE' && !hasCoordinates(a)).length,
  };
}

export type ArenaDiscovery = ReturnType<typeof useArenaDiscovery>;
