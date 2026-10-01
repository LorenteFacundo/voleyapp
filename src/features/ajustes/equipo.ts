// Roles del equipo de un club e invitaciones (el enlace se muestra una sola
// vez: el servidor guarda solo el hash del token).

import type { InvitacionCreada, RolClub } from '@/api/tipos';
import { fechaArgentina, formatFechaLarga } from '@/lib/date';

export const ROLES_CLUB: Record<RolClub, { etiqueta: string; resumen: string }> = {
  dueno: {
    etiqueta: 'Dueño',
    resumen: 'Puede hacer todo: agenda, clientes, fijos, caja, reportes y los ajustes del club (datos, canchas, horarios y equipo).',
  },
  encargado: {
    etiqueta: 'Encargado',
    resumen: 'Usa la agenda (carga y confirma reservas, bloquea horarios y registra cobros), los clientes y los fijos. '
      + 'No ve la caja ni los reportes y no puede cambiar los ajustes ni el equipo.',
  },
};

export function etiquetaRol(rol: RolClub): string {
  return ROLES_CLUB[rol].etiqueta;
}

export function enlaceInvitacion(token: string, origen: string = window.location.origin): string {
  return `${origen}/invitacion/${encodeURIComponent(token)}`;
}

export function vencimientoInvitacion(expiraAt: string): string {
  return formatFechaLarga(fechaArgentina(expiraAt));
}

/** Texto para compartir la invitación por WhatsApp. */
export function mensajeInvitacion(invitacion: Pick<InvitacionCreada, 'email' | 'rol' | 'expira_at'>, club: string, enlace: string): string {
  return `¡Hola! Te invito a sumarte al equipo de ${club} en VoleyApp como ${etiquetaRol(invitacion.rol).toLowerCase()}. `
    + `Para aceptar, entrá a este enlace con tu cuenta ${invitacion.email}: ${enlace} `
    + `(vence el ${vencimientoInvitacion(invitacion.expira_at)}).`;
}

/**
 * Compara un email con la versión enmascarada que devuelve el servidor
 * ("a•••@dominio.com"). null si no se puede saber.
 */
export function coincideEmailEnmascarado(enmascarado: string | null | undefined, email: string | null | undefined): boolean | null {
  if (!enmascarado || !email) return null;
  const partes = /^(.)•••(@.+)$/u.exec(enmascarado.trim().toLowerCase());
  if (!partes) return null;
  const propio = email.trim().toLowerCase();
  return propio.startsWith(partes[1]) && propio.endsWith(partes[2]) && propio.indexOf('@') === propio.lastIndexOf('@');
}
