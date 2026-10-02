// Plantilla semanal de bloques publicados de una cancha (lo que los jugadores
// pueden pedir). Replica las reglas de club_guardar_horarios para avisar antes
// de guardar: cada bloque dura entre 30 minutos y 12 horas, la seña no supera
// el precio y no hay superposiciones en la semana. Un bloque cuya hora de fin
// es menor o igual a la de inicio termina al día siguiente.

import type { BloqueHorario, HorarioPublicado } from '@/api/tipos';
import { DIAS_LUNES_A_DOMINGO, DIAS_SEMANA, DIAS_SEMANA_CORTOS, horaAMinutos, minutosAHora } from '@/lib/date';
import { formatMoney } from '@/lib/format';

export const MINUTOS_DIA = 1440;
export const MINUTOS_SEMANA = 7 * MINUTOS_DIA;
export const DURACION_MINIMA = 30;
export const DURACION_MAXIMA = 720;
export const MAXIMO_BLOQUES = 150;
export const DURACIONES_SUGERIDAS = [60, 90, 120] as const;

/** Bloque en edición: los datos que se guardan más una clave local estable. */
export type Bloque = BloqueHorario & { clave: string };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
let secuencia = 0;

export function esHora(valor: string): boolean {
  return HORA.test(valor);
}

/** Clave para bloques creados en el navegador (los guardados usan su id). */
export function nuevaClave(): string {
  secuencia += 1;
  return `n${secuencia}`;
}

export function conClave(bloque: BloqueHorario, clave = nuevaClave()): Bloque {
  return {
    clave,
    dia_semana: bloque.dia_semana,
    hora_inicio: bloque.hora_inicio,
    hora_fin: bloque.hora_fin,
    precio_total: Number(bloque.precio_total),
    precio_sena: Number(bloque.precio_sena),
  };
}

