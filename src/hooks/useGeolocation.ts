import { useCallback, useState } from 'react';

export const CENTRO_POR_DEFECTO: [number, number] = [-34.6037, -58.3816];

type EstadoUbicacion = 'inactivo' | 'buscando' | 'listo' | 'denegado' | 'no_disponible';

/**
 * Ubicación a pedido: solo se solicita permiso cuando la persona lo pide
 * (por ejemplo, al filtrar por cercanía), nunca al cargar la página.
 */
export function useUbicacion() {
  const [estado, setEstado] = useState<EstadoUbicacion>('inactivo');
  const [coordenadas, setCoordenadas] = useState<[number, number] | null>(null);

  const pedir = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setEstado('no_disponible');
      return;
    }
    setEstado('buscando');
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setCoordenadas([posicion.coords.latitude, posicion.coords.longitude]);
        setEstado('listo');
      },
      (error) => setEstado(error.code === error.PERMISSION_DENIED ? 'denegado' : 'no_disponible'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60_000 },
    );
  }, []);

  return { estado, coordenadas, pedir };
}
