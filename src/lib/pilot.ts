import { supabase } from './supabase';
import type { TurnoVirtual } from '@/types';

// This build flag only controls the pilot experience in the UI. Database RPCs
// remain the authorization and operations-pause boundary.
export const pilotBookingsEnabled = import.meta.env.VITE_PILOT_BOOKINGS_ENABLED === 'true';

export function requirePilotBookingsEnabled(): void {
  if (!pilotBookingsEnabled) {
    throw new Error('Las nuevas reservas e inscripciones están pausadas por el momento.');
  }
}

export async function solicitarReserva(canchaId: number, turno: TurnoVirtual, inicio: string, fin: string) {
  requirePilotBookingsEnabled();
  const { error } = await supabase.rpc('pilot_solicitar_reserva', {
    p_cancha_id: canchaId, p_fecha: turno.fecha, p_hora_inicio: inicio, p_hora_fin: fin,
  });
  if (error) throw new Error(error.message);
  return { pending: true };
}

export async function solicitarPartido(canchaId: number, turno: TurnoVirtual, inicio: string,
  fin: string, min: number, max: number, invitados: number, nivel: string, aprobacion: boolean) {
  requirePilotBookingsEnabled();
  const { error } = await supabase.rpc('pilot_solicitar_partido', {
    p_cancha_id: canchaId, p_fecha: turno.fecha, p_hora_inicio: inicio, p_hora_fin: fin,
    p_cupo_minimo: min, p_cupo_maximo: max, p_invitados: invitados,
    p_nivel: nivel, p_requiere_aprobacion: aprobacion,
  });
  if (error) throw new Error(error.message);
  return { pending: true };
}
