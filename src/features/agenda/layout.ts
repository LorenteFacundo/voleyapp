// Cálculos puros de la grilla de la agenda: qué franja horaria se muestra,
// dónde va cada ocupación y qué partes de los bloques publicados siguen libres.
// Todo se mide en minutos desde las 00:00 (hora de Buenos Aires) del día visible.

import type { CanchaGestion, HorarioPublicado } from '@/api/tipos';
import { addDaysToISODate, diaSemana, fechaArgentina, instanteArgentina, minutosAHora } from '@/lib/date';

export const MINUTOS_DIA = 1440;
export const MINUTOS_POR_FILA = 30;
/** 45 px por media hora: un turno de 30 minutos ya es un objetivo táctil cómodo. */
export const PX_POR_MINUTO = 1.5;
export const ALTO_FILA = MINUTOS_POR_FILA * PX_POR_MINUTO;
/** Franja que se muestra cuando el día no tiene horarios publicados. */
export const RANGO_PREDETERMINADO: Intervalo = { inicio: 8 * 60, fin: 24 * 60 };
/** Los restos libres más cortos no alcanzan para un turno y no se ofrecen. */
export const MINIMO_LIBRE = 30;

export type Intervalo = { inicio: number; fin: number };

/** Parte de una ocupación que cae en el día, con marcas si empezó antes o sigue después. */
export type Tramo = Intervalo & { desdeAntes: boolean; sigueDespues: boolean };

export type DiaAgenda = {
  fecha: string;
  /** Instante (ms) de las 00:00 del día en Buenos Aires. */
  origen: number;
  /** Duración del día en minutos (1440 salvo cambios de horario). */
  largo: number;
};

export function diaDe(fecha: string): DiaAgenda {
  const origen = Date.parse(instanteArgentina(fecha, '00:00'));
  const siguiente = Date.parse(instanteArgentina(addDaysToISODate(fecha, 1), '00:00'));
  return { fecha, origen, largo: Math.round((siguiente - origen) / 60_000) };
}

