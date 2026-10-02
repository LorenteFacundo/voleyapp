import type { CSSProperties } from 'react';
import type { Apariencia } from './presentacion';

/** Colores de cada tipo de ocupación (consistentes con docs/frontend.md). */
export const ESTILO_BLOQUE: Record<Apariencia, string> = {
  pendiente: 'bg-amber-50 text-amber-950 hover:bg-amber-100',
  app: 'border-l-4 border-blue-600 bg-blue-50 text-blue-950 hover:bg-blue-100',
  manual: 'border-l-4 border-green-600 bg-green-50 text-green-950 hover:bg-green-100',
  fijo: 'border-l-4 border-indigo-600 bg-indigo-50 text-indigo-950 hover:bg-indigo-100',
  bloqueo: 'border-l-4 border-slate-500 bg-slate-100 text-slate-800 hover:brightness-95',
  cancelada: 'bg-ink/5 text-ink/65',
};

/** Barra lateral de color para la vista de lista. */
export const COLOR_BARRA: Record<Apariencia, string> = {
  pendiente: 'bg-amber-500',
  app: 'bg-blue-600',
  manual: 'bg-green-600',
  fijo: 'bg-indigo-600',
  bloqueo: 'bg-slate-400',
  cancelada: 'bg-ink/20',
};

/** Rayado gris de los bloqueos. */
export const FONDO_BLOQUEO: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(135deg, rgba(100,116,139,0.10) 0 6px, rgba(100,116,139,0.24) 6px 12px)',
};

export const LEYENDA: { apariencia: Apariencia | 'libre'; etiqueta: string }[] = [
  { apariencia: 'pendiente', etiqueta: 'Pedido sin responder' },
  { apariencia: 'app', etiqueta: 'Reserva por la app' },
  { apariencia: 'manual', etiqueta: 'Cargada por el club' },
  { apariencia: 'fijo', etiqueta: 'Turno fijo' },
  { apariencia: 'bloqueo', etiqueta: 'Bloqueo' },
  { apariencia: 'libre', etiqueta: 'Libre (tocá para reservar)' },
];
