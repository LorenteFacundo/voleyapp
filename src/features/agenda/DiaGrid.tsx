import { useEffect, useRef, type MouseEvent } from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import type { Ocupacion } from '@/api/tipos';
import { minutosAHora } from '@/lib/date';
import { Spinner } from '@/components/ui/Button';
import { BloqueOcupacion } from './BloqueOcupacion';
import {
  ALTO_FILA, MINUTOS_POR_FILA, PX_POR_MINUTO, altoDelRango, asignarCarriles, filasDelRango, posicion,
  type BloqueLibre, type ColumnaGrilla, type Grilla, type Intervalo, type Tramo,
} from './layout';
import { montoCorto } from './presentacion';

const ANCHO_HORAS = '3rem';
const COLUMNA = 'min-w-[6.25rem] flex-1';

type Props = {
  grilla: Grilla<Ocupacion>;
  /** Libres que todavía se pueden ofrecer (sin los que ya pasaron). */
  libres: BloqueLibre[];
  minutoAhora: number | null;
  ahora: number;
  /** Mientras llegan los datos del día se muestra la grilla vacía con un aviso. */
  cargando: boolean;
  minutoScroll: number;
  etiqueta: string;
  onOcupacion: (ocupacion: Ocupacion) => void;
  onLibre: (libre: BloqueLibre) => void;
  onCelda: (canchaId: number, minuto: number | null) => void;
};

/**
 * Grilla del día: una columna por cancha y una fila cada 30 minutos. Las
 * ocupaciones y los bloques libres se ubican en posición absoluta. El
 * encabezado de canchas y la columna de horas quedan fijos al desplazarse.
 */
export function DiaGrid({
  grilla, libres, minutoAhora, ahora, cargando, minutoScroll, etiqueta, onOcupacion, onLibre, onCelda,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const fechaDesplazada = useRef<string | null>(null);
  const { dia, rango, columnas, tramos } = grilla;
  const filas = filasDelRango(rango);
  const topAhora = minutoAhora !== null && minutoAhora >= rango.inicio && minutoAhora <= rango.fin
    ? (minutoAhora - rango.inicio) * PX_POR_MINUTO
    : null;

  // Al abrir un día, una sola vez: llevar la vista a la hora actual o a lo primero que haya.
  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento || cargando || fechaDesplazada.current === dia.fecha) return;
    fechaDesplazada.current = dia.fecha;
    elemento.scrollTop = Math.max(0, (minutoScroll - rango.inicio) * PX_POR_MINUTO);
  }, [cargando, dia.fecha, minutoScroll, rango.inicio]);

  return (
    <div className="relative -mx-4 sm:mx-0">
      <div
        ref={contenedor}
        role="region"
        aria-label={etiqueta}
        aria-busy={cargando || undefined}
        className={clsx(
          'max-h-[calc(100dvh-8.5rem)] overflow-auto border-y border-ink/10 bg-white',
          'sm:rounded-2xl sm:border lg:max-h-[calc(100dvh-6.5rem)]',
        )}
      >
        <div style={{ minWidth: `calc(${ANCHO_HORAS} + ${columnas.length} * 6.25rem)` }}>
          <div className="sticky top-0 z-20 flex border-b border-ink/10 bg-white">
            <div className="sticky left-0 z-10 shrink-0 bg-white" style={{ width: ANCHO_HORAS }} />
            {columnas.map(({ cancha, inactiva }) => (
              <div key={cancha.id} className={clsx(COLUMNA, 'min-w-0 border-l border-ink/10 px-1.5 py-2 text-center')}>
                <span className="block truncate text-sm font-bold text-vb-blue">{cancha.titulo}</span>
                {inactiva && <span className="block text-[11px] font-semibold text-ink/65">Inactiva</span>}
              </div>
            ))}
          </div>

          <div className="relative flex" style={{ height: altoDelRango(rango) }}>
            <div aria-hidden="true" className="sticky left-0 z-10 shrink-0 bg-white" style={{ width: ANCHO_HORAS }}>
              {filas.map((minuto) => (
                <span
                  key={minuto}
                  className={clsx(
                    'absolute right-1.5 tabular-nums leading-none',
                    minuto % 60 === 0 ? 'text-[11px] font-semibold text-ink/65' : 'text-[10px] text-ink/65',
                  )}
                  style={{ top: (minuto - rango.inicio) * PX_POR_MINUTO + 3 }}
                >
                  {minutosAHora(minuto)}
                </span>
              ))}
              {topAhora !== null && minutoAhora !== null && (
                <span
                  className="absolute right-0.5 z-10 -translate-y-1/2 rounded-full bg-red-600 px-1 py-px text-[10px] font-bold tabular-nums text-white"
                  style={{ top: topAhora }}
                >
                  {minutosAHora(Math.floor(minutoAhora))}
                </span>
              )}
            </div>

            {columnas.map((columna) => (
              <ColumnaCancha
                key={columna.cancha.id}
                columna={columna}
                rango={rango}
                filas={filas}
                tramos={cargando ? [] : tramos.filter((item) => item.ocupacion.cancha_id === columna.cancha.id)}
                libres={cargando ? [] : libres.filter((libre) => libre.canchaId === columna.cancha.id)}
                ahora={ahora}
                onOcupacion={onOcupacion}
                onLibre={onLibre}
                onCelda={onCelda}
              />
            ))}

            {topAhora !== null && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 z-[3] h-0.5 bg-red-500"
                style={{ top: topAhora, left: ANCHO_HORAS }}
              />
            )}
          </div>
        </div>
      </div>
      {cargando && (
        <div className="absolute inset-0 grid place-items-center bg-white/50">
          <div role="status" className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-ink/65 shadow-card">
            <Spinner className="h-5 w-5 text-vb-orange-ink" /> Cargando el día…
          </div>
        </div>
      )}
    </div>
  );
}

