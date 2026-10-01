import type { Perfil } from '@/api/tipos';

/** Nombre para mostrar aunque la cuenta no tenga nombre cargado. */
export function nombreVisible(perfil: Pick<Perfil, 'nombre' | 'email'>): string {
  return perfil.nombre?.trim() || perfil.email?.split('@')[0]?.trim() || 'Jugador';
}
