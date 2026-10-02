import { useId } from 'react';
import clsx from 'clsx';

type Opcion<T extends string | number> = { valor: T; etiqueta: string };

type Props<T extends string | number> = {
  legend: string;
  opciones: readonly Opcion<T>[];
  valor: T;
  onChange: (valor: T) => void;
  /** Oculta la leyenda a la vista (sigue disponible para lectores de pantalla). */
  legendOculta?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Grupo de opciones excluyentes con aspecto de botones (radios nativos, navegables con flechas). */
export function SelectorOpciones<T extends string | number>({
  legend, opciones, valor, onChange, legendOculta = false, disabled = false, className,
}: Props<T>) {
  const nombre = useId();
  return (
    <fieldset className={className} disabled={disabled}>
      <legend className={clsx('mb-1 text-sm font-semibold text-ink', legendOculta && 'sr-only')}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((opcion) => (
          <label key={String(opcion.valor)} className="relative">
            <input
              type="radio"
              name={nombre}
              className="peer sr-only"
              checked={opcion.valor === valor}
              onChange={() => onChange(opcion.valor)}
            />
            <span
              className={clsx(
                'flex min-h-11 cursor-pointer select-none items-center rounded-xl border border-ink/15 bg-white px-3.5 text-sm font-semibold text-ink/70 transition',
                'hover:border-vb-blue/50 peer-checked:border-vb-blue peer-checked:bg-vb-blue peer-checked:text-white',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-vb-orange-ink peer-focus-visible:ring-offset-2',
                'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
              )}
            >
              {opcion.etiqueta}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
