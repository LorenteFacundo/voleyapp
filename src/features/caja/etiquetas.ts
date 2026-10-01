// Textos y colores consistentes para medios de pago, orígenes y estados.

import type { ComponentProps } from 'react';
import type { Badge } from '@/components/ui/Badge';
import type { EstadoPago, MedioPago, Ocupacion, OrigenOcupacion } from '@/api/tipos';

export type VarianteBadge = NonNullable<ComponentProps<typeof Badge>['variant']>;
export type Etiqueta = { texto: string; variante: VarianteBadge; className?: string };

export const MEDIOS_PAGO: { valor: MedioPago; etiqueta: string }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'mercadopago', etiqueta: 'Mercado Pago' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export function etiquetaMedio(medio: string): string {
  return MEDIOS_PAGO.find((opcion) => opcion.valor === medio)?.etiqueta ?? medio;
}

export const ORIGENES: { valor: OrigenOcupacion; etiqueta: string }[] = [
  { valor: 'app', etiqueta: 'App' },
  { valor: 'whatsapp', etiqueta: 'WhatsApp' },
  { valor: 'telefono', etiqueta: 'Teléfono' },
  { valor: 'mostrador', etiqueta: 'Mostrador' },
  { valor: 'fijo', etiqueta: 'Fijo' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export function etiquetaOrigen(origen: string): string {
  return ORIGENES.find((opcion) => opcion.valor === origen)?.etiqueta ?? origen;
}

type DatosEstado = Pick<Ocupacion, 'estado' | 'cancelada_por' | 'serie_id'>;

/** Pendiente ámbar, confirmada azul, fijo índigo, cancelada tachada. */
export function etiquetaEstadoReserva(ocupacion: DatosEstado): Etiqueta {
  switch (ocupacion.estado) {
    case 'pendiente':
      return { texto: 'Pendiente', variante: 'warning' };
    case 'confirmada':
      return ocupacion.serie_id
        ? { texto: 'Fijo', variante: 'default', className: 'bg-indigo-100 text-indigo-800' }
        : { texto: 'Confirmada', variante: 'info' };
    case 'cancelada':
      return { texto: motivoBaja(ocupacion), variante: 'muted', className: 'line-through' };
    case 'rechazada':
      return { texto: 'Rechazada', variante: 'muted', className: 'line-through' };
    case 'vencida':
      return { texto: 'Vencida', variante: 'muted', className: 'line-through' };
  }
}

/** Por qué una reserva dejó de estar activa. */
export function motivoBaja(ocupacion: DatosEstado): string {
  if (ocupacion.estado === 'rechazada') return 'Rechazada por el club';
  if (ocupacion.estado === 'vencida') return 'Venció sin respuesta';
  if (ocupacion.cancelada_por === 'jugador') return 'Cancelada por el jugador';
  if (ocupacion.cancelada_por === 'club') return 'Cancelada por el club';
  return 'Cancelada';
}

/** Estado del cobro de una reserva. Una reserva sin cargo no muestra etiqueta. */
export function etiquetaEstadoPago(estado: EstadoPago, yaEmpezo: boolean): Etiqueta | null {
  switch (estado) {
    case 'pagado':
      return { texto: 'Pagada', variante: 'success' };
    case 'parcial':
      return { texto: 'Pago parcial', variante: 'warning' };
    case 'pendiente':
      return yaEmpezo ? { texto: 'Impaga', variante: 'danger' } : { texto: 'Sin pagar', variante: 'muted' };
    case 'a_devolver':
      return { texto: 'A devolver', variante: 'danger' };
    case 'sin_cargo':
      return null;
  }
}

export function yaEmpezo(instante: string, ahora: Date = new Date()): boolean {
  return new Date(instante).getTime() <= ahora.getTime();
}

/** Nombre y teléfono de quien hizo la reserva (cliente del club o jugador de la app). */
export function contactoDeReserva(
  ocupacion: Pick<Ocupacion, 'cliente' | 'jugador' | 'titulo'>,
): { nombre: string; telefono: string | null } {
  return {
    nombre: ocupacion.cliente?.nombre ?? ocupacion.jugador?.nombre ?? ocupacion.titulo ?? 'Sin nombre',
    telefono: ocupacion.cliente?.telefono ?? ocupacion.jugador?.telefono ?? null,
  };
}
