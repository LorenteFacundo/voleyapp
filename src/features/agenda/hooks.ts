import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { claves } from '@/api/claves';
import { clubApi } from '@/api/club';

/** Hora actual (ms) que se actualiza sola: línea de "ahora", cuentas regresivas. */
export function useAhora(intervaloMs = 30_000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const actualizar = () => setAhora(Date.now());
    const id = window.setInterval(actualizar, intervaloMs);
    const alVolver = () => {
      if (document.visibilityState === 'visible') actualizar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [intervaloMs]);
  return ahora;
}

/**
 * Después de cada cambio en la agenda se refresca todo el panel del club
 * (contadores, agenda, pendientes) y la disponibilidad pública.
 */
export function useInvalidarAgenda(clubId: number) {
  const queryClient = useQueryClient();
  return useCallback((extra: { clienteId?: number | null; partidos?: boolean } = {}) => {
    const tareas = [
      queryClient.invalidateQueries({ queryKey: claves.gestion(clubId) }),
      queryClient.invalidateQueries({ queryKey: claves.disponibilidad }),
    ];
    if (extra.clienteId) tareas.push(queryClient.invalidateQueries({ queryKey: claves.cliente(extra.clienteId) }));
    if (extra.partidos) tareas.push(queryClient.invalidateQueries({ queryKey: claves.partidos }));
    return Promise.all(tareas).then(() => undefined);
  }, [clubId, queryClient]);
}

/** Búsqueda de clientes del club (desde 2 caracteres). */
export function useBuscarClientes(clubId: number, termino: string) {
  const busqueda = termino.trim();
  return useQuery({
    queryKey: claves.clientes(clubId, busqueda, false),
    queryFn: () => clubApi.clientes(clubId, busqueda),
    enabled: busqueda.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
