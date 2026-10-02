import { useId, type ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

/** Tarjeta con título para agrupar campos de una sección de ajustes. */
export function Apartado({
  titulo, descripcion, acciones, children, className,
}: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={className}>
      <Card padding="lg">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={id} className="font-display text-lg font-bold text-vb-blue">{titulo}</h3>
            {descripcion && <div className="mt-1 max-w-2xl text-sm text-ink/65">{descripcion}</div>}
          </div>
          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </div>
        <div className="min-w-0">{children}</div>
      </Card>
    </section>
  );
}
