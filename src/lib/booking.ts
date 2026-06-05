import { supabase } from './supabase';
import type { CanchaDetalle, ClubPublico, Turno, TurnoVirtual, MensajePartido, BadgeCatalogo, UsuarioBadge, RankingEntry, Notificacion } from '../types';

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[(),.*]/g, '').trim();
}

export async function fetchClubes(search = '') {
  let query = supabase.from('clubes_publicos').select('*').order('nombre', { ascending: true });

  const term = sanitizeSearchTerm(search);
  if (term) {
    query = query.or(`nombre.ilike.%${term}%,direccion.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClubPublico[];
}

export async function fetchCanchasByClub(clubId: number) {
  const { data, error } = await supabase
    .from('canchas')
    .select('id, club_id, nombre_identificador, titulo, descripcion, fotos, precio_total, precio_sena')
    .eq('club_id', clubId)
    .order('titulo', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CanchaDetalle[];
}

export async function fetchTurnosCancha(canchaId: number, desdeFecha: string) {
  const { data, error } = await supabase
    .from('disponibilidad_turnos')
    .select('*')
    .eq('cancha_id', canchaId)
    .gte('fecha', desdeFecha)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Turno[];
}

export function groupTurnosByFecha(turnos: Turno[]) {
  const map = new Map<string, Turno[]>();
  turnos.forEach((turno) => {
    const list = map.get(turno.fecha) ?? [];
    list.push(turno);
    map.set(turno.fecha, list);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export async function unirseAPartido(partidoId: number) {
  const { data, error } = await supabase.rpc('unirse_a_partido', {
    p_partido_id: partidoId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function salirseDePartido(partidoId: number): Promise<string> {
  const { data, error } = await supabase.rpc('salirse_de_partido', {
    p_partido_id: partidoId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function obtenerTurnosDisponibles(
  canchaId: number,
  desde: string,
  hasta: string
): Promise<TurnoVirtual[]> {
  const { data, error } = await supabase.rpc('obtener_turnos_disponibles', {
    p_cancha_id: canchaId,
    p_desde: desde,
    p_hasta: hasta,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as TurnoVirtual[];
}

export function turnoKey(turno: TurnoVirtual): string {
  if (turno.id != null) return String(turno.id);
  return `${turno.fecha}-${turno.hora_inicio}-${turno.hora_fin}`;
}

export function groupTurnosVirtualesByFecha(turnos: TurnoVirtual[]) {
  const map = new Map<string, TurnoVirtual[]>();
  turnos.forEach((turno) => {
    const list = map.get(turno.fecha) ?? [];
    list.push(turno);
    map.set(turno.fecha, list);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// ============ FASE 3: SOCIAL ============

export async function enviarMensaje(partidoId: number, texto: string) {
  const { data, error } = await supabase.rpc('enviar_mensaje', {
    p_partido_id: partidoId,
    p_texto: texto,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchMensajesPartido(partidoId: number): Promise<MensajePartido[]> {
  const { data, error } = await supabase
    .from('mensajes_partido')
    .select('id, partido_id, usuario_id, texto, created_at, usuarios:usuario_id(nombre_completo)')
    .eq('partido_id', partidoId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((m: any) => ({
    id: m.id,
    partido_id: m.partido_id,
    usuario_id: m.usuario_id,
    texto: m.texto,
    created_at: m.created_at,
    nombre: m.usuarios?.nombre_completo ?? 'Jugador',
  }));
}

export async function fetchBadgesUsuario(usuarioId: string): Promise<UsuarioBadge[]> {
  const { data, error } = await supabase
    .from('usuario_badges')
    .select('badge_id, otorgado_at, badges_catalogo:badge_id(nombre, descripcion, icono)')
    .eq('usuario_id', usuarioId)
    .order('otorgado_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((b: any) => ({
    id: b.badge_id,
    nombre: b.badges_catalogo?.nombre ?? b.badge_id,
    descripcion: b.badges_catalogo?.descripcion ?? '',
    icono: b.badges_catalogo?.icono ?? 'Award',
    otorgado_at: b.otorgado_at,
  }));
}

export async function fetchBadgesCatalogo(): Promise<BadgeCatalogo[]> {
  const { data, error } = await supabase
    .from('badges_catalogo')
    .select('*')
    .order('id');
  if (error) throw new Error(error.message);
  return (data ?? []) as BadgeCatalogo[];
}

export async function fetchRanking(limit = 20): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('ranking_jugadores')
    .select('*')
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RankingEntry[];
}

export async function otorgarPuntos(usuarioId: string, puntos: number, motivo: string, referenciaId?: number) {
  const { error } = await supabase.rpc('otorgar_puntos', {
    p_usuario_id: usuarioId,
    p_puntos: puntos,
    p_motivo: motivo,
    p_referencia_id: referenciaId ?? null,
  });
  if (error) console.error('Error otorgando puntos:', error.message);
}

// ============ FASE 2: NOTIFICACIONES ============

export async function fetchNotificaciones(): Promise<Notificacion[]> {
  const { data, error } = await supabase.rpc('mis_notificaciones');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Notificacion[];
}

export async function marcarNotificacionLeida(notificacionId: number) {
  const { error } = await supabase.rpc('marcar_notificacion_leida', { p_notificacion_id: notificacionId });
  if (error) console.error('Error marcando notificación:', error.message);
}

export async function marcarTodasLeidas() {
  const { error } = await supabase.rpc('marcar_todas_leidas');
  if (error) console.error('Error marcando notificaciones:', error.message);
}

export async function buscarPartidoPorToken(token: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('buscar_partido_por_token', { p_token: token });
  if (error) return null;
  return data as number | null;
}
