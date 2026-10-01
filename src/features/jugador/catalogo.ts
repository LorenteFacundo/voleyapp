import type { CanchaPublica, ClubPublico } from '@/api/tipos';
import { distanciaKm, tieneCoordenadas, type Coordenadas } from '@/features/mapa/distancia';

// Búsqueda, filtros y orden del catálogo de clubes (pantalla de canchas).

/** Minúsculas y sin acentos, para buscar "nunez" y encontrar "Núñez". */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function coincideBusqueda(club: ClubPublico, busqueda: string): boolean {
  const terminos = normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
  if (!terminos.length) return true;
  const texto = normalizarTexto(
    [club.nombre, club.zona, club.direccion, ...club.canchas.map((cancha) => cancha.titulo)].filter(Boolean).join(' '),
  );
  return terminos.every((termino) => texto.includes(termino));
}

export type FiltrosCatalogo = { busqueda: string; techada: boolean; arena: boolean };

export function tieneTechada(club: ClubPublico): boolean {
  return club.canchas.some((cancha) => cancha.techada);
}

export function tieneArena(club: ClubPublico): boolean {
  return club.canchas.some((cancha) => cancha.superficie === 'arena');
}

export function filtrarClubes(clubes: ClubPublico[], filtros: FiltrosCatalogo): ClubPublico[] {
  return clubes.filter((club) => coincideBusqueda(club, filtros.busqueda)
    && (!filtros.techada || tieneTechada(club))
    && (!filtros.arena || tieneArena(club)));
}

/** Precio más bajo entre las canchas del club (sin contar las que no tienen precio). */
export function precioDesde(canchas: Pick<CanchaPublica, 'precio_total'>[]): number | null {
  const precios = canchas.map((cancha) => Number(cancha.precio_total)).filter((precio) => Number.isFinite(precio) && precio > 0);
  return precios.length ? Math.min(...precios) : null;
}

export type ClubConDistancia = { club: ClubPublico; distanciaKm: number | null };

/**
 * Con una ubicación de origen, ordena por cercanía (los clubes sin ubicación
 * van al final); sin ubicación, por nombre.
 */
export function ordenarClubes(clubes: ClubPublico[], origen: Coordenadas | null): ClubConDistancia[] {
  const conDistancia = clubes.map((club) => ({
    club,
    distanciaKm: origen && tieneCoordenadas(club) ? distanciaKm(origen, club) : null,
  }));
  const porNombre = (a: ClubConDistancia, b: ClubConDistancia) => a.club.nombre.localeCompare(b.club.nombre, 'es');
  if (!origen) return conDistancia.sort(porNombre);
  return conDistancia.sort((a, b) => {
    if (a.distanciaKm == null && b.distanciaKm == null) return porNombre(a, b);
    if (a.distanciaKm == null) return 1;
    if (b.distanciaKm == null) return -1;
    return a.distanciaKm - b.distanciaKm || porNombre(a, b);
  });
}
