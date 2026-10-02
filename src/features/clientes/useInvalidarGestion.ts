import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { claves } from '@/api/claves';
import { useGestion } from '@/contexts/gestion';

/**
 * Después de una escritura: refresca todo el panel del club y, si se
 * indican, las fichas de los clientes afectados (su clave no cuelga del club).
 */
export function useInvalidarGestion() {
  const { clubId } = useGestion();
  const queryClient = useQueryClient();
  return useCallback((...clientes: (number | null | undefined)[]) => {
    void queryClient.invalidateQueries({ queryKey: claves.gestion(clubId) });
    for (const clienteId of new Set(clientes)) {
      if (clienteId) void queryClient.invalidateQueries({ queryKey: claves.cliente(clienteId) });
    }
  }, [clubId, queryClient]);
}
