// Filas de la caja para exportar con generarCsv (lib/archivos): los montos
// viajan como números para que Excel pueda sumarlos.

import type { PagoCaja } from '@/api/tipos';
import { instanteParaPlanilla } from '@/lib/archivos';
import { etiquetaMedio } from './etiquetas';

export function describirReservaDePago(ocupacion: NonNullable<PagoCaja['ocupacion']>): string {
  return [ocupacion.titulo, ocupacion.cancha, instanteParaPlanilla(ocupacion.inicio)].filter(Boolean).join(' · ');
}

export const ENCABEZADOS_PAGOS = [
  'fecha', 'cliente', 'reserva', 'medio', 'ingreso', 'egreso', 'nota', 'registrado_por', 'estado',
];

/** Una fila por pago; las devoluciones van en "egreso" con valor positivo. */
export function filasPagos(pagos: PagoCaja[]): unknown[][] {
  return pagos.map((pago) => [
    pago.fecha,
    pago.cliente?.nombre ?? '',
    pago.ocupacion ? describirReservaDePago(pago.ocupacion) : '',
    etiquetaMedio(pago.medio),
    pago.monto > 0 ? pago.monto : null,
    pago.monto < 0 ? -pago.monto : null,
    pago.nota ?? '',
    pago.registrado_por,
    pago.anulado ? 'Anulado' : 'Vigente',
  ]);
}
