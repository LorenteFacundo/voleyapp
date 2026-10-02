import type { ClienteListado } from '@/api/tipos';
import { Badge } from '@/components/ui/Badge';
import { pluralizar } from '@/lib/format';
import { formatTelefono } from '@/lib/telefono';
import { useGestion } from '@/contexts/gestion';
import { EnlaceWhatsApp } from '@/components/ui/EnlaceWhatsApp';
import { formatDiaDeInstante, formatInstante } from './formato';
import { mensajeSaludo } from './mensajes';
import { SaldoCliente } from './SaldoCliente';

type Props = {
  clientes: ClienteListado[];
  onAbrir: (clienteId: number) => void;
};

function Etiquetas({ cliente }: { cliente: ClienteListado }) {
  return (
    <>
      {cliente.es_usuario_app && <Badge variant="info">App</Badge>}
      {cliente.archivado && <Badge variant="muted">Archivado</Badge>}
    </>
  );
}

/** Tarjetas en el celular; tabla en pantallas anchas. */
export function ListaClientes({ clientes, onAbrir }: Props) {
  const { panel } = useGestion();

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {clientes.map((cliente) => (
          <li key={cliente.id} className="flex items-start gap-1 rounded-2xl border border-vb-gray/10 bg-white p-1 shadow-card">
            <button
              type="button"
              onClick={() => onAbrir(cliente.id)}
              className="min-w-0 flex-1 rounded-xl p-2.5 text-left transition hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate font-bold text-ink">{cliente.nombre}</span>
                <Etiquetas cliente={cliente} />
              </span>
              <span className="mt-0.5 block text-sm text-ink/65">
                {cliente.telefono ? formatTelefono(cliente.telefono) : 'Sin teléfono'}
              </span>
              <span className="mt-1 block text-sm"><SaldoCliente saldo={cliente.saldo} /></span>
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink/65">
                <span>{pluralizar(Number(cliente.reservas), 'reserva')}</span>
                {cliente.ultima && <span>Última: {formatDiaDeInstante(cliente.ultima)}</span>}
                {cliente.proxima && <span>Próxima: {formatInstante(cliente.proxima)}</span>}
                {Number(cliente.fijos) > 0 && <span>{pluralizar(Number(cliente.fijos), 'fijo')}</span>}
              </span>
            </button>
            {cliente.telefono && (
              <EnlaceWhatsApp
                variante="icono"
                telefono={cliente.telefono}
                mensaje={mensajeSaludo(cliente.nombre, panel.club.nombre)}
                etiqueta={`Escribirle a ${cliente.nombre} por WhatsApp`}
                className="mt-1"
              />
            )}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-vb-gray/10 bg-white shadow-card md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Clientes del club</caption>
          <thead className="border-b border-ink/10 bg-ink/[0.02] text-xs font-semibold uppercase tracking-wide text-ink/65">
            <tr>
              <th scope="col" className="px-4 py-3">Cliente</th>
              <th scope="col" className="px-4 py-3">Teléfono</th>
              <th scope="col" className="px-4 py-3 text-right">Saldo</th>
              <th scope="col" className="px-4 py-3 text-right">Reservas</th>
              <th scope="col" className="px-4 py-3">Última</th>
              <th scope="col" className="px-4 py-3">Próxima</th>
              <th scope="col" className="px-4 py-3 text-right">Fijos</th>
              <th scope="col" className="px-2 py-3"><span className="sr-only">WhatsApp</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {clientes.map((cliente) => (
              <tr key={cliente.id} className="transition hover:bg-ink/[0.02]">
                <th scope="row" className="px-4 py-2 font-normal">
                  <span className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAbrir(cliente.id)}
                      className="rounded-md text-left font-semibold text-vb-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
                    >
                      {cliente.nombre}
                    </button>
                    <Etiquetas cliente={cliente} />
                  </span>
                </th>
                <td className="whitespace-nowrap px-4 py-2 text-ink/70">
                  {cliente.telefono ? formatTelefono(cliente.telefono) : <span className="text-ink/65">Sin teléfono</span>}
                </td>
                <td className="px-4 py-2 text-right"><SaldoCliente saldo={cliente.saldo} /></td>
                <td className="px-4 py-2 text-right tabular-nums text-ink/80">{cliente.reservas}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink/70">{cliente.ultima ? formatDiaDeInstante(cliente.ultima) : '—'}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink/70">{cliente.proxima ? formatInstante(cliente.proxima) : '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums text-ink/80">{cliente.fijos}</td>
                <td className="px-2 py-1 text-right">
                  {cliente.telefono && (
                    <EnlaceWhatsApp
                      variante="icono"
                      telefono={cliente.telefono}
                      mensaje={mensajeSaludo(cliente.nombre, panel.club.nombre)}
                      etiqueta={`Escribirle a ${cliente.nombre} por WhatsApp`}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
