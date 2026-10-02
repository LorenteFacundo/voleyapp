import { fechaArgentina, formatDiaRelativo, horaArgentina } from '@/lib/date';

/** "Hoy 19:00", "Mañana 21:30" o "lun 6 oct 19:00". */
export function formatInstante(instante: string, hoy?: string): string {
  return `${formatDiaRelativo(fechaArgentina(instante), hoy)} ${horaArgentina(instante)}`;
}

/** "Hoy", "Ayer" o "lun 6 oct" (sin hora). */
export function formatDiaDeInstante(instante: string, hoy?: string): string {
  return formatDiaRelativo(fechaArgentina(instante), hoy);
}
