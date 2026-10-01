// Cómo se nombra y se ve cada ocupación en la agenda. Lógica pura y probada.

import type { EstadoOcupacion, EstadoPago, MedioPago, Ocupacion, OrigenOcupacion } from '@/api/tipos';
import { formatMoney } from '@/lib/format';
import { fechaArgentina, formatFechaHora, horaArgentina } from '@/lib/date';

export type Apariencia = 'pendiente' | 'app' | 'manual' | 'fijo' | 'bloqueo' | 'cancelada';

export const ETIQUETA_APARIENCIA: Record<Apariencia, string> = {
  pendiente: 'Pedido pendiente',
  app: 'Reserva desde la app',
  manual: 'Cargada por el club',
  fijo: 'Turno fijo',
  bloqueo: 'Bloqueo',
  cancelada: 'Cancelada',
};

export const ETIQUETA_ORIGEN: Record<OrigenOcupacion, string> = {
  app: 'App',
  whatsapp: 'WhatsApp',
  telefono: 'Teléfono',
  mostrador: 'Mostrador',
  fijo: 'Turno fijo',
  otro: 'Otro',
};

export const ETIQUETA_ESTADO: Record<EstadoOcupacion, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
};

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: 'Sin pagar',
  parcial: 'Pago parcial',
  pagado: 'Pagado',
  sin_cargo: 'Sin cargo',
  a_devolver: 'A devolver',
};

export const MEDIOS_PAGO: { value: MedioPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'otro', label: 'Otro' },
];

/** Orígenes que el club puede elegir al cargar una reserva. */
export const ORIGENES_MANUALES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'mostrador', label: 'Mostrador' },
  { value: 'otro', label: 'Otro' },
] as const;

export type OrigenManual = (typeof ORIGENES_MANUALES)[number]['value'];

export function esActiva(ocupacion: Pick<Ocupacion, 'estado'>): boolean {
  return ocupacion.estado === 'pendiente' || ocupacion.estado === 'confirmada';
}

export function esFijo(ocupacion: Pick<Ocupacion, 'origen' | 'serie_id'>): boolean {
  return ocupacion.origen === 'fijo' || ocupacion.serie_id != null;
}

export function aparienciaDe(ocupacion: Ocupacion): Apariencia {
  if (!esActiva(ocupacion)) return 'cancelada';
  if (ocupacion.tipo === 'bloqueo') return 'bloqueo';
  if (ocupacion.estado === 'pendiente') return 'pendiente';
  if (esFijo(ocupacion)) return 'fijo';
  if (ocupacion.origen === 'app') return 'app';
  return 'manual';
}

/** Nombre principal: cliente, jugador o título (bloqueos: el motivo). */
export function nombreDeOcupacion(ocupacion: Ocupacion): string {
  if (ocupacion.tipo === 'bloqueo') return ocupacion.titulo?.trim() || 'Bloqueo';
  return ocupacion.cliente?.nombre?.trim()
    || ocupacion.jugador?.nombre?.trim()
    || ocupacion.titulo?.trim()
    || 'Reserva sin nombre';
}

/** Título adicional cuando la reserva tiene cliente y además un título ("Clase"). */
export function subtituloDeOcupacion(ocupacion: Ocupacion): string | null {
  if (ocupacion.tipo === 'bloqueo') return null;
  const titulo = ocupacion.titulo?.trim();
  if (!titulo) return null;
  return titulo === nombreDeOcupacion(ocupacion) ? null : titulo;
}

export function telefonoDeOcupacion(ocupacion: Ocupacion): string | null {
  return ocupacion.cliente?.telefono || ocupacion.jugador?.telefono || null;
}

export function usaLaApp(ocupacion: Ocupacion): boolean {
  return !!ocupacion.cliente?.es_usuario_app || !!ocupacion.jugador;
}

/**
 * La app solo avisa sola a jugadores con cuenta y en reservas sueltas; para
 * el resto (sin cuenta o turnos fijos) el club tiene que escribir.
 */
export function requiereAvisoManual(ocupacion: Ocupacion): boolean {
  if (ocupacion.tipo !== 'reserva' || !telefonoDeOcupacion(ocupacion)) return false;
  return !usaLaApp(ocupacion) || ocupacion.serie_id != null;
}

