import React, { useId } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { ArenaDiscovery } from '../../hooks/useArenaDiscovery';

export const ArenaLocationFilters: React.FC<{ discovery: ArenaDiscovery }> = ({ discovery: d }) => {
  const id = useId();
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label htmlFor={`${id}-city`} className="block text-xs font-semibold text-slate-300 mb-1.5">Buscar por cidade</label>
          <select id={`${id}-city`} value={d.city} onChange={e => d.selectCity(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-200">
            <option value="">Todas as cidades</option>
            {d.cities.map(city => <option key={city.value} value={city.value}>{city.label}</option>)}
          </select>
        </div>
        <button type="button" onClick={d.useCurrentLocation} disabled={d.locating}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-300 disabled:opacity-50">
          {d.locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          {d.locating ? 'Obtendo localização...' : 'Arenas perto de mim'}
        </button>
        {d.position && <div>
          <label htmlFor={`${id}-radius`} className="block text-xs text-slate-300 mb-1.5">Distância máxima</label>
          <select id={`${id}-radius`} value={d.radius} onChange={e => d.setRadius(Number(e.target.value))}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-200">
            {[5, 10, 25, 50, 100].map(radius => <option key={radius} value={radius}>Até {radius} km</option>)}
          </select>
        </div>}
      </div>
      <div aria-live="polite" className="text-xs text-slate-400 space-y-2">
        {d.locationError && <p role="alert" className="text-amber-300">{d.locationError}</p>}
        {d.position ? <>
          <p>Arenas até {d.radius} km, da mais próxima à mais distante. Distâncias aproximadas em linha reta.</p>
          {d.missingCoordinates > 0 && <p>Arenas sem localização cadastrada aparecem na busca por cidade, mas não na busca por distância.</p>}
          {d.results.length === 0 && <p>Nenhuma arena neste raio com os filtros atuais. Aumente a distância ou busque por cidade.</p>}
        </> : <p>Sua localização será solicitada somente ao clicar no botão e usada apenas nesta consulta.</p>}
      </div>
      {(d.position || d.city || d.locating) && <button type="button" onClick={d.clear} className="text-xs text-emerald-300 underline">Limpar filtro de localização</button>}
    </div>
  );
};