function aMinutos(hora: string): number {
  const [h, m] = hora.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

/** Bloque publicado en minutos; si cruza la medianoche, el fin pasa de 1440. */
export function intervaloDeHorario(horario: Pick<HorarioPublicado, 'hora_inicio' | 'hora_fin'>): Intervalo {
  const inicio = aMinutos(horario.hora_inicio);
  let fin = aMinutos(horario.hora_fin);
  if (fin <= inicio) fin += MINUTOS_DIA;
  return { inicio, fin };
}

/** Bloques activos de un día de la semana para las canchas indicadas. */
export function horariosDelDia(horarios: HorarioPublicado[], dia: number, canchas: ReadonlySet<number>): HorarioPublicado[] {
  return horarios.filter((horario) => horario.activo && horario.dia_semana === dia && canchas.has(horario.cancha_id));
}

/** Intersección con un límite (por defecto, el día completo). */
export function recortar(intervalo: Intervalo, limite: Intervalo = { inicio: 0, fin: MINUTOS_DIA }): Intervalo | null {
  const inicio = Math.max(intervalo.inicio, limite.inicio);
  const fin = Math.min(intervalo.fin, limite.fin);
  return fin > inicio ? { inicio, fin } : null;
}

/**
 * Ubica una ocupación (instantes ISO) dentro del día. Una reserva que cruza
 * la medianoche aparece recortada en los dos días que toca.
 */
export function tramoEnDia(inicio: string, fin: string, dia: DiaAgenda): Tramo | null {
  const desde = Math.round((Date.parse(inicio) - dia.origen) / 60_000);
  const hasta = Math.round((Date.parse(fin) - dia.origen) / 60_000);
  if (hasta <= 0 || desde >= dia.largo) return null;
  return {
    inicio: Math.max(0, desde),
    fin: Math.min(dia.largo, hasta),
    desdeAntes: desde < 0,
    sigueDespues: hasta > dia.largo,
  };
}

/**
 * Franja visible: desde el primer bloque publicado hasta el último (o
 * 08:00–24:00 si no hay), ampliada para que entre toda ocupación que caiga
 * afuera. Se alinea a filas de 30 minutos.
 */
export function rangoDelDia(
  bloques: Intervalo[],
  ocupaciones: Intervalo[],
  predeterminado: Intervalo = RANGO_PREDETERMINADO,
): Intervalo {
  const visibles = bloques.map((bloque) => recortar(bloque)).filter((bloque): bloque is Intervalo => bloque !== null);
  let inicio = visibles.length ? Math.min(...visibles.map((bloque) => bloque.inicio)) : predeterminado.inicio;
  let fin = visibles.length ? Math.max(...visibles.map((bloque) => bloque.fin)) : predeterminado.fin;
  for (const ocupacion of ocupaciones) {
    inicio = Math.min(inicio, ocupacion.inicio);
    fin = Math.max(fin, ocupacion.fin);
  }
  inicio = Math.max(0, Math.floor(inicio / MINUTOS_POR_FILA) * MINUTOS_POR_FILA);
  fin = Math.min(MINUTOS_DIA, Math.ceil(fin / MINUTOS_POR_FILA) * MINUTOS_POR_FILA);
  if (fin - inicio < MINUTOS_POR_FILA * 2) {
    fin = Math.min(MINUTOS_DIA, inicio + MINUTOS_POR_FILA * 2);
    inicio = Math.max(0, fin - MINUTOS_POR_FILA * 2);
  }
  return { inicio, fin };
}

/** Inicio de cada fila (cada 30 minutos) dentro del rango. */
export function filasDelRango(rango: Intervalo): number[] {
  const filas: number[] = [];
  for (let minuto = rango.inicio; minuto < rango.fin; minuto += MINUTOS_POR_FILA) filas.push(minuto);
  return filas;
}

export function altoDelRango(rango: Intervalo, pxPorMinuto = PX_POR_MINUTO): number {
  return (rango.fin - rango.inicio) * pxPorMinuto;
}

/** Posición vertical en píxeles de un tramo, recortado al rango visible. */
export function posicion(
  tramo: Intervalo,
  rango: Intervalo,
  pxPorMinuto = PX_POR_MINUTO,
  altoMinimo = 20,
): { top: number; height: number } {
  const inicio = Math.min(Math.max(tramo.inicio, rango.inicio), rango.fin);
  const fin = Math.max(Math.min(tramo.fin, rango.fin), inicio);
  return { top: (inicio - rango.inicio) * pxPorMinuto, height: Math.max((fin - inicio) * pxPorMinuto, altoMinimo) };
}

/** Lo que queda de `base` después de quitarle los intervalos ocupados. */
export function restarIntervalos(base: Intervalo, ocupados: Intervalo[]): Intervalo[] {
  const relevantes = ocupados
    .filter((ocupado) => ocupado.fin > base.inicio && ocupado.inicio < base.fin)
    .sort((a, b) => a.inicio - b.inicio);
  const libres: Intervalo[] = [];
  let cursor = base.inicio;
  for (const ocupado of relevantes) {
    if (ocupado.inicio > cursor) libres.push({ inicio: cursor, fin: Math.min(ocupado.inicio, base.fin) });
    cursor = Math.max(cursor, ocupado.fin);
    if (cursor >= base.fin) break;
  }
  if (cursor < base.fin) libres.push({ inicio: cursor, fin: base.fin });
  return libres;
}

export type OcupadoEnCancha = Intervalo & { canchaId: number };

export type BloqueLibre = Intervalo & {
  canchaId: number;
  horarioId: number;
  /** Bloque publicado completo (sin recortar al día). */
  bloque: Intervalo;
  precio: number;
  sena: number;
  /** true si está libre todo lo que el bloque ocupa en el día. */
  completo: boolean;
};

/**
 * Partes libres de los bloques publicados del día: cada bloque menos lo que
 * se superpone con reservas o bloqueos de su cancha. Los restos de menos de
 * `minimo` minutos se descartan.
 */
export function bloquesLibres(
  horarios: HorarioPublicado[],
  ocupados: OcupadoEnCancha[],
  minimo = MINIMO_LIBRE,
): BloqueLibre[] {
  const libres: BloqueLibre[] = [];
  for (const horario of horarios) {
    const bloque = intervaloDeHorario(horario);
    const visible = recortar(bloque);
    if (!visible) continue;
    const enCancha = ocupados.filter((ocupado) => ocupado.canchaId === horario.cancha_id);
    for (const tramo of restarIntervalos(visible, enCancha)) {
      if (tramo.fin - tramo.inicio < minimo) continue;
      libres.push({
        ...tramo,
        canchaId: horario.cancha_id,
        horarioId: horario.id,
        bloque,
        precio: Number(horario.precio_total),
        sena: Number(horario.precio_sena),
        completo: tramo.inicio === visible.inicio && tramo.fin === visible.fin,
      });
    }
  }
  return libres.sort((a, b) => a.inicio - b.inicio || a.canchaId - b.canchaId);
}

/**
 * Reparte en carriles los elementos que se superponen (para mostrarlos lado a
 * lado). En una misma cancha no debería pasar, pero la grilla no se rompe si
 * llega a ocurrir.
 */
export function asignarCarriles<T extends Intervalo>(items: T[]): Array<T & { carril: number; carriles: number }> {
  const ordenados = [...items].sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);
  const resultado: Array<T & { carril: number; carriles: number }> = [];
  let grupo: Array<T & { carril: number; carriles: number }> = [];
  let finesDeCarril: number[] = [];
  let finDelGrupo = Number.NEGATIVE_INFINITY;

  const cerrarGrupo = () => {
    for (const item of grupo) item.carriles = finesDeCarril.length;
    resultado.push(...grupo);
    grupo = [];
    finesDeCarril = [];
    finDelGrupo = Number.NEGATIVE_INFINITY;
  };

  for (const item of ordenados) {
    if (grupo.length && item.inicio >= finDelGrupo) cerrarGrupo();
    let carril = finesDeCarril.findIndex((fin) => fin <= item.inicio);
    if (carril === -1) {
      carril = finesDeCarril.length;
      finesDeCarril.push(item.fin);
    } else {
      finesDeCarril[carril] = item.fin;
    }
    grupo.push({ ...item, carril, carriles: 1 });
    finDelGrupo = Math.max(finDelGrupo, item.fin);
  }
  if (grupo.length) cerrarGrupo();
  return resultado;
}

