import { useId, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';

const BOTON = 'grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink/15 bg-white text-ink transition '
  + 'hover:border-vb-orange-ink hover:text-vb-orange-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink '
  + 'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink/15 disabled:hover:text-ink';

/** Número chico (cupos, invitados) con botones − y + de 44 px. */
export function Contador({
  etiqueta, valor, min, max, onChange, ayuda,
}: { etiqueta: string; valor: number; min: number; max: number; onChange: (valor: number) => void; ayuda?: ReactNode }) {
  const id = useId();
  const acotar = (numero: number) => Math.min(max, Math.max(min, numero));
  return (
    <div role="group" aria-labelledby={`${id}-etiqueta`} aria-describedby={ayuda ? `${id}-ayuda` : undefined}>
      <span id={`${id}-etiqueta`} className="block text-sm font-semibold text-ink">{etiqueta}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <button
          type="button"
          className={BOTON}
          onClick={() => onChange(acotar(valor - 1))}
          disabled={valor <= min}
          aria-label={`Restar uno: ${etiqueta}`}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <output aria-live="polite" className="min-w-10 text-center font-display text-xl font-black text-ink">{valor}</output>
        <button
          type="button"
          className={BOTON}
          onClick={() => onChange(acotar(valor + 1))}
          disabled={valor >= max}
          aria-label={`Sumar uno: ${etiqueta}`}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
      {ayuda && <p id={`${id}-ayuda`} className="mt-1 text-xs text-ink/65">{ayuda}</p>}
    </div>
  );
}