type PropsColumna = {
  columna: ColumnaGrilla;
  rango: Intervalo;
  filas: number[];
  tramos: { ocupacion: Ocupacion; tramo: Tramo }[];
  libres: BloqueLibre[];
  ahora: number;
  onOcupacion: (ocupacion: Ocupacion) => void;
  onLibre: (libre: BloqueLibre) => void;
  onCelda: (canchaId: number, minuto: number | null) => void;
};

function ColumnaCancha({ columna, rango, filas, tramos, libres, ahora, onOcupacion, onLibre, onCelda }: PropsColumna) {
  const { cancha, inactiva } = columna;
  const ubicados = asignarCarriles(tramos.map((item) => ({ inicio: item.tramo.inicio, fin: item.tramo.fin, item })));
  // Orden de lectura por horario, mezclando libres y ocupaciones.
  const elementos = [
    ...libres.map((libre) => ({ inicio: libre.inicio, libre, ubicado: null })),
    ...ubicados.map((ubicado) => ({ inicio: ubicado.inicio, libre: null, ubicado })),
  ].sort((a, b) => a.inicio - b.inicio);

  const alTocarFondo = (evento: MouseEvent<HTMLButtonElement>) => {
    const celda = (evento.target as HTMLElement).closest<HTMLElement>('[data-minuto]');
    onCelda(cancha.id, celda ? Number(celda.dataset.minuto) : null);
  };

  return (
    <div className={clsx(COLUMNA, 'relative border-l border-ink/10')}>
      <button
        type="button"
        disabled={inactiva}
        onClick={alTocarFondo}
        aria-label={inactiva ? `${cancha.titulo}: cancha inactiva` : `Nueva reserva en ${cancha.titulo}`}
        className={clsx(
          'absolute inset-0 block w-full text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vb-orange-ink',
          inactiva ? 'cursor-not-allowed bg-ink/[0.03]' : 'cursor-pointer',
        )}
      >
        {filas.map((minuto) => (
          <span
            key={minuto}
            data-minuto={minuto}
            aria-hidden="true"
            className={clsx(
              'block border-b transition-colors',
              !inactiva && 'hover:bg-vb-orange/[0.06] active:bg-vb-orange/10',
              (minuto + MINUTOS_POR_FILA) % 60 === 0 ? 'border-ink/10' : 'border-dashed border-ink/[0.07]',
            )}
            style={{ height: ALTO_FILA }}
          />
        ))}
      </button>

      {elementos.map((elemento) => {
        if (elemento.libre) {
          return <BotonLibre key={`l-${elemento.libre.horarioId}-${elemento.libre.inicio}`} libre={elemento.libre} cancha={cancha.titulo} rango={rango} onLibre={onLibre} />;
        }
        const { item, carril, carriles } = elemento.ubicado!;
        const { top, height } = posicion(item.tramo, rango);
        return (
          <BloqueOcupacion
            key={item.ocupacion.id}
            ocupacion={item.ocupacion}
            tramo={item.tramo}
            top={top}
            height={height}
            carril={carril}
            carriles={carriles}
            cancha={cancha.titulo}
            ahora={ahora}
            onSelect={onOcupacion}
          />
        );
      })}
    </div>
  );
}

function BotonLibre({ libre, cancha, rango, onLibre }: {
  libre: BloqueLibre; cancha: string; rango: Intervalo; onLibre: (libre: BloqueLibre) => void;
}) {
  const { top, height } = posicion(libre, rango);
  const conPrecio = libre.completo && libre.precio > 0;
  const desde = minutosAHora(libre.completo ? libre.bloque.inicio : libre.inicio);
  const hasta = minutosAHora(libre.completo ? libre.bloque.fin : libre.fin);
  return (
    <button
      type="button"
      onClick={() => onLibre(libre)}
      aria-label={`Libre de ${desde} a ${hasta} en ${cancha}${conPrecio ? `, ${montoCorto(libre.precio)}` : ''}. Cargar una reserva`}
      className={clsx(
        'absolute inset-x-[3px] z-[1] flex flex-col items-start overflow-hidden rounded-lg border border-dashed px-1.5 py-1',
        'border-green-600/35 bg-green-50/40 text-left text-xs leading-tight text-green-800 transition',
        'hover:border-green-600 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600',
      )}
      style={{ top: top + 1, height: Math.max(height - 2, 16) }}
    >
      <span className="flex items-center gap-0.5 font-semibold"><Plus size={12} aria-hidden="true" />Libre</span>
      {height >= 40 && (
        <span className="max-w-full truncate text-green-900/70">{conPrecio ? montoCorto(libre.precio) : `${desde}–${hasta}`}</span>
      )}
    </button>
  );
}
