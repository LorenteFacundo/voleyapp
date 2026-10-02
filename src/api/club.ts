import { supabase } from '@/lib/supabase';
import { rpc, rpcLista, traducirError } from './cliente';
import type {
  Agenda, BloqueHorario, Caja, CanchaGestion, ClienteDetalle, ClienteListado, Cliente, ClubConfig, ClubPanel,
  Deudas, Equipo, EventoAuditoria, InvitacionCreada, MedioPago, Ocupacion, OrigenOcupacion, Reporte, ResultadoSerie,
  RolClub, Serie, Superficie, VistaPreviaSerie,
} from './tipos';

export type NuevaReserva = {
  clubId: number;
  canchaId: number;
  inicio: string;
  fin: string;
  clienteId?: number | null;
  clienteNombre?: string | null;
  clienteTelefono?: string | null;
  origen?: Exclude<OrigenOcupacion, 'app' | 'fijo'>;
  precio?: number | null;
  titulo?: string | null;
  notas?: string | null;
};

export type CambiosOcupacion = Partial<{
  precio: number;
  sena: number;
  notas: string | null;
  titulo: string | null;
  asistencia: 'jugaron' | 'no_vinieron' | null;
  cliente_id: number | null;
}>;

export type DatosSerie = {
  clubId: number;
  canchaId: number;
  titulo: string;
  diaSemana: number;
  horaInicio: string;
  duracionMin: number;
  desde: string;
  hasta?: string | null;
  precio: number;
  clienteId?: number | null;
  clienteNombre?: string | null;
  clienteTelefono?: string | null;
  notas?: string | null;
  omitirConflictos?: boolean;
};

export type DatosCancha = {
  clubId: number;
  id?: number | null;
  titulo: string;
  descripcion?: string | null;
  precioTotal: number;
  precioSena: number;
  techada: boolean;
  superficie: Superficie | null;
  activa: boolean;
  orden: number;
  fotos?: string[] | null;
};

