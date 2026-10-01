import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import type { MedioPago } from '@/api/tipos';
import { formatMoney } from '@/lib/format';
import { textoSaldo } from '@/features/clientes/mensajes';
import { useInvalidarGestion } from '@/features/clientes/useInvalidarGestion';
import { useGestion } from '@/contexts/gestion';

/** Confirmación visible de un cobro o devolución, con el saldo que le queda al cliente. */
export function avisarPagoRegistrado(monto: number, saldoCliente: number | null | undefined): void {
  const devolucion = monto < 0;
  toast.success(
    devolucion ? `Devolución de ${formatMoney(-monto)} registrada.` : `Pago de ${formatMoney(monto)} registrado.`,
    {
      description: saldoCliente !== null && saldoCliente !== undefined
        ? `Saldo del cliente: ${textoSaldo(Number(saldoCliente)).texto}.`
        : undefined,
    },
  );
}

export type NuevoPago = {
  /** Positivo para cobros; negativo para devoluciones. */
  monto: number;
  medio: MedioPago;
  fecha: string;
  nota: string | null;
  clienteId: number | null;
  ocupacionId: number | null;
  /** Cliente cuya ficha hay que refrescar (por ejemplo, el de la reserva). */
  clienteAfectado?: number | null;
};

export function useRegistrarPago() {
  const { clubId } = useGestion();
  const invalidar = useInvalidarGestion();
  return useMutation({
    mutationFn: ({ clienteAfectado: _clienteAfectado, ...datos }: NuevoPago) => clubApi.registrarPago({ clubId, ...datos }),
    onSuccess: (_resultado, pago) => invalidar(pago.clienteAfectado, pago.clienteId),
  });
}

export function useAnularPago() {
  const invalidar = useInvalidarGestion();
  return useMutation({
    mutationFn: (pago: { id: number; clienteId: number | null }) => clubApi.anularPago(pago.id),
    onSuccess: (_resultado, pago) => invalidar(pago.clienteId),
  });
}
