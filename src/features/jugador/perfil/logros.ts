import { Award, Flame, Star, Trophy, Users, Volleyball, Zap, type LucideIcon } from 'lucide-react';
import type { Logro } from '@/api/tipos';

// Los logros guardan el nombre de un ícono de lucide (badges_catalogo.icono).
const ICONOS: Record<string, LucideIcon> = { Volleyball, Flame, Star, Users, Trophy, Zap };

export function iconoLogro(nombre: string | null | undefined): LucideIcon {
  return (nombre && ICONOS[nombre]) || Award;
}

export function resumenLogros(logros: Pick<Logro, 'otorgado_at'>[] | undefined): { obtenidos: number; total: number } {
  const lista = logros ?? [];
  return { obtenidos: lista.filter((logro) => logro.otorgado_at).length, total: lista.length };
}
