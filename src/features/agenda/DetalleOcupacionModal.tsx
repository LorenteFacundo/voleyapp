import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRightLeft, Ban, Check, Clock, Pencil, Unlock, X } from 'lucide-react';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { ClubPanel, Ocupacion } from '@/api/tipos';
import {
  fechaArgentina, formatDuracion, formatFechaCorta, formatFechaHora, formatRangoHorario, formatRelativo, minutosEntre,
} from '@/lib/date';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import {
  AvisoInactiva, AvisoPosterior, InsigniasDetalle, SeccionAsistencia, SeccionCliente, SeccionCobro, SeccionMasDatos,
} from './DetalleSecciones';
import { EditarOcupacionForm, MoverOcupacionForm } from './FormulariosOcupacion';
import { useAhora, useInvalidarAgenda } from './hooks';
import {
  cuentaRegresiva, esActiva, esFijo, nombreDeOcupacion, telefonoDeOcupacion, usaLaApp,
} from './presentacion';
import { useResolverPedido } from './useResolverPedido';

type Props = {
  clubId: number;
  panel: ClubPanel;
  esDueno: boolean;
  ocupacion: Ocupacion;
  hoy: string;
  onClose: () => void;
  /** Recibe la versión nueva después de cada cambio. */
  onActualizada: (ocupacion: Ocupacion) => void;
};