/** Minuto del día de un instante, o null si el instante no cae en ese día. */
export function minutoEnDia(instante: number, dia: DiaAgenda): number | null {
  const minuto = (instante - dia.origen) / 60_000;
  return minuto >= 0 && minuto < dia.largo ? minuto : null;
}

/** Duración más habitual de los bloques publicados de una cancha (60 si no hay). */
export function duracionHabitual(horarios: HorarioPublicado[], canchaId: number, porDefecto = 60): number {
  const cuenta = new Map<number, number>();
  for (const horario of horarios) {
    if (!horario.activo || horario.cancha_id !== canchaId) continue;
    const { inicio, fin } = intervaloDeHorario(horario);
    cuenta.set(fin - inicio, (cuenta.get(fin - inicio) ?? 0) + 1);
  }
  let mejor = porDefecto;
  let veces = 0;
  for (const [duracion, cantidad] of cuenta) {
    if (cantidad > veces || (cantidad === veces && duracion < mejor)) {
      mejor = duracion;
      veces = cantidad;
    }
  }
  return mejor;
}

// ---------------------------------------------------------------------------
// Armado de la grilla de un día y de la lista semanal
// ---------------------------------------------------------------------------

/** Lo mínimo que la grilla necesita de una ocupación. */
type OcupacionUbicable = { id: number; cancha_id: number; inicio: string; fin: string; tipo: 'reserva' | 'bloqueo' };

export type ColumnaGrilla = { cancha: CanchaGestion; inactiva: boolean };

export type Grilla<T extends OcupacionUbicable> = {
  dia: DiaAgenda;
  rango: Intervalo;
  columnas: ColumnaGrilla[];
  tramos: { ocupacion: T; tramo: Tramo }[];
  libres: BloqueLibre[];
  hayHorarios: boolean;
};

/**
 * Columnas (canchas activas, más las inactivas que tengan algo ese día),
 * franja visible, ocupaciones recortadas al día y bloques libres. Las
 * reservas siempre amplían la franja; un bloqueo solo si cae completamente
 * afuera (uno de todo el día se ve recortado a la franja de horarios).
 */
