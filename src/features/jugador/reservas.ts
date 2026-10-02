import type { EstadoOcupacion, EstadoPago, MiReserva } from '@/api/tipos';
import { horaArgentina } from '@/lib/date';
import { fechaLargaDeInstante } from './fechas';

// Lógica pura de "Mis reservas": textos de estado, pagos, cuenta regresiva y
// mensajes para escribirle al club.

export function esReservaActiva(reserva: Pick<MiReserva, 'estado'>): boolean {
  return reserva.estado === 'pendiente' || reserva.estado === 'confirmada';
}

export type PresentacionEstado = { etiqueta: string; detalle: string | null };

function conMotivo(texto: string, motivo: string | null | undefined): string {
  const limpio = motivo?.trim();
  return limpio ? `${texto} Motivo: ${limpio}` : texto;
}

export function presentarEstadoReserva(
  reserva: Pick<MiReserva, 'estado' | 'cancelada_por' | 'motivo_cancelacion'>,
): PresentacionEstado {
  switch (reserva.estado) {
    case 'pendiente':
      return { etiqueta: 'Esperando al club', detalle: null };
    case 'confirmada':
      return { etiqueta: 'Confirmada', detalle: null };
    case 'rechazada':
      return { etiqueta: 'Rechazada', detalle: conMotivo('El club no pudo confirmarla.', reserva.motivo_cancelacion) };
    case 'vencida':
      return { etiqueta: 'Vencida', detalle: 'El club no respondió a tiempo. Podés pedir otro horario.' };
    case 'cancelada': {
      const quien = reserva.cancelada_por === 'jugador' ? 'La cancelaste vos.'
        : reserva.cancelada_por === 'club' ? 'La canceló el club.'
          : 'Se canceló automáticamente.';
      return { etiqueta: 'Cancelada', detalle: conMotivo(quien, reserva.motivo_cancelacion) };
    }
  }
}

const ETIQUETAS_PAGO: Record<EstadoPago, string> = {
  pendiente: 'Sin pagar',
  parcial: 'Pago parcial',
  pagado: 'Pagada',
  sin_cargo: 'Sin cargo',
  a_devolver: 'A devolver',
};

export function etiquetaPago(reserva: Pick<MiReserva, 'estado_pago' | 'sena' | 'pagado'>): string {
  if (reserva.estado_pago === 'parcial' && reserva.sena > 0 && reserva.pagado >= reserva.sena) return 'Seña pagada';
  return ETIQUETAS_PAGO[reserva.estado_pago];
}

export type Transferencia = { concepto: 'seña' | 'saldo'; monto: number };

/** Qué conviene transferir ahora: lo que falta de la seña o, si no hay seña, el saldo. */
export function montoATransferir(reserva: Pick<MiReserva, 'precio' | 'sena' | 'pagado'>): Transferencia | null {
  const pagado = Math.max(0, Number(reserva.pagado) || 0);
  const sena = Number(reserva.sena) || 0;
  const precio = Number(reserva.precio) || 0;
  if (sena > 0 && pagado < sena) return { concepto: 'seña', monto: sena - pagado };
  if (precio > pagado) return { concepto: 'saldo', monto: precio - pagado };
  return null;
}

/** El botón "Ya transferí" tiene sentido si la reserva sigue activa y queda algo por pagar. */
export function puedeInformarPago(
  reserva: Pick<MiReserva, 'estado' | 'estado_pago' | 'precio' | 'sena' | 'pagado' | 'pago_informado_at'>,
): boolean {
  return esReservaActiva(reserva)
    && (reserva.estado_pago === 'pendiente' || reserva.estado_pago === 'parcial')
    && !reserva.pago_informado_at
    && montoATransferir(reserva) !== null;
}

/** "3 h 20 min", "menos de 1 min", "2 días 4 h". null si ya pasó. */
export function tiempoRestante(hasta: string, ahora: Date): string | null {
  const minutos = Math.floor((new Date(hasta).getTime() - ahora.getTime()) / 60_000);
  if (Number.isNaN(minutos) || minutos < 0) return null;
  if (minutos < 1) return 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return resto ? `${horas} h ${resto} min` : `${horas} h`;
  }
  const dias = Math.floor(horas / 24);
  const restoHoras = horas % 24;
  return `${dias} ${dias === 1 ? 'día' : 'días'}${restoHoras ? ` ${restoHoras} h` : ''}`;
}

/** La primera reserva activa que todavía no terminó. */
export function proximaReserva(reservas: MiReserva[], ahora: Date): MiReserva | null {
  return reservas
    .filter((reserva) => esReservaActiva(reserva) && new Date(reserva.fin).getTime() > ahora.getTime())
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())[0] ?? null;
}

/** "Cancha 1, jueves 2 de octubre de 20:00 a 22:00" */
export function detalleTurno(cancha: string, inicio: string, fin: string): string {
  return `${cancha}, ${fechaLargaDeInstante(inicio)} de ${horaArgentina(inicio)} a ${horaArgentina(fin)}`;
}

export type MotivoMensaje = 'pedido_nuevo' | 'pedido' | 'reserva' | 'cancelar';

/** Mensaje para escribirle al club por WhatsApp sobre un turno. */
export function mensajeWhatsAppTurno(datos: {
  motivo: MotivoMensaje; nombre?: string | null; cancha: string; inicio: string; fin: string;
}): string {
  const nombre = datos.nombre?.trim();
  const saludo = nombre ? `Hola, soy ${nombre}.` : 'Hola.';
  const detalle = detalleTurno(datos.cancha, datos.inicio, datos.fin);
  const cuerpo = {
    pedido_nuevo: `Acabo de pedir por VoleyApp: ${detalle}. ¡Gracias!`,
    pedido: `Te escribo por el pedido que hice en VoleyApp: ${detalle}.`,
    reserva: `Te escribo por mi reserva de VoleyApp: ${detalle}.`,
    cancelar: `Necesito cancelar mi reserva de VoleyApp: ${detalle}.`,
  }[datos.motivo];
  return `${saludo} ${cuerpo}`;
}

export function motivoMensaje(estado: EstadoOcupacion): MotivoMensaje {
  return estado === 'pendiente' ? 'pedido' : 'reserva';
}
