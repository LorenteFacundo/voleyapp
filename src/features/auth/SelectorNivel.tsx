import { useId } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { NIVELES_JUGADOR, opcionNivelCercana } from '@/lib/nivel';

/**
 * Elección del nivel de juego con tarjetas (radio). Si el valor guardado no
 * coincide exacto con una opción (escala 1–10), se marca la más cercana y no
 * se cambia hasta que la persona elija otra.
 */
export function SelectorNivel({
  valor, onChange, error, leyenda = 'Tu nivel de juego', ayuda,
}: { valor: number | null; onChange: (nivel: number) => void; error?: string | null; leyenda?: string; ayuda?: string }) {
  const id = useId();
  const seleccion = valor == null ? null : opcionNivelCercana(valor);
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;

  return (
    <fieldset aria-describedby={descripcion}>
      <legend className="mb-1 text-sm font-semibold text-ink">{leyenda}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {NIVELES_JUGADOR.map((opcion) => {
          const elegida = seleccion === opcion.value;
          return (
            <label
              key={opcion.value}
              className={clsx(
                'relative flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 transition',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vb-orange-ink',
                elegida ? 'border-vb-orange-ink bg-vb-orange-light' : 'border-ink/15 bg-white hover:border-vb-orange/60',
              )}
            >
              <input
                type="radio"
                name={`${id}-nivel`}
                value={opcion.value}
                checked={elegida}
                onChange={() => onChange(opcion.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2 text-sm font-bold text-ink">
                {opcion.label}
                <span
                  aria-hidden="true"
                  className={clsx(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                    elegida ? 'border-vb-orange-ink bg-vb-orange-ink text-white' : 'border-ink/25',
                  )}
                >
                  {elegida && <Check size={12} strokeWidth={3} />}
                </span>
              </span>
              <span className="text-xs leading-snug text-ink/65">{opcion.descripcion}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">{error}</p>
      ) : ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-ink/65">{ayuda}</p>
      ) : null}
    </fieldset>
  );
}
