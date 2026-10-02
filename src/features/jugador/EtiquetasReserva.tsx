import { Repeat2 } from 'lucide-react';
import clsx from 'clsx';
import type { EstadoOcupacion } from '@/api/tipos';

// Colores de estado consistentes en toda la app: pendiente ámbar, confirmada
// verde, fijo índigo, cancelada/vencida gris tachado, rechazada rojo.
const ESTILOS: Record<EstadoOcupacion, string> = {
  pendiente: 'bg-amber-100 text-amber-900',
  confirmada: 'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-800',
  cancelada: 'bg-ink/5 text-ink/65 line-through',
  vencida: 'bg-ink/5 text-ink/65 line-through',
};

const BASE = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold';

export function EtiquetaEstadoReserva({ estado, children }: { estado: EstadoOcupacion; children: string }) {
  return <span className={clsx(BASE, ESTILOS[estado])}>{children}</span>;
}

export function EtiquetaFijo() {
  return (
    <span className={clsx(BASE, 'bg-indigo-100 text-indigo-800')}>
      <Repeat2 size={12} aria-hidden="true" /> Turno fijo
    </span>
  );
}