export function armarGrilla<T extends OcupacionUbicable>(params: {
  fecha: string;
  canchas: CanchaGestion[];
  horarios: HorarioPublicado[];
  ocupaciones: T[];
}): Grilla<T> {
  const dia = diaDe(params.fecha);
  const tramos = params.ocupaciones
    .map((ocupacion) => ({ ocupacion, tramo: tramoEnDia(ocupacion.inicio, ocupacion.fin, dia) }))
    .filter((item): item is { ocupacion: T; tramo: Tramo } => item.tramo !== null);
  const conOcupaciones = new Set(tramos.map((item) => item.ocupacion.cancha_id));
  const columnas = [...params.canchas]
    .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo) || a.id - b.id)
    .filter((cancha) => cancha.activa || conOcupaciones.has(cancha.id))
    .map((cancha) => ({ cancha, inactiva: !cancha.activa }));
  const activas = new Set(params.canchas.filter((cancha) => cancha.activa).map((cancha) => cancha.id));
  const horariosHoy = horariosDelDia(params.horarios, diaSemana(params.fecha), activas);
  const bloques = horariosHoy.map(intervaloDeHorario);
  const base = rangoDelDia(bloques, []);
  const rango = rangoDelDia(
    bloques,
    tramos
      .filter((item) => item.ocupacion.tipo === 'reserva' || !recortar(item.tramo, base))
      .map((item) => item.tramo),
  );
  const libres = bloquesLibres(horariosHoy, tramos.map((item) => ({
    canchaId: item.ocupacion.cancha_id, inicio: item.tramo.inicio, fin: item.tramo.fin,
  })));
  return { dia, rango, columnas, tramos, libres, hayHorarios: horariosHoy.length > 0 };
}

/** Libres que todavía sirven: ninguno en días pasados; hoy, los que no terminaron. */
export function libresVigentes(libres: BloqueLibre[], fecha: string, hoy: string, minutoAhora: number | null): BloqueLibre[] {
  if (fecha < hoy) return [];
  if (fecha > hoy || minutoAhora === null) return libres;
  return libres.filter((libre) => libre.fin > minutoAhora);
}

/**
 * Minuto al que conviene desplazar la grilla al abrir un día: una hora antes
 * de ahora si es hoy; si no, media hora antes de lo primero que haya.
 */
export function minutoInicialDeScroll(params: {
  rango: Intervalo;
  minutoAhora: number | null;
  primeros: number[];
}): number {
  const { rango, minutoAhora, primeros } = params;
  const objetivo = minutoAhora !== null
    ? minutoAhora - 60
    : primeros.length ? Math.min(...primeros) - MINUTOS_POR_FILA : rango.inicio;
  return Math.min(Math.max(objetivo, rango.inicio), rango.fin);
}

/**
 * Reparte las ocupaciones de una semana por día para la vista de lista: cada
 * reserva aparece el día que empieza (o el primero de la semana si empezó
 * antes) y cada bloqueo en todos los días que toca.
 */
export function ocupacionesPorDia<T extends OcupacionUbicable>(ocupaciones: T[], dias: string[]): Map<string, T[]> {
  const resultado = new Map<string, T[]>(dias.map((fecha) => [fecha, []]));
  if (!dias.length) return resultado;
  const limites = dias.map((fecha) => diaDe(fecha));
  for (const ocupacion of ocupaciones) {
    if (ocupacion.tipo === 'bloqueo') {
      for (const dia of limites) {
        if (tramoEnDia(ocupacion.inicio, ocupacion.fin, dia)) resultado.get(dia.fecha)?.push(ocupacion);
      }
      continue;
    }
    const fecha = fechaArgentina(ocupacion.inicio);
    const destino = fecha < dias[0] ? dias[0] : fecha;
    resultado.get(destino)?.push(ocupacion);
  }
  for (const lista of resultado.values()) lista.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio) || a.cancha_id - b.cancha_id);
  return resultado;
}

/** "19:00–21:00" del tramo visible en el día, o "Todo el día" si lo cubre entero. */
export function horarioEnDia(inicio: string, fin: string, dia: DiaAgenda): string {
  const tramo = tramoEnDia(inicio, fin, dia);
  if (!tramo) return '';
  return textoDeTramo(tramo, dia.largo);
}

export function textoDeTramo(tramo: Intervalo, largoDia = MINUTOS_DIA): string {
  if (tramo.inicio <= 0 && tramo.fin >= largoDia) return 'Todo el día';
  return `${minutosAHora(tramo.inicio)}–${minutosAHora(tramo.fin)}`;
}
