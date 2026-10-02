import { useMemo } from 'react';
import clsx from 'clsx';
import type { CanchaGestion, HorarioPublicado, Ocupacion } from '@/api/tipos';
import { DIAS_SEMANA_CORTOS, diaSemana, formatDiaMes, formatRangoHorario } from '@/lib/date';
import { pluralizar } from '@/lib/format';
import { Cargando } from '@/components/ui/Estados';
import { InsigniasOcupacion } from './BloqueOcupacion';
import { COLOR_BARRA } from './estilos';
import {
  armarGrilla, horarioEnDia, libresVigentes, minutoEnDia, ocupacionesPorDia,
} from './layout';
import {
  ETIQUETA_ESTADO, aparienciaDe, descripcionOcupacion, esActiva, nombreDeOcupacion, subtituloDeOcupacion,
} from './presentacion';

type Props = {
  dias: string[];
  ocupaciones: Ocupacion[];
  canchas: CanchaGestion[];
  horarios: HorarioPublicado[];
  hoy: string;
  ahora: number;
  cargando: boolean;
  onOcupacion: (ocupacion: Ocupacion) => void;
  onDia: (fecha: string) => void;
};

/** Semana como lista compacta por día (en escritorio, siete columnas). */
export function SemanaLista({ dias, ocupaciones, canchas, horarios, hoy, ahora, cargando, onOcupacion, onDia }: Props) {
  const titulos = useMemo(() => new Map(canchas.map((cancha) => [cancha.id, cancha.titulo])), [canchas]);
  const porDia = useMemo(() => ocupacionesPorDia(ocupaciones, dias), [ocupaciones, dias]);
  const grillas = useMemo(() => {
    const activas = ocupaciones.filter(esActiva);
    return new Map(dias.map((fecha) => [fecha, armarGrilla({ fecha, canchas, horarios, ocupaciones: activas })]));
  }, [dias, ocupaciones, canchas, horarios]);

  if (cargando) return <Cargando texto="Cargando la semana…" />;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {dias.map((fecha) => {
        const lista = porDia.get(fecha) ?? [];
        const grilla = grillas.get(fecha);
        const libres = grilla ? libresVigentes(grilla.libres, fecha, hoy, minutoEnDia(ahora, grilla.dia)).length : 0;
        const reservas = lista.filter((ocupacion) => ocupacion.tipo === 'reserva' && esActiva(ocupacion)).length;
        const esHoy = fecha === hoy;
        return (
          <section
            key={fecha}
            aria-label={`${DIAS_SEMANA_CORTOS[diaSemana(fecha)]} ${formatDiaMes(fecha)}`}
            className={clsx('min-w-0 rounded-2xl border bg-white', esHoy ? 'border-vb-orange/50' : 'border-ink/10')}
          >
            <h3 className="border-b border-ink/10">
              <button
                type="button"
                onClick={() => onDia(fecha)}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-t-2xl px-3 py-2 text-left hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vb-orange-ink"
              >
                <span className={clsx('font-display text-sm font-black', esHoy ? 'text-vb-orange-ink' : 'text-vb-blue')}>
                  {DIAS_SEMANA_CORTOS[diaSemana(fecha)]} {formatDiaMes(fecha)}{esHoy ? ' · Hoy' : ''}
                </span>
                <span className="text-xs font-semibold text-ink/65">
                  {pluralizar(reservas, 'reserva')}{libres ? ` · ${pluralizar(libres, 'libre')}` : ''}
                </span>
              </button>
            </h3>
            {lista.length === 0 ? (
              <p className="px-3 py-4 text-sm text-ink/65">Sin reservas.</p>
            ) : (
              <ul className="divide-y divide-ink/5 p-1">
                {lista.map((ocupacion) => (
                  <li key={ocupacion.id}>
                    <FilaOcupacion
                      ocupacion={ocupacion}
                      horario={ocupacion.tipo === 'bloqueo' && grilla
                        ? horarioEnDia(ocupacion.inicio, ocupacion.fin, grilla.dia)
                        : formatRangoHorario(ocupacion.inicio, ocupacion.fin)}
                      cancha={titulos.get(ocupacion.cancha_id) ?? 'Cancha'}
                      ahora={ahora}
                      onSelect={onOcupacion}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FilaOcupacion({ ocupacion, horario, cancha, ahora, onSelect }: {
  ocupacion: Ocupacion; horario: string; cancha: string; ahora: number; onSelect: (ocupacion: Ocupacion) => void;
}) {
  const apariencia = aparienciaDe(ocupacion);
  const cancelada = apariencia === 'cancelada';
  const subtitulo = subtituloDeOcupacion(ocupacion);
  return (
    <button
      type="button"
      onClick={() => onSelect(ocupacion)}
      aria-label={descripcionOcupacion(ocupacion, cancha, ahora)}
      className={clsx(
        'flex w-full items-stretch gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-ink/[0.04]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
        cancelada && 'opacity-60',
      )}
    >
      <span aria-hidden="true" className={clsx('w-1 shrink-0 rounded-full', COLOR_BARRA[apariencia])} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className={clsx('text-sm font-bold tabular-nums text-ink', cancelada && 'line-through')}>{horario}</span>
          <span className="truncate text-xs text-ink/65">{cancha}</span>
        </span>
        <span className={clsx('block truncate text-sm text-ink/80', cancelada && 'line-through')}>
          {ocupacion.tipo === 'bloqueo' ? `Bloqueo: ${nombreDeOcupacion(ocupacion)}` : nombreDeOcupacion(ocupacion)}
          {subtitulo ? ` · ${subtitulo}` : ''}
        </span>
        {cancelada ? (
          <span className="mt-0.5 block text-xs font-semibold text-ink/65">{ETIQUETA_ESTADO[ocupacion.estado]}</span>
        ) : (
          <span className="mt-0.5 block empty:hidden"><InsigniasOcupacion ocupacion={ocupacion} ahora={ahora} /></span>
        )}
      </span>
    </button>
  );
}
