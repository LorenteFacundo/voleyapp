// Períodos para la caja y los reportes, siempre en fechas de calendario de
// Buenos Aires ('YYYY-MM-DD').

import {
  addDaysToISODate, diferenciaEnDias, esFechaISO, formatDiaMes, formatDiaRelativo, inicioDeSemana,
} from '@/lib/date';

export type Rango = { desde: string; hasta: string };

export type PresetCaja = 'hoy' | 'ayer' | 'semana' | 'mes' | 'personalizado';
export type PresetReporte = 'ultimas4' | 'mes' | 'mesPasado' | 'personalizado';

export const PRESETS_CAJA: { id: PresetCaja; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'personalizado', label: 'Personalizado' },
];

export const PRESETS_REPORTE: { id: PresetReporte; label: string }[] = [
  { id: 'ultimas4', label: 'Últimas 4 semanas' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mesPasado', label: 'Mes pasado' },
  { id: 'personalizado', label: 'Personalizado' },
];

/** Límites que valida el servidor (club_caja: 93 días; club_reporte: 186 días). */
export const LIMITE_CAJA = { dias: 93, texto: '3 meses' } as const;
export const LIMITE_REPORTE = { dias: 186, texto: '6 meses' } as const;

export function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function ultimoDiaDelMes(fecha: string): string {
  const [anio, mes] = fecha.split('-').map(Number);
  const siguiente = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  return addDaysToISODate(siguiente, -1);
}

export function rangoCaja(preset: Exclude<PresetCaja, 'personalizado'>, hoy: string): Rango {
  switch (preset) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case 'ayer': {
      const ayer = addDaysToISODate(hoy, -1);
      return { desde: ayer, hasta: ayer };
    }
    case 'semana':
      return { desde: inicioDeSemana(hoy), hasta: hoy };
    case 'mes':
      return { desde: primerDiaDelMes(hoy), hasta: hoy };
  }
}

export function rangoReporte(preset: Exclude<PresetReporte, 'personalizado'>, hoy: string): Rango {
  switch (preset) {
    case 'ultimas4':
      return { desde: addDaysToISODate(hoy, -27), hasta: hoy };
    case 'mes':
      return { desde: primerDiaDelMes(hoy), hasta: hoy };
    case 'mesPasado': {
      const fin = addDaysToISODate(primerDiaDelMes(hoy), -1);
      return { desde: primerDiaDelMes(fin), hasta: fin };
    }
  }
}

/** Mensaje de error para mostrar, o null si el rango es válido. */
export function validarRango({ desde, hasta }: Rango, limite: { dias: number; texto: string }): string | null {
  if (!esFechaISO(desde) || !esFechaISO(hasta)) return 'Elegí la fecha de inicio y la de fin.';
  if (hasta < desde) return 'La fecha de fin no puede ser anterior a la de inicio.';
  if (diferenciaEnDias(desde, hasta) > limite.dias) return `Elegí un período de hasta ${limite.texto}.`;
  return null;
}

/** "Hoy", "Ayer", "lun 6 oct" o "Del 1 oct al 15 oct". */
export function describirRango({ desde, hasta }: Rango, hoy: string): string {
  if (!esFechaISO(desde) || !esFechaISO(hasta)) return '';
  if (desde === hasta) return formatDiaRelativo(desde, hoy);
  const anioActual = hoy.slice(0, 4);
  const conAnio = desde.slice(0, 4) !== anioActual || hasta.slice(0, 4) !== anioActual;
  const formato = (fecha: string) => (conAnio ? `${formatDiaMes(fecha)} ${fecha.slice(0, 4)}` : formatDiaMes(fecha));
  return `Del ${formato(desde)} al ${formato(hasta)}`;
}
