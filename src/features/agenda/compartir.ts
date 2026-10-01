// Texto de "turnos libres" listo para pegar en WhatsApp (estados, grupos, listas de difusión).

import type { BloqueDisponible, HorarioPublicado, Ocupacion } from '@/api/tipos';
import {
  addDaysToISODate, DIAS_SEMANA, diaSemana, diferenciaEnDias, instanteArgentina,
} from '@/lib/date';
import { horariosDelDia } from './layout';
import { esActiva, montoCorto, unirConY } from './presentacion';

export type LibreCompartible = {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  canchaId: number;
  precio: number;
};

/** Bloques libres según la disponibilidad pública (respeta anticipación y ventana del club). */
export function libresDeDisponibilidad(bloques: BloqueDisponible[]): LibreCompartible[] {
  return bloques
    .filter((bloque) => bloque.estado === 'libre')
    .map((bloque) => ({
      fecha: bloque.fecha,
      horaInicio: bloque.hora_inicio.slice(0, 5),
      horaFin: bloque.hora_fin.slice(0, 5),
      canchaId: bloque.cancha_id,
      precio: Number(bloque.precio),
    }));
}

/**
 * Bloques publicados que todavía no empezaron y no tienen ninguna ocupación
 * activa encima, calculados con la agenda del club. Se usa cuando el club
 * todavía no está publicado (la disponibilidad pública no lo incluye).
 */
export function libresCalculados(params: {
  horarios: HorarioPublicado[];
  canchas: ReadonlySet<number>;
  ocupaciones: Pick<Ocupacion, 'cancha_id' | 'inicio' | 'fin' | 'estado'>[];
  desde: string;
  hasta: string;
  ahora: number;
}): LibreCompartible[] {
  const { horarios, canchas, ocupaciones, desde, hasta, ahora } = params;
  const activas = ocupaciones
    .filter((ocupacion) => esActiva(ocupacion))
    .map((ocupacion) => ({ canchaId: ocupacion.cancha_id, inicio: Date.parse(ocupacion.inicio), fin: Date.parse(ocupacion.fin) }));
  const libres: LibreCompartible[] = [];
  for (let fecha = desde; fecha <= hasta; fecha = addDaysToISODate(fecha, 1)) {
    for (const horario of horariosDelDia(horarios, diaSemana(fecha), canchas)) {
      const horaInicio = horario.hora_inicio.slice(0, 5);
      const horaFin = horario.hora_fin.slice(0, 5);
      const inicio = Date.parse(instanteArgentina(fecha, horaInicio));
      const fin = Date.parse(instanteArgentina(horaFin <= horaInicio ? addDaysToISODate(fecha, 1) : fecha, horaFin));
      // Un turno que ya empezó no se ofrece.
      if (inicio <= ahora) continue;
      const ocupado = activas.some((o) => o.canchaId === horario.cancha_id && o.inicio < fin && o.fin > inicio);
      if (!ocupado) libres.push({ fecha, horaInicio, horaFin, canchaId: horario.cancha_id, precio: Number(horario.precio_total) });
    }
  }
  return libres;
}

/** "Hoy jueves 9", "Mañana viernes 10", "Sábado 11". */
export function encabezadoDeDia(fecha: string, hoy: string): string {
  const nombre = DIAS_SEMANA[diaSemana(fecha)];
  const numero = Number(fecha.slice(8, 10));
  const diferencia = diferenciaEnDias(hoy, fecha);
  if (diferencia === 0) return `Hoy ${nombre.toLowerCase()} ${numero}`;
  if (diferencia === 1) return `Mañana ${nombre.toLowerCase()} ${numero}`;
  return `${nombre} ${numero}`;
}

/**
 * Arma el mensaje agrupado por día. Los turnos del mismo horario y precio en
 * varias canchas van en una sola línea. Devuelve null si no hay turnos.
 */
export function textoTurnosLibres(params: {
  club: string;
  libres: LibreCompartible[];
  canchas: { id: number; titulo: string }[];
  hoy: string;
  /** Línea final (por ejemplo, "Reservá acá: https://…"). */
  cierre: string | null;
}): string | null {
  const { club, libres, canchas, hoy, cierre } = params;
  if (!libres.length) return null;
  const orden = new Map(canchas.map((cancha, indice) => [cancha.id, indice]));
  const titulos = new Map(canchas.map((cancha) => [cancha.id, cancha.titulo]));
  const ordenados = [...libres].sort((a, b) => a.fecha.localeCompare(b.fecha)
    || a.horaInicio.localeCompare(b.horaInicio)
    || a.horaFin.localeCompare(b.horaFin)
    || (orden.get(a.canchaId) ?? 999) - (orden.get(b.canchaId) ?? 999));

  const lineas = [`🏐 Turnos libres en ${club}`];
  let diaActual: string | null = null;
  let grupos: { horaInicio: string; horaFin: string; precio: number; canchas: string[] }[] = [];

  const volcar = () => {
    for (const grupo of grupos) {
      const precio = grupo.precio > 0 ? ` (${montoCorto(grupo.precio)})` : '';
      lineas.push(`• ${grupo.horaInicio}–${grupo.horaFin} ${unirConY(grupo.canchas)}${precio}`);
    }
    grupos = [];
  };

  for (const libre of ordenados) {
    if (libre.fecha !== diaActual) {
      volcar();
      diaActual = libre.fecha;
      lineas.push('', `*${encabezadoDeDia(libre.fecha, hoy)}*`);
    }
    const titulo = titulos.get(libre.canchaId) ?? 'Cancha';
    const grupo = grupos.find((g) => g.horaInicio === libre.horaInicio && g.horaFin === libre.horaFin && g.precio === libre.precio);
    if (grupo) {
      if (!grupo.canchas.includes(titulo)) grupo.canchas.push(titulo);
    } else {
      grupos.push({ horaInicio: libre.horaInicio, horaFin: libre.horaFin, precio: libre.precio, canchas: [titulo] });
    }
  }
  volcar();
  if (cierre) lineas.push('', cierre);
  return lineas.join('\n');
}
