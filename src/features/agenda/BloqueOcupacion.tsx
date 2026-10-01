import type { ReactNode } from 'react';
import { Clock, Lock, Repeat2, Smartphone, Users } from 'lucide-react';
import clsx from 'clsx';
import type { Ocupacion } from '@/api/tipos';
import { formatRangoHorario } from '@/lib/date';
import { textoDeTramo, type Tramo } from './layout';
import {
  aparienciaDe, cuentaRegresiva, debe, descripcionOcupacion, informoPago, nombreDeOcupacion, subtituloDeOcupacion,
} from './presentacion';
import { ESTILO_BLOQUE, FONDO_BLOQUEO } from './estilos';

type Props = {
  ocupacion: Ocupacion;
  tramo: Tramo;
  top: number;
  height: number;
  carril: number;
  carriles: number;
  cancha: string;
  ahora: number;
  onSelect: (ocupacion: Ocupacion) => void;
};

export function Insignia({ tono, children }: { tono: 'rojo' | 'violeta' | 'ambar' | 'neutro'; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex max-w-full items-center gap-0.5 truncate rounded-full px-1.5 py-px text-[11px] font-bold leading-4 no-underline',
        tono === 'rojo' && 'bg-red-600 text-white',
        tono === 'violeta' && 'bg-violet-600 text-white',
        tono === 'ambar' && 'bg-amber-500 text-amber-950',
        tono === 'neutro' && 'bg-white/80 text-ink/75 ring-1 ring-ink/10',
      )}
    >
      {children}
    </span>
  );
}

/** Insignias de estado de una ocupación (pedido, deuda, transferencia, partido). */
function insigniasDe(ocupacion: Ocupacion, ahora: number): ReactNode[] {
  const insignias: ReactNode[] = [];
  if (ocupacion.estado === 'pendiente' && ocupacion.vence_at) {
    const cuenta = cuentaRegresiva(ocupacion.vence_at, ahora);
    insignias.push(
      <Insignia key="vence" tono={cuenta.urgente ? 'rojo' : 'ambar'}>
        <Clock size={11} aria-hidden="true" />{cuenta.corto}
      </Insignia>,
    );
  }
  if (debe(ocupacion, ahora)) insignias.push(<Insignia key="debe" tono="rojo">Debe</Insignia>);
  else if (informoPago(ocupacion)) insignias.push(<Insignia key="pago" tono="violeta">Transfirió</Insignia>);
  if (ocupacion.partido) {
    insignias.push(
      <Insignia key="partido" tono="neutro">
        <Users size={11} aria-hidden="true" />{ocupacion.partido.ocupados}/{ocupacion.partido.cupo_maximo}
      </Insignia>,
    );
  }
  if (ocupacion.asistencia === 'no_vinieron') insignias.push(<Insignia key="ausente" tono="neutro">No vinieron</Insignia>);
  return insignias;
}

/** Las insignias de una ocupación, para listas. */
export function InsigniasOcupacion({ ocupacion, ahora }: { ocupacion: Ocupacion; ahora: number }) {
  const insignias = insigniasDe(ocupacion, ahora);
  if (!insignias.length) return null;
  return <span className="flex flex-wrap gap-1">{insignias}</span>;
}

function IconoTipo({ ocupacion }: { ocupacion: Ocupacion }) {
  const apariencia = aparienciaDe(ocupacion);
  const props = { size: 12, 'aria-hidden': true, className: 'shrink-0' } as const;
  if (apariencia === 'bloqueo') return <Lock {...props} />;
  if (apariencia === 'fijo') return <Repeat2 {...props} />;
  if (apariencia === 'app') return <Smartphone {...props} />;
  if (apariencia === 'pendiente') return <Clock {...props} />;
  return null;
}

/** Bloque posicionado en la columna de una cancha. */
export function BloqueOcupacion({ ocupacion, tramo, top, height, carril, carriles, cancha, ahora, onSelect }: Props) {
  const apariencia = aparienciaDe(ocupacion);
  const subtitulo = subtituloDeOcupacion(ocupacion);
  const insignias = insigniasDe(ocupacion, ahora);
  const compacto = height < 40;
  const conInsignias = height >= 64;
  // Los bloqueos pueden durar días: se muestra la parte de este día.
  const horario = ocupacion.tipo === 'bloqueo' ? textoDeTramo(tramo) : formatRangoHorario(ocupacion.inicio, ocupacion.fin);
  const flechas = ocupacion.tipo === 'reserva';

  return (
    <button
      type="button"
      onClick={() => onSelect(ocupacion)}
      aria-label={descripcionOcupacion(ocupacion, cancha, ahora)}
      className={clsx(
        'absolute z-[2] flex flex-col overflow-hidden rounded-lg px-1.5 text-left text-xs leading-tight shadow-sm transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink focus-visible:ring-offset-1',
        compacto ? 'justify-center py-0.5' : 'py-1',
        tramo.desdeAntes && 'rounded-t-none',
        tramo.sigueDespues && 'rounded-b-none',
        ESTILO_BLOQUE[apariencia],
      )}
      style={{
        top: top + 1,
        height: Math.max(height - 2, 16),
        left: `calc(${(carril / carriles) * 100}% + 3px)`,
        width: `calc(${100 / carriles}% - 6px)`,
        ...(apariencia === 'bloqueo' ? FONDO_BLOQUEO : null),
      }}
    >
      {apariencia === 'pendiente' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-dashed border-amber-500 motion-safe:animate-pulse"
        />
      )}
      <span className="flex min-w-0 items-center gap-1 font-bold">
        <IconoTipo ocupacion={ocupacion} />
        <span className="truncate">{nombreDeOcupacion(ocupacion)}</span>
        {compacto && insignias[0]}
      </span>
      {!compacto && (
        <span className="flex min-w-0 items-center gap-1 opacity-85">
          <span className="shrink-0 tabular-nums">
            {flechas && tramo.desdeAntes ? '↑ ' : ''}{horario}{flechas && tramo.sigueDespues ? ' ↓' : ''}
          </span>
          {subtitulo && <span className="truncate">· {subtitulo}</span>}
          {!conInsignias && insignias[0]}
        </span>
      )}
      {conInsignias && insignias.length > 0 && (
        <span className="mt-auto flex min-w-0 flex-wrap gap-1 pt-0.5">{insignias}</span>
      )}
    </button>
  );
}
