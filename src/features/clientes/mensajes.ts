// Mensajes de WhatsApp pre-armados (el club los revisa antes de enviar).

import { formatMoney } from '@/lib/format';
import { limpiarTexto } from './validacion';

export type DatosPagoClub = {
  nombre: string;
  alias_pago: string | null;
  titular_pago: string | null;
};

function comoPagar(club: DatosPagoClub): string {
  const alias = limpiarTexto(club.alias_pago);
  if (!alias) return 'Podés abonarlo en el club la próxima vez que vengas.';
  const titular = limpiarTexto(club.titular_pago);
  return `Podés transferir al alias ${alias}${titular ? ` (a nombre de ${titular})` : ''} y avisarnos por acá.`;
}

export function mensajeSaludo(cliente: string, club: string): string {
  return `¡Hola, ${limpiarTexto(cliente)}! Te escribimos de ${limpiarTexto(club)}.`;
}

/** Recordatorio de deuda con el monto y el alias del club. */
export function mensajeCobro({ cliente, monto, club, motivo }: {
  cliente: string;
  monto: number;
  club: DatosPagoClub;
  /** Por ejemplo: "el fijo de los martes 19:00". */
  motivo?: string | null;
}): string {
  const motivoTexto = limpiarTexto(motivo);
  return [
    `¡Hola, ${limpiarTexto(cliente)}! Te escribimos de ${limpiarTexto(club.nombre)}${motivoTexto ? ` por ${motivoTexto}` : ''}.`,
    `Tenés un saldo pendiente de ${formatMoney(Math.abs(monto))}.`,
    comoPagar(club),
    '¡Gracias!',
  ].join(' ');
}

/** Aviso de devolución por una reserva cancelada que ya estaba paga. */
export function mensajeDevolucion({ cliente, monto, club, reserva }: {
  cliente: string;
  monto: number;
  club: string;
  /** Por ejemplo: "lun 6 oct · 19:00". */
  reserva: string;
}): string {
  return [
    `¡Hola, ${limpiarTexto(cliente)}! Te escribimos de ${limpiarTexto(club)} por la reserva del ${reserva}, que se canceló.`,
    `Te queremos devolver ${formatMoney(Math.abs(monto))}.`,
    '¿Nos pasás tu alias o CBU para transferirte?',
  ].join(' ');
}

export type TonoSaldo = 'debe' | 'favor' | 'neutro';

/** "Debe $ 12.000", "A favor $ 3.000" o "Al día". */
export function textoSaldo(saldo: number): { texto: string; tono: TonoSaldo } {
  if (saldo <= -0.005) return { texto: `Debe ${formatMoney(-saldo)}`, tono: 'debe' };
  if (saldo >= 0.005) return { texto: `A favor ${formatMoney(saldo)}`, tono: 'favor' };
  return { texto: 'Al día', tono: 'neutro' };
}