export const clubApi = {
  panel: (clubId: number) => rpc<ClubPanel>('club_panel', { p_club_id: clubId }),

  agenda: (clubId: number, desde: string, hasta: string, incluirCanceladas = false) =>
    rpc<Agenda>('club_agenda', { p_club_id: clubId, p_desde: desde, p_hasta: hasta, p_incluir_canceladas: incluirCanceladas }),

  pendientes: (clubId: number) => rpcLista<Ocupacion>('club_pendientes', { p_club_id: clubId }),

  /** Reservas en las que el jugador avisó que pagó y falta registrar el cobro (las más recientes primero). */
  pagosInformados: (clubId: number) => rpcLista<Ocupacion>('club_pagos_informados', { p_club_id: clubId }),

  crearReserva: (datos: NuevaReserva) =>
    rpc<Ocupacion>('club_crear_reserva', {
      p_club_id: datos.clubId,
      p_cancha_id: datos.canchaId,
      p_inicio: datos.inicio,
      p_fin: datos.fin,
      p_cliente_id: datos.clienteId ?? null,
      p_cliente_nombre: datos.clienteNombre || null,
      p_cliente_telefono: datos.clienteTelefono || null,
      p_origen: datos.origen ?? 'whatsapp',
      p_precio: datos.precio ?? null,
      p_titulo: datos.titulo || null,
      p_notas: datos.notas || null,
    }),

  conflictos: (clubId: number, canchas: number[], inicio: string, fin: string) =>
    rpcLista<Ocupacion>('club_conflictos', { p_club_id: clubId, p_canchas: canchas, p_inicio: inicio, p_fin: fin }),

  bloquear: (datos: { clubId: number; canchas: number[]; inicio: string; fin: string; motivo: string; cancelarReservas: boolean }) =>
    rpc<{ bloqueos: number; canceladas: Ocupacion[] }>('club_bloquear', {
      p_club_id: datos.clubId,
      p_canchas: datos.canchas,
      p_inicio: datos.inicio,
      p_fin: datos.fin,
      p_motivo: datos.motivo,
      p_cancelar_reservas: datos.cancelarReservas,
    }),

  resolverSolicitud: (ocupacionId: number, confirmar: boolean, motivo?: string | null) =>
    rpc<{ estado: 'confirmada' | 'rechazada' | 'vencida' }>('club_resolver_solicitud', {
      p_ocupacion_id: ocupacionId, p_confirmar: confirmar, p_motivo: motivo || null,
    }),

  cancelarOcupacion: (ocupacionId: number, motivo?: string | null) =>
    rpc<Ocupacion>('club_cancelar_ocupacion', { p_ocupacion_id: ocupacionId, p_motivo: motivo || null }),

  moverOcupacion: (ocupacionId: number, canchaId: number, inicio: string, fin: string) =>
    rpc<Ocupacion>('club_mover_ocupacion', { p_ocupacion_id: ocupacionId, p_cancha_id: canchaId, p_inicio: inicio, p_fin: fin }),

  actualizarOcupacion: (ocupacionId: number, cambios: CambiosOcupacion) =>
    rpc<Ocupacion>('club_actualizar_ocupacion', { p_ocupacion_id: ocupacionId, p_cambios: cambios }),

  registrarPago: (datos: {
    clubId: number; monto: number; medio: MedioPago; ocupacionId?: number | null; clienteId?: number | null;
    fecha?: string | null; nota?: string | null;
  }) =>
    rpc<{ pago_id: number; ocupacion: Ocupacion | null; saldo_cliente: number | null }>('club_registrar_pago', {
      p_club_id: datos.clubId,
      p_monto: datos.monto,
      p_medio: datos.medio,
      p_ocupacion_id: datos.ocupacionId ?? null,
      p_cliente_id: datos.clienteId ?? null,
      p_fecha: datos.fecha ?? null,
      p_nota: datos.nota || null,
    }),

  anularPago: (pagoId: number) => rpc<void>('club_anular_pago', { p_pago_id: pagoId }),

  caja: (clubId: number, desde: string, hasta: string) =>
    rpc<Caja>('club_caja', { p_club_id: clubId, p_desde: desde, p_hasta: hasta }),

  deudas: (clubId: number) => rpc<Deudas>('club_deudas', { p_club_id: clubId }),

  /** Hasta `limite` clientes (el servidor admite hasta 500), ordenados por nombre. */
  clientes: (clubId: number, busqueda?: string | null, incluirArchivados = false, limite = 200) =>
    rpcLista<ClienteListado>('club_clientes', {
      p_club_id: clubId, p_busqueda: busqueda?.trim() || null, p_incluir_archivados: incluirArchivados, p_limite: limite,
    }),

  guardarCliente: (datos: { clubId: number; id?: number | null; nombre: string; telefono?: string | null; email?: string | null; notas?: string | null }) =>
    rpc<Cliente>('club_guardar_cliente', {
      p_club_id: datos.clubId,
      p_nombre: datos.nombre,
      p_id: datos.id ?? null,
      p_telefono: datos.telefono || null,
      p_email: datos.email || null,
      p_notas: datos.notas || null,
    }),

  archivarCliente: (clienteId: number, archivado: boolean) =>
    rpc<void>('club_archivar_cliente', { p_cliente_id: clienteId, p_archivado: archivado }),

  clienteDetalle: (clienteId: number) => rpc<ClienteDetalle>('club_cliente_detalle', { p_cliente_id: clienteId }),

  series: (clubId: number, incluirFinalizadas = false) =>
    rpcLista<Serie>('club_series', { p_club_id: clubId, p_incluir_finalizadas: incluirFinalizadas }),

  previsualizarSerie: (datos: { clubId: number; canchaId: number; diaSemana: number; horaInicio: string; duracionMin: number; desde: string; hasta?: string | null; excluirSerie?: number | null }) =>
    rpc<VistaPreviaSerie>('club_previsualizar_serie', {
      p_club_id: datos.clubId,
      p_cancha_id: datos.canchaId,
      p_dia_semana: datos.diaSemana,
      p_hora_inicio: datos.horaInicio,
      p_duracion_min: datos.duracionMin,
      p_desde: datos.desde,
      p_hasta: datos.hasta ?? null,
      p_excluir_serie: datos.excluirSerie ?? null,
    }),

  crearSerie: (datos: DatosSerie) =>
    rpc<ResultadoSerie>('club_crear_serie', {
      p_club_id: datos.clubId,
      p_cancha_id: datos.canchaId,
      p_titulo: datos.titulo,
      p_dia_semana: datos.diaSemana,
      p_hora_inicio: datos.horaInicio,
      p_duracion_min: datos.duracionMin,
      p_desde: datos.desde,
      p_precio: datos.precio,
      p_hasta: datos.hasta ?? null,
      p_cliente_id: datos.clienteId ?? null,
      p_cliente_nombre: datos.clienteNombre || null,
      p_cliente_telefono: datos.clienteTelefono || null,
      p_notas: datos.notas || null,
      p_omitir_conflictos: datos.omitirConflictos ?? false,
    }),

  modificarSerie: (datos: {
    serieId: number; desdeFecha: string; canchaId: number; diaSemana: number; horaInicio: string; duracionMin: number;
    precio: number; titulo?: string | null; hasta?: string | null; omitirConflictos?: boolean;
  }) =>
    rpc<ResultadoSerie>('club_modificar_serie', {
      p_serie_id: datos.serieId,
      p_desde_fecha: datos.desdeFecha,
      p_cancha_id: datos.canchaId,
      p_dia_semana: datos.diaSemana,
      p_hora_inicio: datos.horaInicio,
      p_duracion_min: datos.duracionMin,
      p_precio: datos.precio,
      p_titulo: datos.titulo || null,
      p_hasta: datos.hasta ?? null,
      p_omitir_conflictos: datos.omitirConflictos ?? false,
    }),

  finalizarSerie: (serieId: number, desdeFecha: string) =>
    rpc<{ canceladas: number }>('club_finalizar_serie', { p_serie_id: serieId, p_desde_fecha: desdeFecha }),

  actualizarClub: (clubId: number, datos: Partial<ClubConfig>) =>
    rpc<ClubConfig>('club_actualizar', { p_club_id: clubId, p_datos: datos }),

  guardarCancha: (datos: DatosCancha) =>
    rpc<CanchaGestion>('club_guardar_cancha', {
      p_club_id: datos.clubId,
      p_titulo: datos.titulo,
      p_id: datos.id ?? null,
      p_descripcion: datos.descripcion || null,
      p_precio_total: datos.precioTotal,
      p_precio_sena: datos.precioSena,
      p_techada: datos.techada,
      p_superficie: datos.superficie,
      p_activa: datos.activa,
      p_orden: datos.orden,
      p_fotos: datos.fotos ?? null,
    }),

  guardarHorarios: (canchaId: number, bloques: BloqueHorario[]) =>
    rpc<number>('club_guardar_horarios', { p_cancha_id: canchaId, p_bloques: bloques }),

  /** Sube una foto a la carpeta del club y devuelve su URL pública. */
  async subirFoto(clubId: number, archivo: File): Promise<string> {
    const extension = (archivo.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const ruta = `club-${clubId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('canchas-fotos').upload(ruta, archivo, {
      cacheControl: '31536000', contentType: archivo.type, upsert: false,
    });
    if (error) throw traducirError(error);
    return supabase.storage.from('canchas-fotos').getPublicUrl(ruta).data.publicUrl;
  },

  equipo: (clubId: number) => rpc<Equipo>('club_equipo', { p_club_id: clubId }),

  invitar: (clubId: number, email: string, rol: RolClub) =>
    rpc<InvitacionCreada>('club_invitar', { p_club_id: clubId, p_email: email, p_rol: rol }),

  revocarInvitacion: (invitacionId: number) => rpc<void>('club_revocar_invitacion', { p_invitacion_id: invitacionId }),

  /** Cambia el rol de un miembro o lo quita del equipo (rol = null). */
  cambiarMiembro: (clubId: number, userId: string, rol: RolClub | null) =>
    rpc<void>('club_cambiar_miembro', { p_club_id: clubId, p_user_id: userId, p_rol: rol }),

  publicarPartido: (datos: {
    clubId: number; canchaId: number; inicio: string; fin: string; cupoMinimo: number; cupoMaximo: number;
    nivel: string; precioPorJugador: number; descripcion?: string | null;
  }) =>
    rpc<{ partido_id: number; ocupacion_id: number }>('club_publicar_partido', {
      p_club_id: datos.clubId,
      p_cancha_id: datos.canchaId,
      p_inicio: datos.inicio,
      p_fin: datos.fin,
      p_cupo_minimo: datos.cupoMinimo,
      p_cupo_maximo: datos.cupoMaximo,
      p_nivel: datos.nivel,
      p_precio_por_jugador: datos.precioPorJugador,
      p_descripcion: datos.descripcion || null,
    }),

  reporte: (clubId: number, desde: string, hasta: string) =>
    rpc<Reporte>('club_reporte', { p_club_id: clubId, p_desde: desde, p_hasta: hasta }),

  auditoria: (clubId: number, limite = 100) =>
    rpcLista<EventoAuditoria>('club_auditoria', { p_club_id: clubId, p_limite: limite }),
};
