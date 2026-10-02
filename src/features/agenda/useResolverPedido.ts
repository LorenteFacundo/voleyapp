import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { Ocupacion } from '@/api/tipos';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { useInvalidarAgenda } from './hooks';
import { nombreDeOcupacion } from './presentacion';

type Resultado = 'confirmada' | 'rechazada' | 'vencida';

/**
 * Confirmar o rechazar pedidos hechos desde la app. Rechazar pide un motivo
 * opcional. Si el pedido venció mientras tanto, se avisa con claridad.
 */
export function useResolverPedido(clubId: number, alResolver?: (ocupacion: Ocupacion, estado: Resultado) => void) {
  const pedirConfirmacion = useConfirmar();
  const invalidar = useInvalidarAgenda(clubId);

  const mutacion = useMutation({
    mutationFn: (datos: { ocupacion: Ocupacion; confirmar: boolean; motivo: string | null }) =>
      clubApi.resolverSolicitud(datos.ocupacion.id, datos.confirmar, datos.motivo),
    onSuccess: (resultado, { ocupacion }) => {
      const nombre = nombreDeOcupacion(ocupacion);
      if (resultado.estado === 'vencida') {
        toast.warning(`El pedido de ${nombre} venció antes de que lo respondieras y el horario quedó libre.`);
      } else if (resultado.estado === 'confirmada') {
        toast.success(`Confirmaste la reserva de ${nombre}. Le avisamos por la app.`);
      } else {
        toast.success(`Rechazaste el pedido de ${nombre}. Le avisamos por la app.`);
      }
      alResolver?.(ocupacion, resultado.estado);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
    onSettled: () => {
      void invalidar();
    },
  });

  const confirmar = (ocupacion: Ocupacion) => mutacion.mutate({ ocupacion, confirmar: true, motivo: null });

  const rechazar = async (ocupacion: Ocupacion) => {
    const respuesta = await pedirConfirmacion({
      titulo: 'Rechazar pedido',
      descripcion: `${nombreDeOcupacion(ocupacion)} recibe el aviso por la app y el horario queda libre.`,
      confirmar: 'Rechazar pedido',
      peligro: true,
      pedirMotivo: { etiqueta: 'Motivo (opcional)', placeholder: 'Ej.: ese día la cancha está reservada para un torneo' },
    });
    if (respuesta.confirmado) mutacion.mutate({ ocupacion, confirmar: false, motivo: respuesta.motivo || null });
  };

  return {
    confirmar,
    rechazar,
    /** Id del pedido que se está procesando, si hay uno. */
    procesando: mutacion.isPending ? mutacion.variables?.ocupacion.id ?? null : null,
  };
}
