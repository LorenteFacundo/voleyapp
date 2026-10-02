import type { ReactNode } from 'react';
import clsx from 'clsx';

/** Botón de filtro que se prende y apaga (aria-pressed). */
export function ChipFiltro({
  activo, onClick, children, disabled, className,
}: { activo: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink focus-visible:ring-offset-1',
        activo ? 'border-vb-blue bg-vb-blue text-white' : 'border-ink/15 bg-white text-ink/70 hover:border-vb-orange-ink hover:text-vb-orange-ink',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}
