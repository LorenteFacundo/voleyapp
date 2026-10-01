import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { formatDate, formatTime, formatMoney } from '@/lib/format';
import { turnoKey } from '@/lib/booking';
import type { TurnoVirtual } from '@/types';

type ScheduleBoardProps = {
  turnos: TurnoVirtual[];
  selectedTurnoKey: string | null;
  onSelect: (turno: TurnoVirtual) => void;
};

const estadoStyles: Record<string, string> = {
  disponible: 'border-court/30 bg-court/10 text-court hover:border-court hover:bg-court/15',
  pre_reservado: 'border-sand/50 bg-sand/15 text-ink/80',
  reservado: 'border-ink/15 bg-ink/5 text-ink/50',
  bloqueado_club: 'border-red-200 bg-red-50 text-red-700/80',
};

const estadoLabels: Record<string, string> = {
  disponible: 'Disponible',
  pre_reservado: 'Pre-reservado',
  reservado: 'Ocupado',
  bloqueado_club: 'Bloqueado',
};

export function ScheduleBoard({ turnos, selectedTurnoKey, onSelect }: ScheduleBoardProps) {
  const byFecha = turnos.reduce<Map<string, TurnoVirtual[]>>((acc, turno) => {
    const list = acc.get(turno.fecha) ?? [];
    list.push(turno);
    acc.set(turno.fecha, list);
    return acc;
  }, new Map());

  const fechas = [...byFecha.entries()].sort(([a], [b]) => a.localeCompare(b));
  const fechasConDisponibles = fechas.filter(([, slots]) =>
    slots.some((s) => s.estado === 'disponible')
  );

  const [selectedFecha, setSelectedFecha] = useState<string | null>(null);
  const selectedSlotFecha = selectedTurnoKey
    ? turnos.find((turno) => turnoKey(turno) === selectedTurnoKey)?.fecha ?? null
    : null;
  const firstAvailableDate = fechasConDisponibles[0]?.[0] ?? fechas[0]?.[0] ?? null;
  const dateKeys = fechas.map(([fecha]) => fecha).join('|');

  useEffect(() => {
    setSelectedFecha((current) => {
      if (selectedSlotFecha) return selectedSlotFecha;
      if (current && dateKeys.split('|').includes(current)) return current;
      return firstAvailableDate;
    });
  }, [dateKeys, firstAvailableDate, selectedSlotFecha]);

  if (fechas.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-ink/15 p-6 text-center text-sm text-ink/60">
        No hay horarios cargados para esta cancha.
      </div>
    );
  }

  const slots = selectedFecha ? byFecha.get(selectedFecha) ?? [] : [];

  return (
    <div className="grid gap-4">
      {/* Date selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {fechas.map(([fecha, dateSlots]) => {
          const hasDisponibles = dateSlots.some((s) => s.estado === 'disponible');
          const isSelected = selectedFecha === fecha;
          const date = new Date(`${fecha}T12:00:00`);
          const dayName = date.toLocaleDateString('es-AR', { weekday: 'short' });
          const dayNum = date.getDate();
          const month = date.toLocaleDateString('es-AR', { month: 'short' });

          return (
            <button
              key={fecha}
              onClick={() => setSelectedFecha(fecha)}
              className={clsx(
                'flex flex-col items-center shrink-0 rounded-lg border px-3 py-2 text-center transition min-w-[60px]',
                isSelected
                  ? 'border-court bg-court/10 text-court'
                  : hasDisponibles
                    ? 'border-ink/15 text-ink/70 hover:border-court/50'
                    : 'border-ink/10 text-ink/30 cursor-default'
              )}
              disabled={!hasDisponibles}
              type="button"
            >
              <span className="text-[10px] uppercase font-bold">{dayName}</span>
              <span className="text-lg font-bold leading-tight">{dayNum}</span>
              <span className="text-[10px]">{month}</span>
            </button>
          );
        })}
      </div>

      {/* Time slots for selected date */}
      {selectedFecha && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-ink">{formatDate(selectedFecha)}</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {slots.map((turno) => {
              const selectable = turno.estado === 'disponible';
              const key = turnoKey(turno);
              const selected = selectedTurnoKey === key;

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
                  key={key}
                  onClick={() => selectable && onSelect(turno)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {formatTime(turno.hora_inicio)} – {formatTime(turno.hora_fin)}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {estadoLabels[turno.estado]}
                    </span>
                  </div>
                  {selectable && turno.precio_total > 0 && (
                    <div className="mt-1 text-xs text-ink/60">
                      {formatMoney(turno.precio_total)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
