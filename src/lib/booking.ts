import { supabase } from './supabase';
import type { CanchaDetalle, ClubPublico, Turno } from '../types';

export async function fetchClubes(search = '') {
  let query = supabase.from('clubes_publicos').select('*').order('nombre', { ascending: true });

  const term = search.trim();
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
