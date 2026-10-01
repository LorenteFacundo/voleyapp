import { fechaArgentina, formatFechaLarga } from '@/lib/date';

/** "martes 6 de octubre". */
export function fechaLarga(fecha: string): string {
  return formatFechaLarga(fecha);
}

/** Fecha larga en Buenos Aires de un instante. */
export function fechaLargaDeInstante(instante: string): string {
  return fechaLarga(fechaArgentina(instante));
}

/** Primera letra en mayúscula: "martes" → "Martes". */
export function capitalizar(texto: string): string {
  return texto ? `${texto.charAt(0).toUpperCase()}${texto.slice(1)}` : texto;
}
