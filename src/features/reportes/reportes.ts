// Cálculos derivados del reporte del club: ocupación, mapa de calor por día
// y hora, horas valle y distribución de reservas por origen.

import type { OrigenOcupacion, Reporte } from '@/api/tipos';
import { DIAS_LUNES_A_DOMINGO } from '@/lib/date';
import { formatNumero } from '@/lib/format';

export type CeldaReporte = Reporte['calor'][number];

/** Proporción reservada sobre lo disponible (0 a 1, o más si hubo reservas fuera de horario). */
export function ratioOcupacion(ocupados: number, disponibles: number): number | null {
  const total = Number(disponibles);
  return total > 0 ? Number(ocupados) / total : null;
}

/** "62%" o "—" si no hay horarios disponibles. */
export function textoPorcentaje(ratio: number | null): string {
  return ratio === null ? '—' : `${Math.round(ratio * 100)}%`;
}

/** "124 h" o "12,5 h". */
export function textoHoras(minutos: number): string {
  return `${formatNumero(Number(minutos) / 60)} h`;
}

// ---------------------------------------------------------------------------
// Mapa de calor
// ---------------------------------------------------------------------------

/** -1: sin horario publicado; 0: libre; 1 a 4: cada vez más ocupado. */
export type NivelCalor = -1 | 0 | 1 | 2 | 3 | 4;

export const ESCALA_CALOR: { nivel: NivelCalor; etiqueta: string }[] = [
  { nivel: -1, etiqueta: 'Sin horario' },
  { nivel: 0, etiqueta: '0%' },
  { nivel: 1, etiqueta: '1–24%' },
  { nivel: 2, etiqueta: '25–49%' },
  { nivel: 3, etiqueta: '50–74%' },
  { nivel: 4, etiqueta: '75% o más' },
];

export function nivelCalor(ratio: number | null): NivelCalor {
  if (ratio === null) return -1;
  if (ratio <= 0) return 0;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

/** Ordena las horas del día; si el club abre de noche, la madrugada va al final. */
export function ordenarHoras(horas: Iterable<number>): number[] {
  const unicas = [...new Set(horas)];
  const abreDeNoche = unicas.some((hora) => hora >= 18);
  const clave = (hora: number) => (abreDeNoche && hora < 6 ? hora + 24 : hora);
  return unicas.sort((a, b) => clave(a) - clave(b));
}

export type CeldaCalor = {
  dia: number;
  hora: number;
  ocupados: number;
  disponibles: number;
  ratio: number | null;
  nivel: NivelCalor;
};

export type MapaCalor = { horas: number[]; filas: { dia: number; celdas: CeldaCalor[] }[] };

function celda(dia: number, hora: number, ocupados: number, disponibles: number): CeldaCalor {
  const ratio = ratioOcupacion(ocupados, disponibles);
  return { dia, hora, ocupados: Number(ocupados), disponibles: Number(disponibles), ratio, nivel: nivelCalor(ratio) };
}

/** Filas de lunes a domingo; columnas solo para las horas con algún horario publicado. */
export function armarMapaCalor(calor: CeldaReporte[]): MapaCalor {
  const horas = ordenarHoras(calor.filter((c) => Number(c.disponibles) > 0).map((c) => c.hora));
  const porClave = new Map(calor.map((c) => [`${c.dia}-${c.hora}`, c]));
  return {
    horas,
    filas: DIAS_LUNES_A_DOMINGO.map((dia) => ({
      dia,
      celdas: horas.map((hora) => {
        const dato = porClave.get(`${dia}-${hora}`);
        return celda(dia, hora, dato?.ocupados ?? 0, dato?.disponibles ?? 0);
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// Horas valle
// ---------------------------------------------------------------------------

const ordenDia = (dia: number) => (dia + 6) % 7;

/**
 * Las celdas día × hora con horario publicado y menor ocupación (por debajo
 * del umbral). Se ignoran franjas con muy poca disponibilidad en el período.
 */
export function horasValle(
  calor: CeldaReporte[],
  { maximo = 5, umbral = 0.5, minimoDisponible = 60 }: { maximo?: number; umbral?: number; minimoDisponible?: number } = {},
): CeldaCalor[] {
  return calor
    .filter((c) => Number(c.disponibles) >= minimoDisponible)
    .map((c) => celda(c.dia, c.hora, c.ocupados, c.disponibles))
    .filter((c) => (c.ratio ?? 1) < umbral)
    .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0)
      || b.disponibles - a.disponibles
      || ordenDia(a.dia) - ordenDia(b.dia)
      || a.hora - b.hora)
    .slice(0, maximo);
}

export type FranjaValle = { dia: number; desde: number; hasta: number; ratio: number };

/** Junta horas consecutivas del mismo día: "martes de 15 a 18 h". */
export function agruparValles(celdas: CeldaCalor[]): FranjaValle[] {
  const ordenadas = [...celdas].sort((a, b) => ordenDia(a.dia) - ordenDia(b.dia) || a.hora - b.hora);
  const franjas: (FranjaValle & { ocupados: number; disponibles: number })[] = [];
  for (const c of ordenadas) {
    const ultima = franjas.at(-1);
    if (ultima && ultima.dia === c.dia && ultima.hasta === c.hora) {
      ultima.hasta = c.hora + 1;
      ultima.ocupados += c.ocupados;
      ultima.disponibles += c.disponibles;
      ultima.ratio = ultima.disponibles > 0 ? ultima.ocupados / ultima.disponibles : 0;
    } else {
      franjas.push({
        dia: c.dia, desde: c.hora, hasta: c.hora + 1, ratio: c.ratio ?? 0, ocupados: c.ocupados, disponibles: c.disponibles,
      });
    }
  }
  return franjas.map(({ dia, desde, hasta, ratio }) => ({ dia, desde, hasta, ratio }));
}

// ---------------------------------------------------------------------------
// Origen y cancelaciones
// ---------------------------------------------------------------------------

export const ORDEN_ORIGEN: OrigenOcupacion[] = ['app', 'whatsapp', 'telefono', 'mostrador', 'fijo', 'otro'];

export function distribucionOrigen(
  porOrigen: Reporte['por_origen'],
): { origen: OrigenOcupacion; cantidad: number; proporcion: number }[] {
  const cantidades = ORDEN_ORIGEN.map((origen) => ({ origen, cantidad: Number(porOrigen[origen] ?? 0) }));
  const total = cantidades.reduce((suma, item) => suma + item.cantidad, 0);
  return cantidades.map((item) => ({ ...item, proporcion: total > 0 ? item.cantidad / total : 0 }));
}

const ETIQUETAS_CANCELACION: Record<string, string> = {
  club: 'Por el club',
  jugador: 'Por jugadores',
  sistema: 'Vencidas sin respuesta',
  otro: 'Otras',
};

export function resumenCancelaciones(
  canceladas: Reporte['canceladas'],
): { total: number; detalle: { clave: string; etiqueta: string; cantidad: number }[] } {
  const detalle = Object.entries(ETIQUETAS_CANCELACION)
    .map(([clave, etiqueta]) => ({ clave, etiqueta, cantidad: Number(canceladas[clave as keyof typeof canceladas] ?? 0) }))
    .filter((item) => item.cantidad > 0);
  return { total: detalle.reduce((suma, item) => suma + item.cantidad, 0), detalle };
}
