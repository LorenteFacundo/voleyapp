// Textos amables para el registro de actividad del club (auditoría).

import type { EventoAuditoria } from '@/api/tipos';
import { esFechaISO, formatFechaCorta, formatFechaHora } from '@/lib/date';
import { formatMoney, pluralizar } from '@/lib/format';
import { etiquetaMedio, etiquetaOrigen } from '@/features/caja/etiquetas';

const TITULOS: Record<string, string> = {
  'reserva.crear': 'Cargó una reserva',
  'reserva.solicitar': 'Pidió una reserva desde la app',
  'reserva.confirmar': 'Confirmó una solicitud',
  'reserva.rechazar': 'Rechazó una solicitud',
  'reserva.cancelar_club': 'Canceló una reserva',
  'reserva.cancelar_jugador': 'Canceló su reserva desde la app',
  'reserva.mover': 'Movió una reserva',
  'reserva.editar': 'Editó una reserva',
  'agenda.bloquear': 'Bloqueó canchas',
  'agenda.desbloquear': 'Quitó un bloqueo',
  'pago.registrar': 'Registró un pago',
  'pago.anular': 'Anuló un pago',
  'cliente.crear': 'Agregó un cliente',
  'cliente.editar': 'Editó un cliente',
  'fijo.crear': 'Creó un fijo',
  'fijo.editar': 'Modificó un fijo',
  'fijo.reprogramar': 'Cambió el horario de un fijo',
  'fijo.finalizar': 'Terminó un fijo',
  'club.crear': 'Creó el club',
  'club.configurar': 'Cambió la configuración del club',
  'cancha.crear': 'Agregó una cancha',
  'cancha.editar': 'Editó una cancha',
  'horarios.guardar': 'Actualizó los horarios',
  'equipo.invitar': 'Invitó a alguien al equipo',
  'equipo.revocar_invitacion': 'Revocó una invitación',
  'equipo.aceptar_invitacion': 'Se sumó al equipo',
  'equipo.cambiar_rol': 'Cambió el rol de alguien del equipo',
  'equipo.quitar': 'Quitó a alguien del equipo',
  'partido.publicar': 'Publicó un partido abierto',
};

const ROLES: Record<string, string> = { dueno: 'dueño', encargado: 'encargado' };

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function numero(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() ? Number(valor) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function instante(valor: unknown): string | null {
  const t = texto(valor);
  return t && !Number.isNaN(Date.parse(t)) ? formatFechaHora(t) : null;
}

function fecha(valor: unknown): string | null {
  const t = texto(valor);
  return t && esFechaISO(t) ? formatFechaCorta(t) : null;
}

function unir(...partes: (string | null | false | undefined)[]): string | null {
  const presentes = partes.filter((parte): parte is string => !!parte);
  return presentes.length ? presentes.join(' · ') : null;
}

function registro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}

/** Título y detalle legibles para un evento de auditoría. */
export function describirEvento(evento: Pick<EventoAuditoria, 'accion' | 'detalle'>): { titulo: string; detalle: string | null } {
  const d = registro(evento.detalle);
  const titulo = TITULOS[evento.accion] ?? 'Hizo un cambio';

  switch (evento.accion) {
    case 'pago.registrar': {
      const monto = numero(d.monto);
      const medio = texto(d.medio);
      return {
        titulo: monto !== null && monto < 0 ? 'Registró una devolución' : titulo,
        detalle: unir(monto !== null && formatMoney(Math.abs(monto)), medio && etiquetaMedio(medio)),
      };
    }
    case 'pago.anular': {
      const monto = numero(d.monto);
      const medio = texto(d.medio);
      return { titulo, detalle: unir(monto !== null && formatMoney(monto), medio && etiquetaMedio(medio)) };
    }
    case 'reserva.crear': {
      const origen = texto(d.origen);
      return { titulo, detalle: unir(instante(d.inicio), origen && `por ${etiquetaOrigen(origen)}`) };
    }
    case 'reserva.solicitar':
      return { titulo, detalle: texto(d.estado) === 'confirmada' ? 'Se confirmó automáticamente' : 'Quedó pendiente de confirmar' };
    case 'reserva.mover': {
      const nuevo = instante(registro(d.despues).inicio);
      return { titulo, detalle: nuevo ? `Ahora: ${nuevo}` : null };
    }
    case 'reserva.editar': {
      const precio = numero(d.precio);
      const sena = numero(d.sena);
      const asistencia = texto(d.asistencia);
      return {
        titulo,
        detalle: unir(
          precio !== null && `Precio ${formatMoney(precio)}`,
          sena !== null && `Seña ${formatMoney(sena)}`,
          asistencia === 'no_vinieron' && 'Marcó que no vinieron',
          asistencia === 'jugaron' && 'Marcó que jugaron',
          'titulo' in d && 'Título',
          'notas' in d && 'Notas',
          'cliente_id' in d && 'Cliente',
        ),
      };
    }
    case 'reserva.rechazar':
    case 'reserva.cancelar_club':
    case 'reserva.cancelar_jugador':
      return { titulo, detalle: unir(texto(d.motivo) && `Motivo: ${texto(d.motivo)}`) };
    case 'agenda.bloquear': {
      const canceladas = numero(d.reservas_canceladas);
      return {
        titulo,
        detalle: unir(texto(d.motivo), instante(d.inicio),
          !!canceladas && `canceló ${pluralizar(canceladas, 'reserva')}`),
      };
    }
    case 'fijo.crear': {
      const creadas = numero(d.creadas);
      const conflictos = Array.isArray(d.conflictos) ? d.conflictos.length : 0;
      return {
        titulo,
        detalle: unir(creadas !== null && pluralizar(creadas, 'fecha generada', 'fechas generadas'),
          conflictos > 0 && pluralizar(conflictos, 'fecha omitida', 'fechas omitidas')),
      };
    }
    case 'fijo.editar': {
      const precio = numero(d.precio);
      return { titulo, detalle: unir(precio !== null && `Precio ${formatMoney(precio)}`, fecha(d.desde) && `desde el ${fecha(d.desde)}`) };
    }
    case 'fijo.reprogramar':
    case 'fijo.finalizar': {
      const canceladas = numero(d.canceladas);
      return {
        titulo,
        detalle: unir(fecha(d.desde) && `Desde el ${fecha(d.desde)}`,
          !!canceladas && `${pluralizar(canceladas, 'fecha liberada', 'fechas liberadas')}`),
      };
    }
    case 'cancha.crear':
    case 'cancha.editar':
    case 'club.crear':
      return { titulo, detalle: texto(d.titulo) ?? texto(d.nombre) };
    case 'horarios.guardar': {
      const bloques = numero(d.bloques);
      return { titulo, detalle: bloques !== null ? pluralizar(bloques, 'bloque') : null };
    }
    case 'equipo.invitar': {
      const rol = texto(d.rol);
      return { titulo, detalle: unir(texto(d.email), rol && `como ${ROLES[rol] ?? rol}`) };
    }
    case 'equipo.cambiar_rol':
    case 'equipo.aceptar_invitacion': {
      const rol = texto(d.rol);
      return { titulo, detalle: rol ? `Rol: ${ROLES[rol] ?? rol}` : null };
    }
    default:
      return { titulo, detalle: null };
  }
}
