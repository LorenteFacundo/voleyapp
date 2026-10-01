import { useEstadoOperacion } from '@/api/consultas';
import { useAuth } from '@/contexts/auth';
import { situacionReserva, type SituacionReserva } from './operacion';

/** Si la persona puede pedir canchas o sumarse a partidos en este momento. */
export function usePuedeReservar(): {
  puede: boolean; situacion: SituacionReserva | null; motivoPausa: string | null; cargando: boolean;
} {
  const { session } = useAuth();
  const operacion = useEstadoOperacion();
  const situacion = situacionReserva(operacion.data, !!session);
  return {
    // Si no se pudo consultar, se deja intentar: el servidor valida igual.
    puede: situacion === null || situacion === 'lista',
    situacion,
    motivoPausa: operacion.data?.motivo_pausa ?? null,
    cargando: operacion.isPending,
  };
}
