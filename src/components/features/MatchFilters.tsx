import { useState } from 'react';
import { Search, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export type FiltrosPartido = {
  nivel: string | null;
  texto: string;
  radioKm: number | null;
};

type Props = {
  filtros: FiltrosPartido;
  onFiltrosChange: (filtros: FiltrosPartido) => void;
  resultadoCount: number;
};

const NIVELES = [
  { value: null, label: 'Todos' },
  { value: 'recreativo', label: 'Recreativo' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'competitivo', label: 'Competitivo' },
];

const RADIOS = [
  { value: null, label: 'Todos' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
];

export function MatchFilters({ filtros, onFiltrosChange, resultadoCount }: Props) {
  const [expanded, setExpanded] = useState(false);

  function update(partial: Partial<FiltrosPartido>) {
    onFiltrosChange({ ...filtros, ...partial });
  }

  const tieneFiltros = filtros.nivel || filtros.texto || filtros.radioKm;

  return (
    <div className="rounded-xl border border-vb-gray/10 bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-vb-gray/40" size={18} />
          <Input
            className="pl-10"
            placeholder="Buscar por club, cancha o dirección..."
            value={filtros.texto}
            onChange={(e) => update({ texto: e.target.value })}
          />
        </div>
        <Button
          variant={expanded ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={16} />
          Filtros
          {tieneFiltros && (
            <span className="ml-1 grid h-5 w-5 place-items-center rounded-full bg-vb-orange text-[10px] font-bold text-white">
              {[filtros.nivel, filtros.radioKm].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {expanded && (
        <div className="mt-4 grid gap-4 border-t border-vb-gray/10 pt-4">
          <div>
            <label className="mb-2 block text-xs font-semibold text-vb-gray/60 uppercase tracking-wide">Nivel</label>
            <div className="flex flex-wrap gap-2">
              {NIVELES.map((n) => (
                <button
                  key={n.label}
                  onClick={() => update({ nivel: n.value })}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    filtros.nivel === n.value
                      ? 'bg-vb-orange text-white'
                      : 'bg-vb-gray/10 text-vb-gray/60 hover:bg-vb-gray/20'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-vb-gray/60 uppercase tracking-wide">
              <MapPin size={14} />
              Cercanía
            </label>
            <div className="flex flex-wrap gap-2">
              {RADIOS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => update({ radioKm: r.value })}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    filtros.radioKm === r.value
                      ? 'bg-vb-orange text-white'
                      : 'bg-vb-gray/10 text-vb-gray/60 hover:bg-vb-gray/20'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {tieneFiltros && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltrosChange({ nivel: null, texto: '', radioKm: null })}
              className="justify-self-start"
            >
              <X size={14} />
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-vb-gray/50">
        {resultadoCount} partido{resultadoCount !== 1 ? 's' : ''} encontrado{resultadoCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
