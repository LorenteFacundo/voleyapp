import { rpc, rpcLista } from './cliente';
import type {
  ConfigPartido, Logro, Mensaje, MiPartido, MiReserva, Notificacion, Perfil, ResultadoSolicitud, RolClub,
} from './tipos';

export const jugadorApi = {
  miPerfil: () => rpc<Perfil>('mi_perfil'),

  actualizarPerfil: (datos: { nombre: string; nivel: number; telefono: string | null }) =>
    rpc<Perfil>('actualizar_mi_perfil', { p_nombre: datos.nombre, p_nivel: datos.nivel, p_telefono: datos.telefono }),

  misLogros: () => rpcLista<Logro>('mis_logros'),

  solicitarReserva: (datos: { horarioId: number; fecha: string; partido?: ConfigPartido | null; nota?: string | null }) =>
    rpc<ResultadoSolicitud>('solicitar_reserva', {
      p_horario_id: datos.horarioId,
      p_fecha: datos.fecha,
      p_partido: datos.partido ?? null,
      p_nota: datos.nota || null,
    }),

  cancelarReserva: (ocupacionId: number, motivo?: string | null) =>
    rpc<{ estado: string; a_devolver: number }>('cancelar_mi_reserva', { p_ocupacion_id: ocupacionId, p_motivo: motivo || null }),

  informarPago: (ocupacionId: number) => rpc<void>('informar_pago', { p_ocupacion_id: ocupacionId }),

  misReservas: (historial = false) => rpcLista<MiReserva>('mis_reservas', { p_historial: historial }),

  unirseAPartido: (partidoId: number, token?: string | null) =>
    rpc<{ estado_inscripcion: 'confirmado' | 'pendiente_aprobacion' }>('partido_unirse', {
      p_partido_id: partidoId, p_token: token || null,
    }),

  salirDePartido: (partidoId: number) => rpc<void>('partido_salir', { p_partido_id: partidoId }),

  resolverInscripcion: (partidoId: number, usuarioId: string, aprobar: boolean) =>
    rpc<void>('partido_resolver_inscripcion', { p_partido_id: partidoId, p_usuario_id: usuarioId, p_aprobar: aprobar }),

  transferirPartido: (partidoId: number, usuarioId: string) =>
    rpc<void>('partido_transferir', { p_partido_id: partidoId, p_usuario_id: usuarioId }),

  actualizarPartido: (partidoId: number, datos: ConfigPartido) =>
    rpc<void>('partido_actualizar', {
      p_partido_id: partidoId,
      p_cupo_minimo: datos.cupo_minimo,
      p_cupo_maximo: datos.cupo_maximo,
      p_invitados: datos.invitados,
      p_nivel: datos.nivel_requerido,
      p_visibilidad: datos.visibilidad,
      p_requiere_aprobacion: datos.requiere_aprobacion,
      p_descripcion: datos.descripcion || null,
      p_precio_por_jugador: datos.precio_por_jugador ?? null,
    }),

  cancelarPartido: (partidoId: number, motivo?: string | null) =>
    rpc<void>('partido_cancelar', { p_partido_id: partidoId, p_motivo: motivo || null }),

  misPartidos: () => rpcLista<MiPartido>('mis_partidos'),

  /** Los 50 mensajes más nuevos (o los anteriores al id indicado), del más nuevo al más viejo. */
  mensajes: (partidoId: number, antesDe?: number | null) =>
    rpcLista<Mensaje>('mensajes_partido', { p_partido_id: partidoId, p_antes_de: antesDe ?? null }),

  enviarMensaje: (partidoId: number, texto: string) =>
    rpc<{ id: number; texto: string; created_at: string }>('enviar_mensaje', { p_partido_id: partidoId, p_texto: texto }),

  notificaciones: (limite = 30) => rpcLista<Notificacion>('mis_notificaciones', { p_limite: limite }),
  notificacionesSinLeer: () => rpc<number>('notificaciones_sin_leer'),
  marcarLeida: (id: number) => rpc<void>('marcar_notificacion_leida', { p_notificacion_id: id }),
  marcarTodasLeidas: () => rpc<void>('marcar_todas_leidas'),

  aceptarInvitacionClub: (token: string) =>
    rpc<{ club_id: number; club_nombre: string; rol: RolClub }>('aceptar_invitacion_club', { p_token: token }),
};