export function saldoDe(ocupacion: Pick<Ocupacion, 'precio' | 'pagado'>): number {
  return Math.max(0, Number(ocupacion.precio) - Number(ocupacion.pagado));
}

/** Reserva confirmada que ya empezó y no está paga del todo. */
export function debe(ocupacion: Ocupacion, ahora: number): boolean {
  return ocupacion.tipo === 'reserva'
    && ocupacion.estado === 'confirmada'
    && Date.parse(ocupacion.inicio) <= ahora
    && Number(ocupacion.pagado) < Number(ocupacion.precio);
}

/** El jugador avisó que transfirió y el club todavía no registró el pago completo. */
export function informoPago(ocupacion: Ocupacion): boolean {
  return !!ocupacion.pago_informado_at && esActiva(ocupacion) && Number(ocupacion.pagado) < Number(ocupacion.precio);
}

/** "$30.000" (sin espacio, para textos breves y mensajes). */
export function montoCorto(valor: number | string | null | undefined): string {
  return formatMoney(valor).replace(/^(-?)\$\s/, '$1$');
}

/** "A, B y C". */
export function unirConY(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

export type CuentaRegresiva = { texto: string; corto: string; urgente: boolean; vencida: boolean };

/** Tiempo que le queda a un pedido para ser respondido. */
export function cuentaRegresiva(venceAt: string, ahora: number): CuentaRegresiva {
  const restante = Date.parse(venceAt) - ahora;
  if (!Number.isFinite(restante) || restante <= 0) {
    return { texto: 'Venció el plazo para responder', corto: 'Vencido', urgente: true, vencida: true };
  }
  const minutos = Math.ceil(restante / 60_000);
  if (minutos < 60) return { texto: `Vence en ${minutos} min`, corto: `${minutos} min`, urgente: true, vencida: false };
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 24) {
    const texto = resto ? `${horas} h ${resto} min` : `${horas} h`;
    return { texto: `Vence en ${texto}`, corto: `${horas} h`, urgente: horas < 2, vencida: false };
  }
  const dias = Math.floor(horas / 24);
  return { texto: `Vence en ${dias} día${dias === 1 ? '' : 's'}`, corto: `${dias} d`, urgente: false, vencida: false };
}

/** Texto para lectores de pantalla de un bloque de la grilla o una fila de la lista. */
export function descripcionOcupacion(ocupacion: Ocupacion, cancha: string, ahora: number): string {
  const variosDias = fechaArgentina(ocupacion.inicio) !== fechaArgentina(new Date(Date.parse(ocupacion.fin) - 1));
  const horario = variosDias
    ? `desde el ${formatFechaHora(ocupacion.inicio)} hasta el ${formatFechaHora(ocupacion.fin)}`
    : `de ${horaArgentina(ocupacion.inicio)} a ${horaArgentina(ocupacion.fin)}`;
  if (ocupacion.tipo === 'bloqueo') return `Bloqueo: ${nombreDeOcupacion(ocupacion)}, ${horario}, ${cancha}`;
  const partes = [horario, cancha, nombreDeOcupacion(ocupacion)];
  const subtitulo = subtituloDeOcupacion(ocupacion);
  if (subtitulo) partes.push(subtitulo);
  if (!esActiva(ocupacion)) {
    partes.push(ETIQUETA_ESTADO[ocupacion.estado].toLowerCase());
  } else if (ocupacion.estado === 'pendiente') {
    partes.push('pedido pendiente');
    if (ocupacion.vence_at) partes.push(cuentaRegresiva(ocupacion.vence_at, ahora).texto.toLowerCase());
  } else {
    partes.push(ETIQUETA_APARIENCIA[aparienciaDe(ocupacion)].toLowerCase());
    if (ocupacion.origen !== 'app' && ocupacion.origen !== 'fijo') partes.push(`por ${ETIQUETA_ORIGEN[ocupacion.origen]}`);
  }
  if (ocupacion.partido) {
    partes.push(`partido con ${ocupacion.partido.ocupados} de ${ocupacion.partido.cupo_maximo} jugadores`);
  }
  if (debe(ocupacion, ahora)) partes.push(`debe ${montoCorto(saldoDe(ocupacion))}`);
  else if (informoPago(ocupacion)) partes.push('avisó que transfirió');
  return partes.join(', ');
}
