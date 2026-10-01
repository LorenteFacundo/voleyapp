import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Crown, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { PartidoDetalle } from '@/api/tipos';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { mensajeDeError } from '@/api/cliente';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { Seccion } from '@/features/jugador/Seccion';
import { ModalEditarPartido } from './ModalEditarPartido';
import { ModalTransferir } from './ModalTransferir';

/** Herramientas de quien organiza (o del club): editar, pasar la organización y cancelar. */
export function PanelOrganizador({ partido }: { partido: PartidoDetalle }) {
  const queryClient = useQueryClient();
  const confirmar = useConfirmar();
  const [modal, setModal] = useState<'editar' | 'transferir' | null>(null);
  const activo = ['borrador', 'abierto', 'confirmado'].includes(partido.estado_partido);

  const cancelar = useMutation({
    mutationFn: (motivo: string) => jugadorApi.cancelarPartido(partido.id, motivo),
    onSuccess: () => {
      toast.success('Cancelaste el partido. Les avisamos a quienes estaban anotados.');
      void queryClient.invalidateQueries({ queryKey: claves.partidos });
      void queryClient.invalidateQueries({ queryKey: claves.reservas });
      void queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  if (!activo || (!partido.soy_organizador && !partido.soy_staff)) return null;

  async function pedirCancelacion() {
    const respuesta = await confirmar({
      titulo: '¿Cancelar el partido?',
      descripcion: (
        <div className="space-y-2">
          <p>Les avisamos a todas las personas anotadas que el partido no se juega.</p>
          {partido.estado_reserva === 'pendiente' ? (
            <p>Como el club todavía no confirmó la cancha, también retiramos el pedido.</p>
          ) : partido.organiza_club ? (
            <p>El turno sigue ocupado en la agenda del club: liberalo desde la agenda si no se va a usar.</p>
          ) : (
            <p className="font-semibold text-ink">
              La reserva de la cancha sigue a nombre de quien la pidió. Si no la van a usar, se cancela desde Mis reservas.
            </p>
          )}
        </div>
      ),
      confirmar: 'Sí, cancelar partido',
      cancelar: 'Volver',
      peligro: true,
      pedirMotivo: { etiqueta: 'Motivo (opcional)', placeholder: 'Se lo contamos a quienes estaban anotados' },
    });
    if (respuesta.confirmado) cancelar.mutate(respuesta.motivo);
  }

  return (
    <Card padding="lg">
      <Seccion
        titulo={partido.soy_organizador ? 'Organización' : 'Gestión del club'}
        descripcion={partido.soy_organizador ? undefined : 'Ves este partido como parte del equipo del club.'}
      >
        <div className="flex flex-wrap gap-2">
          {partido.soy_organizador && (
            <Button variant="secondary" size="sm" onClick={() => setModal('editar')}>
              <Pencil size={16} aria-hidden="true" /> Editar partido
            </Button>
          )}
          {partido.soy_organizador && !partido.organiza_club && (
            <Button variant="secondary" size="sm" onClick={() => setModal('transferir')}>
              <Crown size={16} aria-hidden="true" /> Pasar la organización
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={pedirCancelacion} loading={cancelar.isPending}>
            {!cancelar.isPending && <Ban size={16} aria-hidden="true" />} Cancelar partido
          </Button>
        </div>
      </Seccion>
      {modal === 'editar' && <ModalEditarPartido partido={partido} onCerrar={() => setModal(null)} />}
      {modal === 'transferir' && <ModalTransferir partido={partido} onCerrar={() => setModal(null)} />}
    </Card>
  );
}
