import type { NivelPartido } from '@/lib/nivel';
import { etiquetaNivelPartido } from '@/lib/nivel';
import { horaArgentina } from '@/lib/date';
import { formatMoney, pluralizar } from '@/lib/format';
import { capitalizar, fechaLargaDeInstante } from '@/features/jugador/fechas';
import type { PrecioJugador } from './cupo';

/** Enlace de invitación que se comparte (resuelve el partido por token). */
export function enlaceInvitacion(origen: string, token: string): string {
  return `${origen.replace(/\/+$/, '')}/partido/invitar/${encodeURIComponent(token)}`;
}

/** Texto listo para mandar por WhatsApp invitando a un partido. */
export function textoInvitacion(datos: {
  clubNombre: string;
  zona?: string | null;
  canchaTitulo: string;
  inicio: string;
  fin: string;
  nivel: NivelPartido;
  faltanParaMinimo: number;
  libres: number;
  precio: PrecioJugador | null;
  enlace: string;
}): string {
  const lineas = [
    '¡Sumate a jugar vóley! 🏐',
    `${capitalizar(fechaLargaDeInstante(datos.inicio))}, de ${horaArgentina(datos.inicio)} a ${horaArgentina(datos.fin)}.`,
    `${datos.clubNombre}${datos.zona ? ` (${datos.zona})` : ''} · ${datos.canchaTitulo}.`,
    `Nivel ${etiquetaNivelPartido(datos.nivel).toLowerCase()}.`,
  ];
  if (datos.faltanParaMinimo > 0) {
    lineas.push(`Faltan ${pluralizar(datos.faltanParaMinimo, 'jugador', 'jugadores')} para armarlo.`);
  } else if (datos.libres > 0) {
    lineas.push(datos.libres === 1 ? 'Queda 1 lugar.' : `Quedan ${datos.libres} lugares.`);
  }
  if (datos.precio) {
    lineas.push(datos.precio.monto > 0
      ? `${datos.precio.estimado ? 'Aprox. ' : ''}${formatMoney(datos.precio.monto)} por persona.`
      : 'Sin costo para jugadores.');
  }
  lineas.push(`Anotate acá: ${datos.enlace}`);
  return lineas.join('\n');
}
