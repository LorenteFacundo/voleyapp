import { formatNumero } from '@/lib/format';

export type Coordenadas = { latitud: number; longitud: number };

const RADIO_TIERRA_KM = 6371;

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

/** Distancia en línea recta entre dos puntos (fórmula de haversine), en kilómetros. */
export function distanciaKm(a: Coordenadas, b: Coordenadas): number {
  const deltaLatitud = aRadianes(b.latitud - a.latitud);
  const deltaLongitud = aRadianes(b.longitud - a.longitud);
  const h = Math.sin(deltaLatitud / 2) ** 2
    + Math.cos(aRadianes(a.latitud)) * Math.cos(aRadianes(b.latitud)) * Math.sin(deltaLongitud / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** true si el lugar tiene latitud y longitud cargadas y válidas. */
export function tieneCoordenadas<T extends { latitud: number | null; longitud: number | null }>(
  lugar: T,
): lugar is T & Coordenadas {
  return lugar.latitud != null && lugar.longitud != null
    && Number.isFinite(lugar.latitud) && Number.isFinite(lugar.longitud)
    && Math.abs(lugar.latitud) <= 90 && Math.abs(lugar.longitud) <= 180;
}

/** "a 850 m", "a 2,3 km", "a 15 km". */
export function formatDistancia(km: number): string {
  if (km < 1) return `a ${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `a ${formatNumero(Math.round(km * 10) / 10)} km`;
  return `a ${Math.round(km)} km`;
}
