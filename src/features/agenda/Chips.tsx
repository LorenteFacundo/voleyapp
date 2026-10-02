import { useId, type ReactNode } from 'react';
import clsx from 'clsx';

type Opcion<T extends string | number> = { value: T; label: ReactNode; disabled?: boolean };

const chipBase = 'relative inline-flex min-h-11 cursor-pointer select-none items-center justify-center gap-1.5 rounded-xl border px-3 '
  + 'text-sm font-semibold transition focus-within:ring-2 focus-within:ring-vb-orange-ink focus-within:ring-offset-1';

function estiloChip(activo: boolean, deshabilitado?: boolean) {
  return clsx(
    chipBase,
    activo ? 'border-vb-blue bg-vb-blue text-white' : 'border-ink/15 bg-white text-ink/75 hover:border-vb-orange-ink hover:text-ink',
    deshabilitado && 'cursor-not-allowed opacity-50',
  );
}

/** Opciones excluyentes como botones grandes (radios nativos, accesibles con teclado). */
export function GrupoChips<T extends string | number>({
  legend, opciones, value, onChange, legendOculta, className, error,
}: {
  legend: ReactNode;
  opciones: Opcion<T>[];
  value: T | null;
  onChange: (valor: T) => void;
  legendOculta?: boolean;
  className?: string;
  error?: string | null;
}) {
  const nombre = useId();
  return (
    <fieldset className={clsx('min-w-0', className)} aria-describedby={error ? `${nombre}-error` : undefined}>
      <legend className={clsx('mb-1 text-sm font-semibold text-ink', legendOculta && 'sr-only')}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((opcion) => (
          <label key={String(opcion.value)} className={estiloChip(opcion.value === value, opcion.disabled)}>
            <input
              type="radio"
              className="sr-only"
              name={nombre}
              value={String(opcion.value)}
              checked={opcion.value === value}
              disabled={opcion.disabled}
              onChange={() => onChange(opcion.value)}
            />
            {opcion.label}
          </label>
        ))}
      </div>
      {error && <span id={`${nombre}-error`} role="alert" className="mt-1 block text-sm text-red-700">{error}</span>}
    </fieldset>
  );
}

/** Varias opciones a la vez (casillas nativas con aspecto de chip). */
export function GrupoCasillas<T extends string | number>({
  legend, opciones, valores, onChange, className, error, extra,
}: {
  legend: ReactNode;
  opciones: Opcion<T>[];
  valores: ReadonlySet<T>;
  onChange: (valores: Set<T>) => void;
  className?: string;
  error?: string | null;
  /** Contenido adicional al lado de la leyenda (por ejemplo, "Todas"). */
  extra?: ReactNode;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={`${id}-leyenda`}
      aria-describedby={error ? `${id}-error` : undefined}
      className={clsx('min-w-0', className)}
    >
      <div className="mb-1 flex min-h-9 items-center justify-between gap-2">
        <span id={`${id}-leyenda`} className="text-sm font-semibold text-ink">{legend}</span>
        {extra}
      </div>
      <div className="flex flex-wrap gap-2">
        {opciones.map((opcion) => {
          const activo = valores.has(opcion.value);
          return (
            <label key={String(opcion.value)} className={estiloChip(activo, opcion.disabled)}>
              <input
                type="checkbox"
                className="sr-only"
                checked={activo}
                disabled={opcion.disabled}
                onChange={() => {
                  const siguiente = new Set(valores);
                  if (activo) siguiente.delete(opcion.value);
                  else siguiente.add(opcion.value);
                  onChange(siguiente);
                }}
              />
              {opcion.label}
            </label>
          );
        })}
      </div>
      {error && <span id={`${id}-error`} role="alert" className="mt-1 block text-sm text-red-700">{error}</span>}
    </div>
  );
}
