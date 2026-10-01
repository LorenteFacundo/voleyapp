// Validaciones y cálculos de horas para los formularios de la agenda. El
// servidor vuelve a validar todo; esto da respuesta inmediata.

import { horaAMinutos, minutosAHora } from '@/lib/date';

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DURACIONES_RAPIDAS = [60, 90, 120] as const;

export function esHoraValida(hora: string): boolean {
  return HORA.test(hora);
}

export function errorDeHora(hora: string): string | null {
  if (!esHoraValida(hora)) return 'Elegí una hora.';
  if (horaAMinutos(hora) % 5 !== 0) return 'Usá horarios en múltiplos de 5 minutos.';
  return null;
}

export function errorDeDuracion(minutos: number, maximoHoras = 12): string | null {
  if (!Number.isFinite(minutos) || minutos < 15) return 'Tiene que durar al menos 15 minutos.';
  if (minutos > maximoHoras * 60) return `No puede durar más de ${maximoHoras} horas.`;
  if (minutos % 5 !== 0) return 'Usá duraciones en múltiplos de 5 minutos.';
  return null;
}

/** Minutos entre dos horas de pared; si el fin no es posterior, termina al día siguiente. */
export function duracionEntre(inicio: string, fin: string): number {
  const diferencia = horaAMinutos(fin) - horaAMinutos(inicio);
  return diferencia <= 0 ? diferencia + 1440 : diferencia;
}

/** Hora de fin para un inicio y una duración ("23:00" + 120 → "01:00"). */
export function horaDeFin(inicio: string, minutos: number): string {
  return minutosAHora(horaAMinutos(inicio) + minutos);
}

export function terminaAlDiaSiguiente(inicio: string, minutos: number): boolean {
  return horaAMinutos(inicio) + minutos > 1440;
}

/** Próxima media hora desde un minuto del día (sin pasar de las 23:30). */
export function proximaMediaHora(minuto: number): string {
  return minutosAHora(Math.min(Math.ceil(minuto / 30) * 30, 1410));
}

/** "1 h 30 min" / "45 min" para mostrar duraciones. */
export function textoDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}
