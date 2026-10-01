import { useId, type ReactNode } from 'react';

/** Bloque de una pantalla con título accesible y acción opcional a la derecha. */
export function Seccion({
  titulo, descripcion, accion, children, className,
}: { titulo: ReactNode; descripcion?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={className}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 id={id} className="font-display text-lg font-black tracking-tight text-vb-blue">{titulo}</h2>
          {descripcion && <p className="text-sm text-ink/65">{descripcion}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}
