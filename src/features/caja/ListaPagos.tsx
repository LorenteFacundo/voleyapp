import { Ban } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import type { PagoCaja } from '@/api/tipos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { formatFechaCorta, formatFechaHora } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { etiquetaMedio } from './etiquetas';
import { useAnularPago } from './useMutacionesCaja';

function describirReserva(pago: PagoCaja): string {
  if (!pago.ocupacion) return 'Pago a cuenta';
  const { titulo, cancha, inicio } = pago.ocupacion;
  return [titulo, cancha, formatFechaHora(inicio)].filter(Boolean).join(' · ');
}

function Monto({ pago }: { pago: PagoCaja }) {
  const devolucion = pago.monto < 0;
  return (
    <span
      className={clsx(
        'whitespace-nowrap font-bold tabular-nums',
        pago.anulado ? 'text-ink/65 line-through' : devolucion ? 'text-red-700' : 'text-ink',
      )}
    >
      {devolucion ? `−${formatMoney(-pago.monto)}` : formatMoney(pago.monto)}
    </span>
  );
}

function Etiquetas({ pago }: { pago: PagoCaja }) {
  return (
    <>
      {pago.monto < 0 && <Badge variant="danger">Devolución</Badge>}
      {pago.anulado && <Badge variant="muted">Anulado</Badge>}
    </>
  );
}

/** Pagos del período con la opción de anular (queda registrado, tachado). */
export function ListaPagos({ pagos }: { pagos: PagoCaja[] }) {
  const confirmar = useConfirmar();
  const anular = useAnularPago();

  async function pedirAnulacion(pago: PagoCaja) {
    const { confirmado } = await confirmar({
      titulo: '¿Anular este pago?',
      descripcion: (
        <>
          <p>
            {formatMoney(Math.abs(pago.monto))} en {etiquetaMedio(pago.medio).toLowerCase()} del {formatFechaCorta(pago.fecha)}
            {pago.cliente ? <> de <strong>{pago.cliente.nombre}</strong></> : null}.
          </p>
          <p className="mt-2">
            Deja de contar en la caja{pago.cliente ? ' y en el saldo del cliente' : ''}. El pago queda en la lista, tachado.
          </p>
        </>
      ),
      confirmar: 'Anular pago',
      peligro: true,
    });
    if (!confirmado) return;
    anular.mutate({ id: pago.id, clienteId: pago.cliente?.id ?? null }, {
      onSuccess: () => toast.success('Pago anulado.'),
      onError: (error) => toast.error(mensajeDeError(error)),
    });
  }

  const botonAnular = (pago: PagoCaja) => (
    pago.anulado ? null : (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void pedirAnulacion(pago)}
        loading={anular.isPending && anular.variables?.id === pago.id}
        aria-label={`Anular pago de ${formatMoney(Math.abs(pago.monto))}${pago.cliente ? ` de ${pago.cliente.nombre}` : ''}`}
      >
        <Ban size={14} aria-hidden="true" /> Anular
      </Button>
    )
  );

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {pagos.map((pago) => (
          <li key={pago.id} className={clsx('rounded-2xl border border-vb-gray/10 bg-white p-3 shadow-card', pago.anulado && 'bg-ink/[0.02]')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={clsx('truncate font-semibold text-ink', pago.anulado && 'text-ink/65 line-through')}>
                  {pago.cliente?.nombre ?? 'Sin cliente'}
                </p>
                <p className="text-sm text-ink/65">{formatFechaCorta(pago.fecha)} · {etiquetaMedio(pago.medio)}</p>
              </div>
              <Monto pago={pago} />
            </div>
            <p className="mt-1 text-sm text-ink/70">{describirReserva(pago)}</p>
            {pago.nota && <p className="mt-0.5 text-sm text-ink/65">«{pago.nota}»</p>}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-1 text-xs text-ink/65">
                <Etiquetas pago={pago} /> Registró {pago.registrado_por}
              </span>
              {botonAnular(pago)}
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-vb-gray/10 bg-white shadow-card md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Pagos del período</caption>
          <thead className="border-b border-ink/10 bg-ink/[0.02] text-xs font-semibold uppercase tracking-wide text-ink/65">
            <tr>
              <th scope="col" className="px-4 py-3">Fecha</th>
              <th scope="col" className="px-4 py-3">Cliente y reserva</th>
              <th scope="col" className="px-4 py-3">Medio</th>
              <th scope="col" className="px-4 py-3">Nota</th>
              <th scope="col" className="px-4 py-3">Registró</th>
              <th scope="col" className="px-4 py-3 text-right">Monto</th>
              <th scope="col" className="px-2 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {pagos.map((pago) => (
              <tr key={pago.id} className={clsx(pago.anulado && 'bg-ink/[0.02] text-ink/65')}>
                <td className="whitespace-nowrap px-4 py-2.5">{formatFechaCorta(pago.fecha)}</td>
                <td className="px-4 py-2.5">
                  <span className={clsx('font-semibold text-ink', pago.anulado && 'text-ink/65 line-through')}>
                    {pago.cliente?.nombre ?? 'Sin cliente'}
                  </span>
                  <span className="block text-xs text-ink/65">{describirReserva(pago)}</span>
                  <span className="mt-0.5 flex gap-1"><Etiquetas pago={pago} /></span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">{etiquetaMedio(pago.medio)}</td>
                <td className="max-w-56 px-4 py-2.5 text-ink/70">{pago.nota ?? '—'}</td>
                <td className="px-4 py-2.5 text-ink/70">{pago.registrado_por}</td>
                <td className="px-4 py-2.5 text-right"><Monto pago={pago} /></td>
                <td className="px-2 py-1.5 text-right">{botonAnular(pago)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
