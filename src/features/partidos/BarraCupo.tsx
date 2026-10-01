import { Users } from 'lucide-react';
import clsx from 'clsx';
import { progresoCupo, textoCupo } from './cupo';

/** Barra de lugares ocupados con una marca en el mínimo para jugar. */
export function BarraCupo({ ocupados, minimo, maximo, className }: { ocupados: number; minimo: number; maximo: number; className?: string }) {
  const progreso = progresoCupo(ocupados, minimo, maximo);
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 font-semibold text-ink/70">
          <Users size={14} aria-hidden="true" />
          {ocupados}/{maximo} <span className="font-normal text-ink/65">· mín. {minimo}</span>
        </span>
        <span
          className={clsx(
            'font-bold',
            progreso.completo ? 'text-ink/65' : progreso.seJuega ? 'text-green-700' : 'text-amber-800',
          )}
        >
          {textoCupo(progreso)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Lugares ocupados"
        aria-valuemin={0}
        aria-valuemax={maximo}
        aria-valuenow={Math.min(ocupados, maximo)}
        aria-valuetext={`${ocupados} de ${maximo} lugares ocupados. Mínimo para jugar: ${minimo}.`}
        className="relative h-2.5 rounded-full bg-ink/10"
      >
        <div
          className={clsx('h-full rounded-full transition-[width] duration-500', progreso.seJuega ? 'bg-green-600' : 'bg-vb-orange-ink')}
          style={{ width: `${progreso.porcentaje}%` }}
        />
        {minimo < maximo && (
          <span
            aria-hidden="true"
            className="absolute -inset-y-1 w-0.5 rounded-full bg-vb-blue/70"
            style={{ left: `calc(${progreso.porcentajeMinimo}% - 1px)` }}
          />
        )}
      </div>
    </div>
  );
}
