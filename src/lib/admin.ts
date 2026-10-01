import { supabase } from './supabase';
import type { ClubAdmin, CanchaAdmin, TurnoAdmin, ReservaAdmin, PartidoAdmin, UsuarioAdmin, HorarioSemanal } from '@/types';

const BUCKET = 'canchas-fotos';

export type TurnoInput = {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
};

export type CrearCanchaInput = {
  clubId?: number | null;
  clubNombre: string;
  clubDireccion: string;
  clubTelefono: string;
  latitud: number;
  longitud: number;
  titulo: string;
  nombreIdentificador: string;
  descripcion: string;
  precioTotal: number;
  precioSena: number;
  fotos: string[];
  turnos: TurnoInput[];
};

export async function uploadCanchaPhotos(files: File[]) {
  const urls: string[] = [];

  for (const file of files) {
    const extension = file.name.split('.').pop() ?? 'jpg';
    const path = `${crypto.randomUUID()}/${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

    if (error) {
      throw new Error(`No se pudo subir ${file.name}: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

export async function crearCanchaConTurnos(input: CrearCanchaInput) {
  const { data, error } = await supabase.rpc('admin_crear_cancha', {
    p_club_nombre: input.clubNombre,
    p_club_direccion: input.clubDireccion,
    p_latitud: input.latitud,
    p_longitud: input.longitud,
    p_titulo: input.titulo,
    p_precio_total: input.precioTotal,
    p_precio_sena: input.precioSena,
    p_club_telefono: input.clubTelefono || null,
    p_nombre_identificador: input.nombreIdentificador || null,
    p_descripcion: input.descripcion || null,
    p_fotos: input.fotos,
    p_turnos: input.turnos,
    p_club_id: input.clubId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    club_id: number;
    cancha_id: number;
    turnos_creados: number;
  };
}

export async function reservarTurnoRango(params: {
  canchaId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estadoFinal?: string;
}) {
  const { data, error } = await supabase.rpc('reservar_turno_rango', {
    p_cancha_id: params.canchaId,
    p_fecha: params.fecha,
    p_hora_inicio: params.horaInicio,
    p_hora_fin: params.horaFin,
    p_estado_final: params.estadoFinal || 'reservado',
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as number;
}

export async function reservarTurnoVirtual(params: {
  canchaId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  precioTotal: number;
  precioSena: number;
}) {
  const { data, error } = await supabase.rpc('reservar_turno_virtual', {
    p_cancha_id: params.canchaId,
    p_fecha: params.fecha,
    p_hora_inicio: params.horaInicio,
    p_hora_fin: params.horaFin,
    p_precio_total: params.precioTotal,
    p_precio_sena: params.precioSena,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as number;
}

export async function crearPartidoVirtual(params: {
  canchaId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  precioTotal: number;
  precioSena: number;
  cupoMinimo: number;
  cupoMaximo: number;
  invitados: number;
  nivel: string;
  requiereAprobacion: boolean;
  visibilidad: string;
}) {
  const { data, error } = await supabase.rpc('crear_partido_virtual', {
    p_cancha_id: params.canchaId,
    p_fecha: params.fecha,
    p_hora_inicio: params.horaInicio,
    p_hora_fin: params.horaFin,
    p_precio_total: params.precioTotal,
    p_precio_sena: params.precioSena,
    p_cupo_minimo: params.cupoMinimo,
    p_cupo_maximo: params.cupoMaximo,
    p_invitados: params.invitados,
    p_nivel: params.nivel,
    p_requiere_aprobacion: params.requiereAprobacion,
    p_visibilidad: params.visibilidad,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as number;
}

// ============ ADMIN CRUD ============

// Clubes
export async function adminListarClubes(): Promise<ClubAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_clubes');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ClubAdmin[];
}

export async function adminActualizarClub(params: {
  clubId: number; nombre: string; direccion: string;
  telefono: string; latitud: number; longitud: number;
}) {
  const { error } = await supabase.rpc('admin_actualizar_club', {
    p_club_id: params.clubId, p_nombre: params.nombre,
    p_direccion: params.direccion, p_telefono: params.telefono,
    p_latitud: params.latitud, p_longitud: params.longitud,
  });
  if (error) throw new Error(error.message);
}

// Canchas
export async function adminListarCanchas(): Promise<CanchaAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_canchas');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CanchaAdmin[];
}

export async function adminActualizarCancha(params: {
  canchaId: number; titulo: string; descripcion: string;
  precioTotal: number; precioSena: number; fotos: string[];
}) {
  const { error } = await supabase.rpc('admin_actualizar_cancha', {
    p_cancha_id: params.canchaId, p_titulo: params.titulo,
    p_descripcion: params.descripcion, p_precio_total: params.precioTotal,
    p_precio_sena: params.precioSena, p_fotos: params.fotos,
  });
  if (error) throw new Error(error.message);
}

// Turnos
export async function adminListarTurnos(filters?: {
  canchaId?: number; fechaDesde?: string; fechaHasta?: string;
}): Promise<TurnoAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_turnos', {
    p_cancha_id: filters?.canchaId ?? null,
    p_fecha_desde: filters?.fechaDesde ?? null,
    p_fecha_hasta: filters?.fechaHasta ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TurnoAdmin[];
}

// Reservas
export async function adminListarReservas(): Promise<ReservaAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_reservas');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReservaAdmin[];
}

// Partidos
export async function adminListarPartidos(): Promise<PartidoAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_partidos');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PartidoAdmin[];
}

export async function adminCancelarPartido(partidoId: number) {
  const { error } = await supabase.rpc('admin_cancelar_partido', { p_partido_id: partidoId });
  if (error) throw new Error(error.message);
}

// Usuarios
export async function adminListarUsuarios(): Promise<UsuarioAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_usuarios');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UsuarioAdmin[];
}

export async function adminActualizarRol(usuarioId: string, rol: string) {
  const { error } = await supabase.rpc('admin_actualizar_rol', {
    p_usuario_id: usuarioId, p_rol: rol,
  });
  if (error) throw new Error(error.message);
}

// Turnos para una cancha específica
export async function adminListarTurnosCancha(canchaId: number): Promise<TurnoAdmin[]> {
  const { data, error } = await supabase.rpc('admin_listar_turnos_cancha', { p_cancha_id: canchaId });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TurnoAdmin[];
}

export async function adminCrearTurno(params: { canchaId: number; fecha: string; horaInicio: string; horaFin: string }) {
  const { error } = await supabase.rpc('admin_crear_turno', {
    p_cancha_id: params.canchaId,
    p_fecha: params.fecha,
    p_hora_inicio: params.horaInicio,
    p_hora_fin: params.horaFin,
  });
  if (error) throw new Error(error.message);
}

// Horarios semanales
export async function adminListarHorariosSemanales(canchaId: number): Promise<HorarioSemanal[]> {
  const { data, error } = await supabase.rpc('admin_listar_horarios_semanales', { p_cancha_id: canchaId });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HorarioSemanal[];
}

export async function adminGuardarHorariosSemanales(canchaId: number, horarios: Omit<HorarioSemanal, 'id' | 'cancha_id' | 'activo'>[]) {
  const { error } = await supabase.rpc('admin_guardar_horarios_semanales', {
    p_cancha_id: canchaId,
    p_horarios: horarios,
  });
  if (error) throw new Error(error.message);
}

export async function adminEliminarHorarioSemanal(horarioId: number) {
  const { error } = await supabase.rpc('admin_eliminar_horario_semanal', { p_horario_id: horarioId });
  if (error) throw new Error(error.message);
}
