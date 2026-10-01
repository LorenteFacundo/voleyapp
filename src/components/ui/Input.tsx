import React, { useId } from 'react';
import clsx from 'clsx';

// Campos de formulario con etiqueta asociada, ayuda y error accesibles.
// Usan 16 px de texto para que iOS no haga zoom al enfocar.

const controlBase =
  'w-full rounded-xl border bg-white px-3 py-2.5 text-base text-ink placeholder:text-ink/40 transition '
  + 'focus:outline-none focus:ring-2 focus:ring-vb-orange-ink disabled:bg-ink/5 disabled:text-ink/50';

type CampoProps = {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  /** Oculta visualmente la etiqueta (sigue disponible para lectores de pantalla). */
  labelOculto?: boolean;
};

function Campo({ id, label, hint, error, className, labelOculto, children }: CampoProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={clsx('flex flex-col', className)}>
      {label && (
        <label htmlFor={id} className={clsx('mb-1 text-sm font-semibold text-ink', labelOculto && 'sr-only')}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">{error}</span>
      ) : hint ? (
        <span id={`${id}-hint`} className="mt-1 text-xs text-ink/65">{hint}</span>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type InputProps = CampoProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  inputClassName?: string;
  /** Ícono decorativo a la izquierda (por ejemplo, una lupa). */
  icono?: React.ReactNode;
  /** Control a la derecha dentro del campo (por ejemplo, mostrar la contraseña). */
  accion?: React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, labelOculto, id, inputClassName, icono, accion, ...props }, ref) => {
    const generado = useId();
    const inputId = id ?? generado;
    const control = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        className={clsx(controlBase, error ? 'border-red-400' : 'border-ink/15', icono && 'pl-10', accion && 'pr-12', inputClassName)}
        {...props}
      />
    );
    return (
      <Campo id={inputId} label={label} hint={hint} error={error} className={className} labelOculto={labelOculto}>
        {icono || accion ? (
          <div className="relative">
            {icono && (
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink/65" aria-hidden="true">
                {icono}
              </span>
            )}
            {control}
            {accion && <span className="absolute inset-y-0 right-1 flex items-center">{accion}</span>}
          </div>
        ) : control}
      </Campo>
    );
  },
);
Input.displayName = 'Input';

type SelectProps = CampoProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className, labelOculto, id, children, ...props }, ref) => {
    const generado = useId();
    const selectId = id ?? generado;
    return (
      <Campo id={selectId} label={label} hint={hint} error={error} className={className} labelOculto={labelOculto}>
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(selectId, hint, error)}
          className={clsx(controlBase, error ? 'border-red-400' : 'border-ink/15')}
          {...props}
        >
          {children}
        </select>
      </Campo>
    );
  },
);
Select.displayName = 'Select';

type TextareaProps = CampoProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, labelOculto, id, rows = 3, ...props }, ref) => {
    const generado = useId();
    const areaId = id ?? generado;
    return (
      <Campo id={areaId} label={label} hint={hint} error={error} className={className} labelOculto={labelOculto}>
        <textarea
          ref={ref}
          id={areaId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(areaId, hint, error)}
          className={clsx(controlBase, 'resize-y', error ? 'border-red-400' : 'border-ink/15')}
          {...props}
        />
      </Campo>
    );
  },
);
Textarea.displayName = 'Textarea';

type SwitchProps = {
  checked: boolean;
  onChange: (valor: boolean) => void;
  label: React.ReactNode;
  descripcion?: React.ReactNode;
  disabled?: boolean;
};

export function Switch({ checked, onChange, label, descripcion, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
        {descripcion && <p id={`${id}-desc`} className="mt-0.5 text-xs text-ink/65">{descripcion}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descripcion ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink focus-visible:ring-offset-2',
          checked ? 'bg-green-600' : 'bg-ink/20',
          disabled && 'opacity-50',
        )}
      >
        <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}
