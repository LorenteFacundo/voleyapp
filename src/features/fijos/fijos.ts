// Reglas de los alquileres fijos (series semanales) del lado del cliente.
// Coinciden con private.validar_serie en el servidor.

import type { HorarioPublicado } from '@/api/tipos';
import {
  DIAS_LUNES_A_DOMINGO, DIAS_SEMANA, addDaysToISODate, diaSemana, formatDuracion, horaAMinutos, minutosAHora,
} from '@/lib/date';

export const DURACIONES_RAPIDAS = [60, 90, 120] as const;
export const DURACION_MINIMA = 30;
export const DURACION_MAXIMA = 720;

/** Todas las duraciones válidas: de 30 minutos a 12 horas, de a 15 minutos. */
export const DURACIONES = Array.from(
  { length: (DURACION_MAXIMA - DURACION_MINIMA) / 15 + 1 },
  (_, indice) => DURACION_MINIMA + indice * 15,
);

const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type Horario = { canchaId: number | null; dia: number; hora: string; duracion: number };
export type ErroresHorario = Partial<Record<'canchaId' | 'dia' | 'hora' | 'duracion', string>>;

export function horaFin(hora: string, duracionMin: number): string {
  return minutosAHora(horaAMinutos(hora) + duracionMin);
}

/** "Martes 19:00–20:30" */
export function describirHorario(dia: number, hora: string, duracionMin: number): string {
  return `${DIAS_SEMANA[dia]} ${hora}–${horaFin(hora, duracionMin)}`;
}

/** "el fijo de los martes 19:00" (para mensajes). */
export function describirFijoParaMensaje(dia: number, hora: string): string {
  return `el fijo de los ${DIAS_SEMANA[dia].toLowerCase()}${dia === 0 || dia === 6 ? 's' : ''} ${hora}`;
}

export function textoDuracion(duracionMin: number): string {
  return formatDuracion(duracionMin);
}

export function validarHorario(horario: Horario): ErroresHorario {
  const errores: ErroresHorario = {};
  if (!horario.canchaId) errores.canchaId = 'Elegí la cancha.';
  if (!Number.isInteger(horario.dia) || horario.dia < 0 || horario.dia > 6) errores.dia = 'Elegí el día.';
  const hora = HORA_VALIDA.exec(horario.hora);
  if (!hora) errores.hora = 'Ingresá la hora de inicio (por ejemplo 19:30).';
  else if (Number(hora[2]) % 5 !== 0) errores.hora = 'Usá minutos múltiplos de 5 (por ejemplo 19:00 o 19:30).';
  const duracion = horario.duracion;
  if (!Number.isInteger(duracion) || duracion < DURACION_MINIMA || duracion > DURACION_MAXIMA || duracion % 15 !== 0) {
    errores.duracion = 'La duración debe ser de 30 minutos a 12 horas, en tramos de 15 minutos.';
  }
  return errores;
}

/**
 * Primera fecha desde hoy que cae en ese día. Si es hoy y la hora ya pasó,
 * la de la semana siguiente (el servidor no genera fechas pasadas).
 */
export function proximaFecha(dia: number, hoy: string, hora?: string | null, horaActual?: string | null): string {
  const diferencia = (dia - diaSemana(hoy) + 7) % 7;
  if (diferencia === 0 && hora && horaActual && HORA_VALIDA.test(hora) && HORA_VALIDA.test(horaActual)
    && horaAMinutos(hora) <= horaAMinutos(horaActual)) {
    return addDaysToISODate(hoy, 7);
  }
  return addDaysToISODate(hoy, diferencia);
}

/** Precio del bloque publicado que coincide exactamente (cancha, día, inicio y fin). */
export function precioSugerido(horarios: HorarioPublicado[], horario: Horario): number | null {
  if (!horario.canchaId || !HORA_VALIDA.test(horario.hora)) return null;
  const fin = horaFin(horario.hora, horario.duracion);
  const bloque = horarios.find((h) => h.activo && h.cancha_id === horario.canchaId && h.dia_semana === horario.dia
    && h.hora_inicio === horario.hora && h.hora_fin === fin);
  return bloque ? Number(bloque.precio_total) : null;
}

/** Duración del bloque publicado que empieza a esa hora, si existe. */
export function duracionDeBloque(horarios: HorarioPublicado[], canchaId: number, dia: number, hora: string): number | null {
  const bloque = horarios.find((h) => h.activo && h.cancha_id === canchaId && h.dia_semana === dia && h.hora_inicio === hora);
  if (!bloque) return null;
  const minutos = (horaAMinutos(bloque.hora_fin) - horaAMinutos(bloque.hora_inicio) + 1440) % 1440;
  return minutos >= DURACION_MINIMA && minutos % 15 === 0 ? minutos : null;
}

/** ¿Cambia algo que obliga a reprogramar (cancha, día, hora o duración)? */
export function cambiaHorario(antes: Horario, despues: Horario): boolean {
  return antes.canchaId !== despues.canchaId || antes.dia !== despues.dia
    || antes.hora !== despues.hora || antes.duracion !== despues.duracion;
}

/** Agrupa por día de la semana en orden lunes → domingo, sin días vacíos. */
export function agruparPorDia<T extends { dia_semana: number }>(items: readonly T[]): { dia: number; items: T[] }[] {
  return DIAS_LUNES_A_DOMINGO
    .map((dia) => ({ dia, items: items.filter((item) => item.dia_semana === dia) }))
    .filter((grupo) => grupo.items.length > 0);
}

/** "12/10, 19/10" a partir de fechas 'YYYY-MM-DD'. */
export function fechasCortas(fechas: readonly string[]): string {
  return fechas.map((fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`).join(', ');
}

/**
 * ¿Se puede guardar después de revisar las fechas? Con choques, solo
 * omitiéndolos; sin ninguna fecha por delante, solo si el fijo empieza más
 * allá del horizonte (las fechas se generan solas cuando se acercan).
 */
export function puedeConfirmarFechas(
  vista: { fechas: number; horizonte: string; conflictos: readonly unknown[] }, omitir: boolean, desde: string,
): boolean {
  if (vista.fechas === 0) return desde > vista.horizonte;
  return vista.conflictos.length === 0 || omitir;
}
