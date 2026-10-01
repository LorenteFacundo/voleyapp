import { DIAS_SEMANA, DIAS_SEMANA_CORTOS } from '@/lib/date';
import { DIAS_EDITOR } from './horarios';

type Props = {
  leyenda: string;
  seleccionados: readonly number[];
  onChange: (dias: number[]) => void;
  /** Días que no se pueden elegir (por ejemplo, el día que se copia). */
  excluidos?: readonly number[];
  error?: string | null;
};

const ATAJOS = [
  { etiqueta: 'Lun a Vie', dias: [1, 2, 3, 4, 5] },
  { etiqueta: 'Sáb y Dom', dias: [6, 0] },
  { etiqueta: 'Todos', dias: [1, 2, 3, 4, 5, 6, 0] },
];

/** Casillas de lunes a domingo con atajos. */
export function SelectorDias({ leyenda, seleccionados, onChange, excluidos = [], error }: Props) {
  const disponibles = DIAS_EDITOR.filter((dia) => !excluidos.includes(dia));

  function alternar(dia: number, marcado: boolean) {
    onChange(marcado ? [...seleccionados, dia] : seleccionados.filter((otro) => otro !== dia));
  }

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-ink">{leyenda}</legend>
      <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {disponibles.map((dia) => (
          <label
            key={dia}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-ink/15 px-2 text-sm font-semibold text-ink/75 transition has-[:checked]:border-vb-orange-ink has-[:checked]:bg-vb-orange-light has-[:checked]:text-vb-orange-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vb-orange-ink"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-vb-orange-ink"
              checked={seleccionados.includes(dia)}
              onChange={(evento) => alternar(dia, evento.target.checked)}
            />
            <span aria-hidden="true">{DIAS_SEMANA_CORTOS[dia]}</span>
            <span className="sr-only">{DIAS_SEMANA[dia]}</span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {ATAJOS.map((atajo) => (
          <button
            key={atajo.etiqueta}
            type="button"
            className="min-h-11 rounded-lg px-1 text-sm font-semibold text-vb-blue hover:underline"
            onClick={() => onChange(atajo.dias.filter((dia) => !excluidos.includes(dia)))}
          >
            {atajo.etiqueta}
          </button>
        ))}
        {seleccionados.length > 0 && (
          <button type="button" className="min-h-11 rounded-lg px-1 text-sm font-semibold text-ink/65 hover:underline" onClick={() => onChange([])}>
            Ninguno
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}
