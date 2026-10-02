import { useId } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PagoForm, type ValoresPago } from './PagoForm';
import { avisarPagoRegistrado, useRegistrarPago } from './useMutacionesCaja';

/** Qué cobro o devolución registrar (todo opcional: sin datos, es un pago a cuenta a elegir). */
export type PedidoPago = Omit<Props, 'onClose'>;

type Props = {
  onClose: () => void;
  modo?: 'pago' | 'devolucion';
  /** Pago a cuenta de un cliente ya elegido. */
  cliente?: { id: number; nombre: string } | null;
  /** Pago (o devolución) de una reserva puntual. */
  ocupacion?: { id: number; descripcion: string; clienteId: number | null } | null;
  montoSugerido?: number | null;
  montoMaximo?: number | null;
};

/**
 * Registrar un cobro o una devolución. Sin cliente ni reserva, deja
 * buscar al cliente (pago a cuenta).
 */
export function RegistrarPagoModal({
  onClose, modo = 'pago', cliente = null, ocupacion = null, montoSugerido, montoMaximo,
}: Props) {
  const formId = useId();
  const registrar = useRegistrarPago();
  const devolucion = modo === 'devolucion';
  const elegirCliente = !cliente && !ocupacion;

  const titulo = devolucion ? 'Registrar devolución' : cliente ? 'Registrar pago a cuenta' : 'Registrar pago';
  const descripcion = ocupacion?.descripcion
    ?? (cliente ? `De ${cliente.nombre}. Queda a cuenta de sus turnos.` : 'Elegí el cliente y cuánto pagó.');

  function enviar(valores: ValoresPago) {
    const clienteId = cliente?.id ?? valores.cliente?.id ?? null;
    const monto = devolucion ? -valores.monto : valores.monto;
    registrar.mutate({
      monto,
      medio: valores.medio,
      fecha: valores.fecha,
      nota: valores.nota,
      ocupacionId: ocupacion?.id ?? null,
      // Con reserva, el servidor toma el cliente de la reserva.
      clienteId: ocupacion ? null : clienteId,
      clienteAfectado: ocupacion?.clienteId ?? clienteId,
    }, {
      onSuccess: (resultado) => {
        avisarPagoRegistrado(monto, resultado.saldo_cliente);
        onClose();
      },
      onError: (error) => toast.error(mensajeDeError(error)),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={titulo}
      descripcion={descripcion}
      bloqueado={registrar.isPending}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={registrar.isPending}>Cancelar</Button>
          <Button type="submit" form={formId} variant={devolucion ? 'danger' : 'primary'} loading={registrar.isPending}>
            {devolucion ? 'Registrar devolución' : 'Registrar pago'}
          </Button>
        </>
      )}
    >
      <PagoForm
        id={formId}
        modo={modo}
        elegirCliente={elegirCliente}
        montoInicial={montoSugerido}
        montoMaximo={montoMaximo}
        notaInicial={devolucion ? 'Devolución' : ''}
        onSubmit={enviar}
      />
    </Modal>
  );
}
