import clsx from 'clsx';
import { formatDate, formatTime } from '../lib/format';
import type { Turno } from '../types';
import { TURNO_ESTADO_LABEL } from '../types';

type ScheduleBoardProps = {
  turnos: Turno[];
  selectedTurnoId: number | null;
  onSelect: (turno: Turno) => void;
};

const estadoStyles: Record<Turno['estado'], string> = {
  disponible: 'border-court/30 bg-court/10 text-court hover:border-court hover:bg-court/15',
  pre_reservado: 'border-sand/50 bg-sand/15 text-ink/80',
  reservado: 'border-ink/15 bg-ink/5 text-ink/50',
  bloqueado_club: 'border-red-200 bg-red-50 text-red-700/80',
};

export function ScheduleBoard({ turnos, selectedTurnoId, onSelect }: ScheduleBoardProps) {
  const byFecha = turnos.reduce<Map<string, Turno[]>>((acc, turno) => {
    const list = acc.get(turno.fecha) ?? [];
    list.push(turno);
    acc.set(turno.fecha, list);
    return acc;
  }, new Map());

  const fechas = [...byFecha.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (fechas.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-ink/15 p-6 text-center text-sm text-ink/60">
        No hay horarios cargados para esta cancha.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {fechas.map(([fecha, slots]) => (
        <section key={fecha}>
          <h4 className="mb-2 text-sm font-bold text-ink">{formatDate(fecha)}</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {slots.map((turno) => {
              const selectable = turno.estado === 'disponible';
              const selected = selectedTurnoId === turno.id;

              return (
                <button
                  className={clsx(
                    'rounded-md border px-3 py-2.5 text-left text-sm transition',
                    estadoStyles[turno.estado],
                    selected && 'ring-2 ring-court ring-offset-1',
                    !selectable && 'cursor-default',
                    selectable && 'cursor-pointer',
                  )}
                  disabled={!selectable}
                  key={turno.id}
                  onClick={() => selectable && onSelect(turno)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {formatTime(turno.hora_inicio)} – {formatTime(turno.hora_fin)}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {TURNO_ESTADO_LABEL[turno.estado]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap gap-3 text-xs text-ink/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-court" />
          Disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-sand" />
          Pre-reservado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ink/30" />
          Ocupado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-300" />
          Bloqueado
        </span>
      </div>
    </div>
  );
}
