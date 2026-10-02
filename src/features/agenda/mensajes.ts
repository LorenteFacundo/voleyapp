// Mensajes de WhatsApp que el club le manda a sus clientes desde la agenda.

import {
  DIAS_SEMANA, diaSemana, diferenciaEnDias, fechaArgentina, horaArgentina,
} from '@/lib/date';
import { montoCorto } from './presentacion';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export type DatosTurno = {
  club: string;
  /** Nombre del cliente (se usa el primero para saludar). */
  nombre: string | null;
  cancha: string;
  inicio: string;
  fin: string;
  hoy: string;
};

/** "hoy", "mañana" o "el jueves 9 de octubre". */
export function diaParaMensaje(fecha: string, hoy: string): string {
  const diferencia = diferenciaEnDias(hoy, fecha);
  if (diferencia === 0) return 'hoy';
  if (diferencia === 1) return 'mañana';
  const mes = MESES[Number(fecha.slice(5, 7)) - 1];
  return `el ${DIAS_SEMANA[diaSemana(fecha)].toLowerCase()} ${Number(fecha.slice(8, 10))} de ${mes}`;
}

/** "hoy de 19:00 a 21:00". */
export function cuandoParaMensaje(inicio: string, fin: string, hoy: string): string {
  return `${diaParaMensaje(fechaArgentina(inicio), hoy)} de ${horaArgentina(inicio)} a ${horaArgentina(fin)}`;
}

function saludo(nombre: string | null): string {
  const primero = nombre?.trim().split(/\s+/)[0];
  return primero ? `¡Hola ${primero}!` : '¡Hola!';
}

function sinPuntoFinal(texto: string): string {
  return texto.trim().replace(/[.!\s]+$/, '');
}

export function mensajeConfirmacion(datos: DatosTurno): string {
  return `${saludo(datos.nombre)} Te confirmamos la reserva en ${datos.club}: ${datos.cancha}, `
    + `${cuandoParaMensaje(datos.inicio, datos.fin, datos.hoy)}. ¡Te esperamos! 🏐`;
}

export function mensajeRecordatorio(datos: DatosTurno): string {
  return `${saludo(datos.nombre)} Te recordamos tu reserva en ${datos.club}: ${datos.cancha}, `
    + `${cuandoParaMensaje(datos.inicio, datos.fin, datos.hoy)}. ¡Nos vemos en la cancha! 🏐`;
}

export function mensajeCobro(datos: DatosTurno & { restante: number; alias: string | null; titular: string | null }): string {
  const partes = [
    `${saludo(datos.nombre)} Te escribimos de ${datos.club} por la reserva de ${datos.cancha}, `
      + `${cuandoParaMensaje(datos.inicio, datos.fin, datos.hoy)}.`,
    `Quedan ${montoCorto(datos.restante)} por abonar.`,
  ];
  if (datos.alias) {
    partes.push(`Podés transferir al alias ${datos.alias}${datos.titular ? ` (a nombre de ${datos.titular})` : ''}.`);
  }
  partes.push('¡Gracias!');
  return partes.join(' ');
}

export function mensajeCancelacion(datos: DatosTurno & { motivo: string | null; pagado: number }): string {
  const partes = [
    `${saludo(datos.nombre)} Te escribimos de ${datos.club}: tuvimos que cancelar tu reserva de ${datos.cancha}, `
      + `${cuandoParaMensaje(datos.inicio, datos.fin, datos.hoy)}.`,
  ];
  if (datos.motivo?.trim()) partes.push(`Motivo: ${sinPuntoFinal(datos.motivo)}.`);
  if (datos.pagado > 0) partes.push(`Coordinemos la devolución de los ${montoCorto(datos.pagado)} que abonaste.`);
  partes.push('Perdón por las molestias.');
  return partes.join(' ');
}

export function mensajePartido(datos: {
  club: string;
  cancha: string;
  inicio: string;
  fin: string;
  hoy: string;
  nivel: string;
  precioPorJugador: number;
  cupoMaximo: number;
  enlace: string;
}): string {
  const cuando = cuandoParaMensaje(datos.inicio, datos.fin, datos.hoy);
  const precio = datos.precioPorJugador > 0 ? `${montoCorto(datos.precioPorJugador)} por jugador` : 'Sin cargo';
  return [
    `🏐 Partido abierto en ${datos.club}`,
    `${cuando.charAt(0).toUpperCase()}${cuando.slice(1)} · ${datos.cancha}`,
    `Nivel ${datos.nivel.toLowerCase()} · ${precio} · hasta ${datos.cupoMaximo} jugadores`,
    '',
    `Anotate acá: ${datos.enlace}`,
  ].join('\n');
}
