import { HandCoins, PartyPopper } from 'lucide-react';
import { useDeudas } from '@/api/consultas';
import { Button } from '@/components/ui/Button';
import { Aviso, Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { formatFechaHora } from '@/lib/date';
import { formatMoney, pluralizar } from '@/lib/format';
import { formatTelefono } from '@/lib/telefono';
import { useGestion } from '@/contexts/gestion';
import { EnlaceWhatsApp } from '@/components/ui/EnlaceWhatsApp';
import { mensajeCobro } from '@/features/clientes/mensajes';
import { contactoDeReserva } from './etiquetas';
import type { PedidoPago } from './RegistrarPagoModal';

type Props = {
  onRegistrarPago: (pedido: PedidoPago) => void;
  onVerCliente: (clienteId: number) => void;
};

/** Quién debe y cuánto: clientes con saldo negativo y turnos jugados sin cliente que quedaron impagos. */
export function DeudasClub({ onRegistrarPago, onVerCliente }: Props) {
  const { clubId, panel } = useGestion();
  const deudas = useDeudas(clubId);

  if (deudas.isPending) return <Cargando texto="Calculando deudas…" />;
  if (deudas.isError) return <ErrorCarga error={deudas.error} onRetry={() => deudas.refetch()} />;

  const { clientes, sin_cliente: sinCliente } = deudas.data;
  const nombreCancha = (id: number) => panel.canchas.find((cancha) => cancha.id === id)?.titulo ?? 'Cancha';
  const deudaClientes = clientes.reduce((total, deuda) => total - Number(deuda.saldo), 0);
  const deudaSinCliente = sinCliente.reduce((total, o) => total + Number(o.precio) - Number(o.pagado), 0);

  if (!clientes.length && !sinCliente.length) {
    return (
      <Vacio
        icono={<PartyPopper size={32} />}
        titulo="Nadie te debe plata"
        descripcion="Todos los turnos jugados están pagos. Cuando alguien quede debiendo, lo vas a ver acá."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Aviso tono="alerta">
        Te deben <strong>{formatMoney(deudaClientes + deudaSinCliente)}</strong>
        {clientes.length > 0 && <> entre {pluralizar(clientes.length, 'cliente')}</>}
        {sinCliente.length > 0 && <> y {pluralizar(sinCliente.length, 'turno')} sin cliente asignado</>}.
      </Aviso>

      {clientes.length > 0 && (
        <section aria-labelledby="deudas-clientes" className="space-y-3">
          <h3 id="deudas-clientes" className="text-base font-bold">Clientes que deben</h3>
          <ul className="grid gap-3 lg:grid-cols-2">
            {clientes.map(({ cliente, saldo, impagas }) => {
              const monto = -Number(saldo);
              return (
                <li key={cliente.id} className="flex flex-col gap-3 rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onVerCliente(cliente.id)}
                        className="max-w-full truncate rounded text-left font-bold text-vb-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
                      >
                        {cliente.nombre}
                      </button>
                      <p className="text-sm text-ink/65">
                        {cliente.telefono ? formatTelefono(cliente.telefono) : 'Sin teléfono'}
                        {Number(impagas) > 0 && ` · ${pluralizar(Number(impagas), 'turno impago', 'turnos impagos')}`}
                      </p>
                    </div>
                    <p className="shrink-0 whitespace-nowrap font-bold text-red-700">Debe {formatMoney(monto)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cliente.telefono && (
                      <EnlaceWhatsApp
                        tamano="sm"
                        telefono={cliente.telefono}
                        mensaje={mensajeCobro({ cliente: cliente.nombre, monto, club: panel.club })}
                        etiqueta={`Cobrarle a ${cliente.nombre} por WhatsApp`}
                      >
                        Cobrar
                      </EnlaceWhatsApp>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onRegistrarPago({
                        cliente: { id: cliente.id, nombre: cliente.nombre },
                        montoSugerido: monto,
                      })}
                    >
                      <HandCoins size={14} aria-hidden="true" /> Registrar pago
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sinCliente.length > 0 && (
        <section aria-labelledby="deudas-sin-cliente" className="space-y-3">
          <div>
            <h3 id="deudas-sin-cliente" className="text-base font-bold">Turnos impagos sin cliente</h3>
            <p className="text-sm text-ink/65">Reservas de los últimos 120 días que ya se jugaron y no tienen un cliente asignado.</p>
          </div>
          <ul className="divide-y divide-ink/5 rounded-2xl border border-vb-gray/10 bg-white shadow-card">
            {sinCliente.map((ocupacion) => {
              const falta = Number(ocupacion.precio) - Number(ocupacion.pagado);
              const contacto = contactoDeReserva(ocupacion);
              const descripcion = `${contacto.nombre} · ${nombreCancha(ocupacion.cancha_id)} · ${formatFechaHora(ocupacion.inicio)}`;
              return (
                <li key={ocupacion.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{formatFechaHora(ocupacion.inicio)} · {nombreCancha(ocupacion.cancha_id)}</p>
                    <p className="text-sm text-ink/65">{contacto.nombre}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="whitespace-nowrap font-bold text-red-700">Falta {formatMoney(falta)}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onRegistrarPago({
                        ocupacion: { id: ocupacion.id, descripcion, clienteId: null },
                        montoSugerido: falta,
                      })}
                      aria-label={`Registrar pago del turno ${descripcion}`}
                    >
                      Registrar pago
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
