import type { BloqueDisponible } from '@/api/tipos';
import { addDaysToISODate, diferenciaEnDias, esFechaISO } from '@/lib/date';

// Cálculos de la grilla de horarios de un club: días que se muestran, ventana
// que se consulta al servidor y agrupación de bloques por cancha.

export const MAX_DIAS_VISIBLES = 14;
export const DIAS_POR_CONSULTA = 7;

/**
 * Días que se pueden pedir: desde hoy hasta hoy + ventana del club (el
 * servidor acepta esa fecha inclusive), con un máximo para la tira de fechas.
 */
export function diasReservables(hoy: string, ventanaDias: number, maximo = MAX_DIAS_VISIBLES): string[] {
  const cantidad = Math.max(1, Math.min(Math.max(0, Math.floor(ventanaDias)) + 1, maximo));
  return Array.from({ length: cantidad }, (_, indice) => addDaysToISODate(hoy, indice));
}

/** La fecha de ?fecha= si está entre los días que se muestran; si no, el primero. */
export function fechaElegida(parametro: string | null, dias: string[]): string {
  return parametro && esFechaISO(parametro) && dias.includes(parametro) ? parametro : dias[0];
}

/** La cancha de ?cancha= si es del club; si no, todas (null). */
export function canchaElegida(parametro: string | null, canchas: { id: number }[]): number | null {
  if (!parametro) return null;
  const id = Number(parametro);
  return Number.isInteger(id) && canchas.some((cancha) => cancha.id === id) ? id : null;
}

/**
 * Semana (alineada a hoy) que contiene la fecha elegida. Así moverse dentro de
 * la misma semana no vuelve a consultar al servidor.
 */
export function ventanaDeConsulta(hoy: string, fecha: string, dias = DIAS_POR_CONSULTA): { desde: string; hasta: string } {
  const diferencia = Math.max(0, diferenciaEnDias(hoy, fecha));
  const desde = addDaysToISODate(hoy, Math.floor(diferencia / dias) * dias);
  return { desde, hasta: addDaysToISODate(desde, dias - 1) };
}

/** true si el rango consultado incluye la fecha (para no mostrar "sin horarios" con datos de otra semana). */
export function cubreFecha(rango: { desde: string; hasta: string } | null | undefined, fecha: string): boolean {
  return !!rango && rango.desde <= fecha && fecha <= rango.hasta;
}

/** Cantidad de bloques libres por fecha. */
export function libresPorFecha(bloques: BloqueDisponible[]): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const bloque of bloques) {
    conteo[bloque.fecha] ??= 0;
    if (bloque.estado === 'libre') conteo[bloque.fecha] += 1;
  }
  return conteo;
}

export type GrupoCancha<C> = { cancha: C; bloques: BloqueDisponible[] };

/** Bloques del día agrupados por cancha, respetando el orden de las canchas del club. */
export function agruparPorCancha<C extends { id: number }>(
  canchas: C[], bloques: BloqueDisponible[], fecha: string, canchaId: number | null,
): GrupoCancha<C>[] {
  return canchas
    .filter((cancha) => canchaId == null || cancha.id === canchaId)
    .map((cancha) => ({
      cancha,
      bloques: bloques
        .filter((bloque) => bloque.cancha_id === cancha.id && bloque.fecha === fecha)
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    }));
}

/** Por qué un bloque figura como no disponible: falta poco para que empiece o todavía no se abrió. */
export function motivoNoDisponible(bloque: Pick<BloqueDisponible, 'fecha'>, hoy: string, ventanaDias: number): 'sobre_la_hora' | 'mas_adelante' {
  return diferenciaEnDias(hoy, bloque.fecha) > ventanaDias ? 'mas_adelante' : 'sobre_la_hora';
}
