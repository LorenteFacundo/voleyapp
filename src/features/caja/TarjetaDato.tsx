import type { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: 'normal' | 'positivo' | 'negativo';
  children?: ReactNode;
  className?: string;
};

/** Indicador con su número grande. Va dentro de un <dl>. */
export function TarjetaDato({ etiqueta, valor, detalle, tono = 'normal', children, className }: Props) {
  return (
    <div className={clsx('rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card', className)}>
      <dt className="text-sm font-medium text-ink/65">{etiqueta}</dt>
      <dd
        className={clsx(
          'mt-1 text-xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-2xl',
          tono === 'negativo' ? 'text-red-700' : tono === 'positivo' ? 'text-green-700' : 'text-ink',
        )}
      >
        {valor}
      </dd>
      {detalle && <dd className="mt-1 text-xs text-ink/65">{detalle}</dd>}
      {children && <dd className="mt-2">{children}</dd>}
    </div>
  );
}
