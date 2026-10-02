import type { EstadoInscripcion, EstadoOcupacion, EstadoPartido } from '@/api/tipos';

export type TonoPartido = 'alerta' | 'exito' | 'info' | 'neutro' | 'error';

export type PresentacionPartido = { etiqueta: string; tono: TonoPartido; descripcion: string };

export function presentarEstadoPartido(estado: EstadoPartido): PresentacionPartido {
  switch (estado) {
    case 'borrador':
    case 'pre_reservado':
      return {
        etiqueta: 'Esperando confirmación de cancha',
        tono: 'alerta',
        descripcion: 'Esperando que el club confirme la cancha. Cuando la confirme, el partido se abre para que se sume gente.',
      };
    case 'abierto':
      return { etiqueta: 'Abierto', tono: 'exito', descripcion: 'Se pueden sumar jugadores.' };
    case 'confirmado':
      return { etiqueta: 'Confirmado', tono: 'info', descripcion: 'El partido está confirmado.' };
    case 'cancelado':
      return { etiqueta: 'Cancelado', tono: 'error', descripcion: 'Este partido se canceló y no se juega.' };
    case 'finalizado':
      return { etiqueta: 'Finalizado', tono: 'neutro', descripcion: 'Este partido ya se jugó.' };
  }
}

export const ETIQUETAS_MI_ESTADO: Record<EstadoInscripcion, string> = {
  confirmado: 'Anotado',
  pendiente_aprobacion: 'Esperando aprobación',
  rechazado: 'No aceptado',
  pendiente_pago: 'Falta pagar',
};

export type Inscripcion = { puede: true; motivo: null } | { puede: false; motivo: string };

/** Si alguien que todavía no está anotado puede sumarse, y si no, por qué. */
export function evaluarInscripcion(partido: {
  estado_partido: EstadoPartido; estado_reserva: EstadoOcupacion; inicio: string; ocupados: number; cupo_maximo: number;
}, ahora: Date): Inscripcion {
  if (partido.estado_partido === 'cancelado') return { puede: false, motivo: 'Este partido se canceló.' };
  if (partido.estado_partido === 'finalizado') return { puede: false, motivo: 'Este partido ya se jugó.' };
  if (new Date(partido.inicio).getTime() <= ahora.getTime()) return { puede: false, motivo: 'El partido ya empezó.' };
  if (partido.estado_partido !== 'abierto' || partido.estado_reserva !== 'confirmada') {
    return { puede: false, motivo: 'Todavía no se puede sumar gente: el club tiene que confirmar la cancha.' };
  }
  if (partido.ocupados >= partido.cupo_maximo) return { puede: false, motivo: 'El partido está completo.' };
  return { puede: true, motivo: null };
}

/**
 * El servidor responde "Partido no encontrado" (P0002) tanto si no existe como
 * si es privado y no tenés acceso: en los dos casos se muestra lo mismo.
 */
export function esPartidoNoEncontrado(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === 'P0002' || (typeof message === 'string' && /partido no encontrado/i.test(message));
}

/** Un partido de "Mis partidos" ya pasó si terminó o quedó cerrado. */
export function partidoTerminado(partido: { fin: string; estado_partido: EstadoPartido }, ahora: Date): boolean {
  return partido.estado_partido === 'finalizado' || new Date(partido.fin).getTime() <= ahora.getTime();
}
