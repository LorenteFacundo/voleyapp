import { useMutation } from '@tanstack/react-query';
import { clubApi } from '@/api/club';
import { useGestion } from '@/contexts/gestion';
import { useInvalidarGestion } from './useInvalidarGestion';
import type { DatosCliente } from './validacion';

export function useGuardarCliente() {
  const { clubId } = useGestion();
  const invalidar = useInvalidarGestion();
  return useMutation({
    mutationFn: (datos: DatosCliente & { id?: number | null }) => clubApi.guardarCliente({ clubId, ...datos }),
    onSuccess: (cliente) => invalidar(cliente.id),
  });
}

export function useArchivarCliente() {
  const invalidar = useInvalidarGestion();
  return useMutation({
    mutationFn: ({ id, archivado }: { id: number; archivado: boolean }) => clubApi.archivarCliente(id, archivado),
    onSuccess: (_resultado, { id }) => invalidar(id),
  });
}