/** Minutos que dura un bloque (0 si inicio y fin coinciden). */
export function duracionBloque(inicio: string, fin: string): number {
  return (((horaAMinutos(fin) - horaAMinutos(inicio)) % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
}

/** El bloque sigue después de medianoche (no cuenta el que termina justo a las 00:00). */
export function terminaAlDiaSiguiente(bloque: Pick<BloqueHorario, 'hora_inicio' | 'hora_fin'>): boolean {
  return bloque.hora_fin !== '00:00' && horaAMinutos(bloque.hora_fin) < horaAMinutos(bloque.hora_inicio);
}

/** Hora de fin para mostrar: un bloque que termina a medianoche termina a las "24:00". */
export function finVisible(bloque: Pick<BloqueHorario, 'hora_inicio' | 'hora_fin'>): string {
  return bloque.hora_fin === '00:00' && bloque.hora_inicio !== '00:00' ? '24:00' : bloque.hora_fin;
}

/** "18:00–20:00"; un bloque que termina a medianoche se muestra "22:00–24:00". */
export function etiquetaRango(bloque: Pick<BloqueHorario, 'hora_inicio' | 'hora_fin'>): string {
  return `${bloque.hora_inicio}–${finVisible(bloque)}`;
}

/** "$ 30.000 (seña $ 10.000)" */
export function etiquetaPrecio(bloque: Pick<BloqueHorario, 'precio_total' | 'precio_sena'>): string {
  const total = formatMoney(bloque.precio_total);
  return bloque.precio_sena > 0 ? `${total} (seña ${formatMoney(bloque.precio_sena)})` : total;
}

/** "Lun 18:00–20:00", para mensajes. */
export function describirBloque(bloque: BloqueHorario): string {
  return `${DIAS_SEMANA_CORTOS[bloque.dia_semana]} ${etiquetaRango(bloque)}`;
}

/** "Lun 18:00–20:00, Mar 18:00–20:00 y 3 más". */
export function enumerarBloques(bloques: readonly BloqueHorario[], maximo = 4): string {
  const nombres = ordenarBloques(bloques).map(describirBloque);
  if (nombres.length <= maximo) {
    return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : (nombres[0] ?? '');
  }
  return `${nombres.slice(0, maximo).join(', ')} y ${nombres.length - maximo} más`;
}

/** "Se reemplazan 2 bloques: Lun 18:00–20:00 y Mar 18:00–20:00." */
export function textoReemplazo(bloques: readonly BloqueHorario[]): string {
  const cantidad = bloques.length === 1 ? 'Se reemplaza 1 bloque' : `Se reemplazan ${bloques.length} bloques`;
  return `${cantidad}: ${enumerarBloques(bloques)}.`;
}

/** Posición del día en el orden lunes → domingo. */
export function ordenDia(dia: number): number {
  return (dia + 6) % 7;
}

export function ordenarBloques<T extends BloqueHorario>(bloques: readonly T[]): T[] {
  return [...bloques].sort((a, b) => ordenDia(a.dia_semana) - ordenDia(b.dia_semana)
    || horaAMinutos(a.hora_inicio) - horaAMinutos(b.hora_inicio)
    || horaAMinutos(a.hora_fin) - horaAMinutos(b.hora_fin));
}

export function bloquesDelDia<T extends BloqueHorario>(bloques: readonly T[], dia: number): T[] {
  return ordenarBloques(bloques.filter((bloque) => bloque.dia_semana === dia));
}

/** Bloques activos guardados, agrupados por cancha, con claves que no cambian entre recargas. */
export function bloquesPorCancha(horarios: readonly HorarioPublicado[]): Record<number, Bloque[]> {
  const resultado: Record<number, Bloque[]> = {};
  for (const horario of horarios) {
    if (!horario.activo) continue;
    (resultado[horario.cancha_id] ??= []).push(conClave(horario, `h${horario.id}`));
  }
  for (const canchaId of Object.keys(resultado)) {
    resultado[Number(canchaId)] = ordenarBloques(resultado[Number(canchaId)]);
  }
  return resultado;
}

/** Lo que espera club_guardar_horarios. */
export function aPayload(bloques: readonly BloqueHorario[]): BloqueHorario[] {
  return ordenarBloques(bloques).map((bloque) => ({
    dia_semana: bloque.dia_semana,
    hora_inicio: bloque.hora_inicio,
    hora_fin: bloque.hora_fin,
    precio_total: Number(bloque.precio_total),
    precio_sena: Number(bloque.precio_sena),
  }));
}

/** Representación canónica para saber si hay cambios sin guardar. */
export function firmaBloques(bloques: readonly BloqueHorario[]): string {
  return aPayload(bloques)
    .map((b) => `${b.dia_semana}|${b.hora_inicio}|${b.hora_fin}|${b.precio_total}|${b.precio_sena}`)
    .join(';');
}

function rangoSemanal(bloque: BloqueHorario): [number, number] {
  const inicio = bloque.dia_semana * MINUTOS_DIA + horaAMinutos(bloque.hora_inicio);
  return [inicio, inicio + duracionBloque(bloque.hora_inicio, bloque.hora_fin)];
}

/** Superposición dentro de la semana, incluido el paso de sábado a domingo. */
export function seSuperponen(a: BloqueHorario, b: BloqueHorario): boolean {
  const [ai, af] = rangoSemanal(a);
  const [bi, bf] = rangoSemanal(b);
  return (ai < bf && bi < af)
    || (ai < bf + MINUTOS_SEMANA && bi + MINUTOS_SEMANA < af)
    || (ai + MINUTOS_SEMANA < bf && bi < af + MINUTOS_SEMANA);
}

/** Monto válido para el servidor: no negativo y con hasta dos decimales. */
export function esMonto(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0 && valor < 1e12 && Math.abs(Math.round(valor * 100) - valor * 100) < 1e-6;
}

/** Error de un bloque aislado (sin mirar los demás) o null. */
export function validarBloque(bloque: BloqueHorario): string | null {
  if (!Number.isInteger(bloque.dia_semana) || bloque.dia_semana < 0 || bloque.dia_semana > 6) return 'Elegí un día de la semana.';
  if (!esHora(bloque.hora_inicio) || !esHora(bloque.hora_fin)) return 'Completá la hora de inicio y de fin.';
  const duracion = duracionBloque(bloque.hora_inicio, bloque.hora_fin);
  if (duracion < DURACION_MINIMA || duracion > DURACION_MAXIMA) {
    return 'Cada bloque debe durar entre 30 minutos y 12 horas.';
  }
  if (!esMonto(bloque.precio_total) || !esMonto(bloque.precio_sena)) return 'Revisá los precios: tienen que ser montos válidos.';
  if (bloque.precio_sena > bloque.precio_total) return 'La seña no puede superar el precio.';
  return null;
}

/** Bloques de `otros` que se superponen con `bloque` (ignora el bloque con la misma clave). */
export function superposiciones<T extends BloqueHorario & { clave?: string }>(
  bloque: BloqueHorario & { clave?: string }, otros: readonly T[],
): T[] {
  if (validarBloque(bloque)) return [];
  return otros.filter((otro) => (bloque.clave === undefined || otro.clave !== bloque.clave)
    && !validarBloque(otro) && seSuperponen(bloque, otro));
}

export type ValidacionSemana = {
  /** Mensajes por clave de bloque. */
  porBloque: Record<string, string[]>;
  /** Problemas que no son de un bloque puntual. */
  generales: string[];
  /** Cantidad de mensajes, para el resumen. */
  total: number;
};

export function validarSemana(bloques: readonly Bloque[]): ValidacionSemana {
  const porBloque: Record<string, string[]> = {};
  const generales: string[] = [];
  const agregar = (clave: string, mensaje: string) => { (porBloque[clave] ??= []).push(mensaje); };

  const validos: Bloque[] = [];
  for (const bloque of bloques) {
    const error = validarBloque(bloque);
    if (error) agregar(bloque.clave, error);
    else validos.push(bloque);
  }
  for (let i = 0; i < validos.length; i += 1) {
    for (let j = i + 1; j < validos.length; j += 1) {
      if (seSuperponen(validos[i], validos[j])) {
        agregar(validos[i].clave, `Se superpone con ${describirBloque(validos[j])}.`);
        agregar(validos[j].clave, `Se superpone con ${describirBloque(validos[i])}.`);
      }
    }
  }
  if (bloques.length > MAXIMO_BLOQUES) {
    generales.push(`Una cancha puede tener hasta ${MAXIMO_BLOQUES} bloques por semana (hay ${bloques.length}).`);
  }
  const total = generales.length + Object.values(porBloque).reduce((suma, lista) => suma + lista.length, 0);
  return { porBloque, generales, total };
}

/** Agrega o reemplaza (por clave) un bloque. */
export function guardarBloque(bloques: readonly Bloque[], bloque: Bloque): Bloque[] {
  const existe = bloques.some((otro) => otro.clave === bloque.clave);
  return ordenarBloques(existe ? bloques.map((otro) => (otro.clave === bloque.clave ? bloque : otro)) : [...bloques, bloque]);
}

export function quitarBloque(bloques: readonly Bloque[], clave: string): Bloque[] {
  return bloques.filter((bloque) => bloque.clave !== clave);
}

/** "3 bloques · 18:00 a 24:00" o "Sin bloques". */
export function resumenDia(bloques: readonly BloqueHorario[], dia: number): string {
  const delDia = bloquesDelDia(bloques, dia);
  if (!delDia.length) return 'Sin bloques';
  const finEnMinutos = (b: BloqueHorario) => horaAMinutos(b.hora_inicio) + duracionBloque(b.hora_inicio, b.hora_fin);
  const ultimo = delDia.reduce((mayor, bloque) => (finEnMinutos(bloque) > finEnMinutos(mayor) ? bloque : mayor));
  const cantidad = delDia.length === 1 ? '1 bloque' : `${delDia.length} bloques`;
  const siguiente = terminaAlDiaSiguiente(ultimo) ? ' (día siguiente)' : '';
  return `${cantidad} · ${delDia[0].hora_inicio} a ${finVisible(ultimo)}${siguiente}`;
}

/**
 * Valores iniciales para un bloque nuevo: sigue al último bloque del día con la
 * misma duración y precios; si el día está vacío, copia el primero de la semana.
 */
export function sugerirBloque(
  bloques: readonly BloqueHorario[], dia: number, referencia: { precio_total: number; precio_sena: number },
): BloqueHorario {
  const delDia = bloquesDelDia(bloques, dia);
  const modelo = delDia[delDia.length - 1] ?? ordenarBloques(bloques)[0];
  if (!modelo) {
    return {
      dia_semana: dia,
      hora_inicio: '18:00',
      hora_fin: '20:00',
      precio_total: referencia.precio_total,
      precio_sena: Math.min(referencia.precio_sena, referencia.precio_total),
    };
  }
  const duracion = duracionBloque(modelo.hora_inicio, modelo.hora_fin) || 60;
  let inicio = horaAMinutos(modelo.hora_inicio) + (delDia.length ? duracion : 0);
  // Si el día ya llega a la medianoche, se propone el turno anterior al primero.
  if (inicio >= MINUTOS_DIA) inicio = Math.max(0, horaAMinutos(delDia[0].hora_inicio) - duracion);
  return {
    dia_semana: dia,
    hora_inicio: minutosAHora(inicio),
    hora_fin: minutosAHora(inicio + duracion),
    precio_total: modelo.precio_total,
    precio_sena: modelo.precio_sena,
  };
}

// ---------------------------------------------------------------------------
// Generador de bloques consecutivos
// ---------------------------------------------------------------------------

export type OpcionesGenerador = {
  dias: readonly number[];
  /** Hora de inicio del rango. */
  desde: string;
  /** Hora de fin; si es menor o igual que `desde`, termina al día siguiente. */
  hasta: string;
  duracion: number;
  precio: number;
  sena: number;
};

export type ResultadoGenerador = {
  bloques: BloqueHorario[];
  /** Bloques de un día (para la vista previa). */
  porDia: number;
  /** Minutos del rango que no alcanzan para un bloque completo. */
  sobrante: number;
  error: string | null;
};

/**
 * Bloques consecutivos dentro de un rango horario para cada día elegido. Los
 * bloques que empiezan después de medianoche se guardan en el día siguiente
 * (un turno del viernes de 00:00 a 02:00 es el sábado 00:00–02:00).
 */
export function generarBloques(opciones: OpcionesGenerador): ResultadoGenerador {
  const vacio = (error: string): ResultadoGenerador => ({ bloques: [], porDia: 0, sobrante: 0, error });
  if (!opciones.dias.length) return vacio('Elegí al menos un día.');
  if (!esHora(opciones.desde) || !esHora(opciones.hasta)) return vacio('Completá la hora de inicio y de fin del rango.');
  if (!Number.isInteger(opciones.duracion) || opciones.duracion < DURACION_MINIMA || opciones.duracion > DURACION_MAXIMA) {
    return vacio('La duración de cada bloque tiene que estar entre 30 minutos y 12 horas.');
  }
  if (!esMonto(opciones.precio) || !esMonto(opciones.sena)) return vacio('Revisá los precios: tienen que ser montos válidos.');
  if (opciones.sena > opciones.precio) return vacio('La seña no puede superar el precio.');

  const inicio = horaAMinutos(opciones.desde);
  let fin = horaAMinutos(opciones.hasta);
  if (fin <= inicio) fin += MINUTOS_DIA;
  const porDia = Math.floor((fin - inicio) / opciones.duracion);
  if (porDia === 0) return vacio('El rango es más corto que la duración de un bloque.');

  const dias = [...new Set(opciones.dias)].sort((a, b) => ordenDia(a) - ordenDia(b));
  const bloques: BloqueHorario[] = [];
  for (const dia of dias) {
    for (let i = 0; i < porDia; i += 1) {
      const desde = inicio + i * opciones.duracion;
      bloques.push({
        dia_semana: desde >= MINUTOS_DIA ? (dia + 1) % 7 : dia,
        hora_inicio: minutosAHora(desde),
        hora_fin: minutosAHora(desde + opciones.duracion),
        precio_total: opciones.precio,
        precio_sena: opciones.sena,
      });
    }
  }
  return { bloques, porDia, sobrante: fin - inicio - porDia * opciones.duracion, error: null };
}

export type ModoAplicacion = 'reemplazar' | 'agregar';

export type PlanCambio = {
  resultado: Bloque[];
  /** Bloques actuales que se quitan. */
  reemplazados: Bloque[];
  /** Bloques nuevos que chocan con otros que quedan. */
  conflictos: { nuevo: BloqueHorario; existente: BloqueHorario }[];
};

function conflictosEntre(nuevos: readonly BloqueHorario[], existentes: readonly Bloque[]): PlanCambio['conflictos'] {
  const conflictos: PlanCambio['conflictos'] = [];
  for (const nuevo of nuevos) {
    for (const existente of existentes) {
      if (seSuperponen(nuevo, existente)) conflictos.push({ nuevo, existente });
    }
  }
  return conflictos;
}

/**
 * Suma bloques generados a los actuales. En modo "reemplazar" se quitan los
 * bloques de los días elegidos y cualquier otro que se superponga con los
 * nuevos (por ejemplo, la madrugada del día siguiente).
 */
export function planGenerador(
  actuales: readonly Bloque[], generados: readonly BloqueHorario[], dias: readonly number[], modo: ModoAplicacion,
): PlanCambio {
  const reemplazados = modo === 'reemplazar'
    ? actuales.filter((bloque) => dias.includes(bloque.dia_semana) || generados.some((nuevo) => seSuperponen(nuevo, bloque)))
    : [];
  const quedan = actuales.filter((bloque) => !reemplazados.includes(bloque));
  return {
    resultado: ordenarBloques([...quedan, ...generados.map((bloque) => conClave(bloque))]),
    reemplazados: ordenarBloques(reemplazados),
    conflictos: conflictosEntre(generados, quedan),
  };
}

/** Copia los bloques de un día a otros, reemplazando lo que esos días tenían. */
export function planCopiarDia(actuales: readonly Bloque[], origen: number, destinos: readonly number[]): PlanCambio {
  const objetivo = destinos.filter((dia) => dia !== origen);
  const copias: BloqueHorario[] = objetivo.flatMap((dia) => bloquesDelDia(actuales, origen).map((bloque) => ({
    dia_semana: dia,
    hora_inicio: bloque.hora_inicio,
    hora_fin: bloque.hora_fin,
    precio_total: bloque.precio_total,
    precio_sena: bloque.precio_sena,
  })));
  const reemplazados = actuales.filter((bloque) => objetivo.includes(bloque.dia_semana));
  const quedan = actuales.filter((bloque) => !objetivo.includes(bloque.dia_semana));
  return {
    resultado: ordenarBloques([...quedan, ...copias.map((bloque) => conClave(bloque))]),
    reemplazados: ordenarBloques(reemplazados),
    conflictos: conflictosEntre(copias, quedan),
  };
}

/** Reemplaza toda la semana por una copia de los bloques de otra cancha. */
export function copiarSemana(origen: readonly BloqueHorario[]): Bloque[] {
  return ordenarBloques(aPayload(origen).map((bloque) => conClave(bloque)));
}

export const DIAS_EDITOR = DIAS_LUNES_A_DOMINGO;
export const nombreDia = (dia: number) => DIAS_SEMANA[dia];
export const nombreDiaCorto = (dia: number) => DIAS_SEMANA_CORTOS[dia];