/** Ficha de una reserva o bloqueo con todas las acciones que admite su estado. */
export function DetalleOcupacionModal({ clubId, panel, esDueno, ocupacion, hoy, onClose, onActualizada }: Props) {
  const ahora = useAhora(15_000);
  const [vista, setVista] = useState<'resumen' | 'editar' | 'mover'>('resumen');
  const [aviso, setAviso] = useState<'cancelada' | 'movida' | null>(null);
  const pedirConfirmacion = useConfirmar();
  const invalidar = useInvalidarAgenda(clubId);
  const pedido = useResolverPedido(clubId, (resuelta, estado) => onActualizada({ ...resuelta, estado }));

  const cancha = panel.canchas.find((item) => item.id === ocupacion.cancha_id)?.titulo ?? 'Cancha';
  const esBloqueo = ocupacion.tipo === 'bloqueo';
  const fijo = esFijo(ocupacion);
  const nombre = nombreDeOcupacion(ocupacion);
  const variosDias = fechaArgentina(ocupacion.inicio) !== fechaArgentina(new Date(Date.parse(ocupacion.fin) - 1));
  const cuando = variosDias
    ? `${formatFechaHora(ocupacion.inicio)} a ${formatFechaHora(ocupacion.fin)}`
    : `${formatFechaCorta(fechaArgentina(ocupacion.inicio))} · ${formatRangoHorario(ocupacion.inicio, ocupacion.fin)}`;

  const cancelar = useMutation({
    mutationFn: (motivo: string | null) => clubApi.cancelarOcupacion(ocupacion.id, motivo),
    onSuccess: (cancelada) => {
      if (cancelada.tipo === 'bloqueo') {
        toast.success('Quitaste el bloqueo. El horario vuelve a estar disponible.');
        onClose();
        return;
      }
      toast.success(fijo ? 'Liberaste esta fecha del turno fijo.' : 'Cancelaste la reserva.');
      setAviso('cancelada');
      onActualizada(cancelada);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
    onSettled: () => {
      void invalidar({ clienteId: ocupacion.cliente?.id, partidos: !!ocupacion.partido });
    },
  });

  async function pedirCancelacion() {
    const telefono = telefonoDeOcupacion(ocupacion);
    const respuesta = await pedirConfirmacion(esBloqueo
      ? { titulo: 'Quitar bloqueo', descripcion: `${cancha} vuelve a estar disponible: ${cuando}.`, confirmar: 'Quitar bloqueo' }
      : {
        titulo: fijo ? 'Liberar esta fecha' : 'Cancelar reserva',
        descripcion: [
          fijo ? 'Solo se libera esta fecha: el turno fijo sigue las próximas semanas.' : null,
          ocupacion.partido ? 'También se cancela el partido y avisamos a los anotados.' : null,
          usaLaApp(ocupacion) && !fijo
            ? `${nombre} recibe el aviso por la app.`
            : telefono ? `Después te dejamos el mensaje listo para avisarle a ${nombre} por WhatsApp.` : null,
        ].filter(Boolean).join(' ') || undefined,
        confirmar: fijo ? 'Liberar fecha' : 'Cancelar reserva',
        cancelar: 'Volver',
        peligro: true,
        pedirMotivo: { etiqueta: 'Motivo (opcional)', placeholder: 'Ej.: lluvia, problema con la cancha' },
      });
    if (respuesta.confirmado) cancelar.mutate(respuesta.motivo || null);
  }

  const resumen = (
    <div className="space-y-5">
      {aviso && <AvisoPosterior tipo={aviso} ocupacion={ocupacion} club={panel.club} cancha={cancha} hoy={hoy} />}
      <InsigniasDetalle ocupacion={ocupacion} ahora={ahora} />
      {!esActiva(ocupacion) && <AvisoInactiva ocupacion={ocupacion} />}

      {ocupacion.estado === 'pendiente' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <Clock size={16} aria-hidden="true" />
            Pedido desde la app · {ocupacion.vence_at ? cuentaRegresiva(ocupacion.vence_at, ahora).texto : 'sin vencimiento'}
          </p>
          <p className="mt-1 text-sm text-amber-950/80">Si no lo respondés a tiempo, vence y el horario se libera.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void pedido.rechazar(ocupacion)} disabled={pedido.procesando !== null}>
              <X size={17} aria-hidden="true" /> Rechazar
            </Button>
            <Button variant="success" onClick={() => pedido.confirmar(ocupacion)} loading={pedido.procesando === ocupacion.id}>
              <Check size={17} aria-hidden="true" /> Confirmar
            </Button>
          </div>
        </div>
      )}

      {!esBloqueo && <SeccionCliente ocupacion={ocupacion} club={panel.club} cancha={cancha} hoy={hoy} />}
      {!esBloqueo && (
        <SeccionCobro clubId={clubId} ocupacion={ocupacion} esDueno={esDueno} ahora={ahora} onActualizada={onActualizada} />
      )}
      {!esBloqueo && ocupacion.estado === 'confirmada' && Date.parse(ocupacion.inicio) <= ahora && (
        <SeccionAsistencia clubId={clubId} ocupacion={ocupacion} onActualizada={onActualizada} />
      )}
      <SeccionMasDatos ocupacion={ocupacion} />

      <p className="text-xs text-ink/65">
        {esBloqueo ? 'Bloqueo' : 'Reserva'} de {formatDuracion(minutosEntre(ocupacion.inicio, ocupacion.fin))}
        {' · '}cargada {formatRelativo(ocupacion.created_at, new Date(ahora))}
      </p>

      {ocupacion.estado === 'confirmada' && (
        <div className="grid gap-2 border-t border-ink/10 pt-4 sm:flex sm:flex-wrap sm:justify-end">
          {esBloqueo ? (
            <Button variant="danger" onClick={() => void pedirCancelacion()} loading={cancelar.isPending}>
              <Unlock size={17} aria-hidden="true" /> Quitar bloqueo
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setVista('editar')}>
                <Pencil size={16} aria-hidden="true" /> Editar precio y notas
              </Button>
              <Button variant="secondary" onClick={() => setVista('mover')}>
                <ArrowRightLeft size={16} aria-hidden="true" /> Mover
              </Button>
              <Button variant="secondary" onClick={() => void pedirCancelacion()} loading={cancelar.isPending}>
                <Ban size={16} aria-hidden="true" className="text-red-700" />
                <span className="text-red-700">{fijo ? 'Liberar esta fecha' : 'Cancelar reserva'}</span>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={vista === 'editar' ? 'Editar reserva' : vista === 'mover' ? 'Mover reserva' : esBloqueo ? `Bloqueo: ${nombre}` : nombre}
      descripcion={`${cancha} · ${cuando}`}
      size="md"
      bloqueado={cancelar.isPending}
    >
      {vista === 'editar' ? (
        <EditarOcupacionForm
          clubId={clubId}
          ocupacion={ocupacion}
          onVolver={() => setVista('resumen')}
          onListo={(actualizada) => {
            onActualizada(actualizada);
            setVista('resumen');
          }}
        />
      ) : vista === 'mover' ? (
        <MoverOcupacionForm
          clubId={clubId}
          ocupacion={ocupacion}
          canchas={panel.canchas}
          onVolver={() => setVista('resumen')}
          onListo={(movida) => {
            onActualizada(movida);
            setAviso('movida');
            setVista('resumen');
          }}
        />
      ) : resumen}
    </Modal>
  );
}
