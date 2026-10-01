import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { DIAS_SEMANA_CORTOS, diaSemana, formatDiaMes } from '@/lib/date';
import { fechaLarga } from '../fechas';

/**
 * Tira de días con scroll horizontal. Muestra cuántos horarios libres hay en
 * los días ya consultados.
 */
export function SelectorFecha({
  dias, elegida, libres, onElegir,
}: { dias: string[]; elegida: string; libres: Record<string, number>; onElegir: (fecha: string) => void }) {
  const contenedor = useRef<HTMLDivElement>(null);

  // Centra el día elegido sin mover la página (solo el scroll de la tira).
  useEffect(() => {
    const tira = contenedor.current;
    const boton = tira?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!tira || !boton) return;
    const izquierda = boton.offsetLeft - tira.offsetLeft - (tira.clientWidth - boton.clientWidth) / 2;
    tira.scrollTo({ left: Math.max(0, izquierda), behavior: 'smooth' });
  }, [elegida]);

  return (
    <div
      ref={contenedor}
      role="group"
      aria-label="Elegí el día"
      className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
    >
      {dias.map((dia, indice) => {
        const activo = dia === elegida;
        const cantidad = libres[dia];
        const nombre = indice === 0 ? 'Hoy' : indice === 1 ? 'Mañana' : DIAS_SEMANA_CORTOS[diaSemana(dia)];
        return (
          <button
            key={dia}
            type="button"
            aria-pressed={activo}
            onClick={() => onElegir(dia)}
            className={clsx(
              'flex min-h-[76px] w-[4.5rem] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 text-center transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink focus-visible:ring-offset-1',
              activo ? 'border-vb-blue bg-vb-blue text-white shadow-card' : 'border-ink/10 bg-white text-ink hover:border-vb-orange-ink',
            )}
          >
            <span className={clsx('text-[11px] font-bold uppercase', activo ? 'text-white/80' : 'text-ink/65')}>{nombre}</span>
            <span className="font-display text-xl font-black leading-none">{Number(dia.slice(8, 10))}</span>
            <span className="sr-only">{fechaLarga(dia)}</span>
            <span
              className={clsx(
                'text-[11px] font-semibold',
                activo ? 'text-white/80' : cantidad === 0 ? 'text-ink/65' : cantidad ? 'text-green-700' : 'text-ink/65',
              )}
            >
              {cantidad == null ? formatDiaMes(dia).split(' ')[1] : cantidad === 0 ? 'Sin lugar' : `${cantidad} libre${cantidad === 1 ? '' : 's'}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
