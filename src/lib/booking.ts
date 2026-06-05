import { supabase } from './supabase';
import type { CanchaDetalle, ClubPublico, Turno, TurnoVirtual } from '../types';

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

export async function salirseDePartido(partidoId: number) {
  const { error } = await supabase.rpc('salirse_de_partido', {
    p_partido_id: partidoId,
  });

  if (error) {
    throw new Error(error.message);
  }
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
