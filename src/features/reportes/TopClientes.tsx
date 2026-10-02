import type { Reporte } from '@/api/tipos';
import { formatMoney, pluralizar } from '@/lib/format';

type Props = {
  clientes: Reporte['top_clientes'];
  onVerCliente: (clienteId: number) => void;
};

/** Los clientes que más reservaron en el período. */
export function TopClientes({ clientes, onVerCliente }: Props) {
  return (
    <section aria-labelledby="top-clientes" className="rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card">
      <h3 id="top-clientes" className="text-base font-bold">Clientes que más reservaron</h3>
      {clientes.length ? (
        <ol className="mt-3 divide-y divide-ink/5">
          {clientes.map((cliente, indice) => (
            <li key={cliente.cliente_id} className="flex items-center gap-3 py-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-vb-blue/10 text-xs font-bold text-vb-blue" aria-hidden="true">
                {indice + 1}
              </span>
              <button
                type="button"
                onClick={() => onVerCliente(cliente.cliente_id)}
                className="min-w-0 flex-1 truncate rounded text-left font-semibold text-vb-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
              >
                {cliente.nombre}
              </button>
              <span className="shrink-0 text-right text-sm">
                <span className="block font-semibold text-ink">{pluralizar(Number(cliente.reservas), 'reserva')}</span>
                <span className="block text-xs text-ink/65">{formatMoney(cliente.monto)}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-ink/65">Ninguna reserva del período tiene un cliente asignado.</p>
      )}
    </section>
  );
}
