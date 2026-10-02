import { useState } from 'react';
import { Archive, ArchiveRestore, HandCoins, Pencil } from 'lucide-react';
import clsx from 'clsx';
import type { ClienteDetalle, Ocupacion, PagoDeCliente } from '@/api/tipos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DIAS_SEMANA, fechaArgentina, formatDuracion, formatFechaCorta, formatFechaHora } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { formatTelefono } from '@/lib/telefono';
import { useGestion } from '@/contexts/gestion';
import { etiquetaEstadoPago, etiquetaEstadoReserva, etiquetaMedio, yaEmpezo } from '@/features/caja/etiquetas';
import { EnlaceWhatsApp } from '@/components/ui/EnlaceWhatsApp';
import { mensajeCobro, mensajeSaludo } from './mensajes';
import { SaldoCliente } from './SaldoCliente';

const VISIBLES = 8;

type Props = {
  detalle: ClienteDetalle;
  onEditar: () => void;
  onPagar: () => void;
  onArchivar: () => void;
  archivando: boolean;
};

/** Ficha del cliente: contacto, saldo, acciones rápidas e historial. */
export function FichaCliente({ detalle, onEditar, onPagar, onArchivar, archivando }: Props) {
  const { panel } = useGestion();
  const { cliente } = detalle;
  const saldo = Number(detalle.saldo);
  const deuda = saldo < 0 ? -saldo : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {cliente.es_usuario_app && <Badge variant="info">Usa la app</Badge>}
        {cliente.archivado && <Badge variant="muted">Archivado</Badge>}
        <span className="text-xs text-ink/65">Cliente desde el {formatFechaCorta(fechaArgentina(cliente.created_at))}</span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/65">Teléfono</dt>
          <dd className="mt-0.5 text-ink">{cliente.telefono ? formatTelefono(cliente.telefono) : 'Sin teléfono'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/65">Email</dt>
          <dd className="mt-0.5 truncate">
            {cliente.email
              ? <a className="text-vb-blue underline-offset-2 hover:underline" href={`mailto:${cliente.email}`}>{cliente.email}</a>
              : <span className="text-ink">Sin email</span>}
          </dd>
        </div>
      </dl>

      <div className={clsx('rounded-2xl p-4', deuda > 0 ? 'bg-red-50' : saldo > 0 ? 'bg-green-50' : 'bg-ink/5')}>
        <p className="text-sm text-ink/65">Saldo</p>
        <p className="text-2xl"><SaldoCliente saldo={saldo} /></p>
        <p className="mt-1 text-xs text-ink/65">Pagos registrados menos turnos ya jugados.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {cliente.telefono && (
          <EnlaceWhatsApp
            telefono={cliente.telefono}
            mensaje={mensajeSaludo(cliente.nombre, panel.club.nombre)}
            etiqueta={`Escribirle a ${cliente.nombre}`}
          >
            Escribir
          </EnlaceWhatsApp>
        )}
        {cliente.telefono && deuda > 0 && (
          <EnlaceWhatsApp
            telefono={cliente.telefono}
            mensaje={mensajeCobro({ cliente: cliente.nombre, monto: deuda, club: panel.club })}
            etiqueta={`Cobrarle el saldo a ${cliente.nombre}`}
          >
            Cobrar saldo
          </EnlaceWhatsApp>
        )}
        <Button variant="secondary" onClick={onPagar}>
          <HandCoins size={16} aria-hidden="true" /> Registrar pago a cuenta
        </Button>
        <Button variant="secondary" onClick={onEditar}>
          <Pencil size={16} aria-hidden="true" /> Editar
        </Button>
        <Button variant="ghost" onClick={onArchivar} loading={archivando}>
          {cliente.archivado ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
          {cliente.archivado ? 'Desarchivar' : 'Archivar'}
        </Button>
      </div>
      {!cliente.telefono && (
        <p className="text-sm text-ink/65">Cargá su teléfono (en Editar) para escribirle por WhatsApp.</p>
      )}

      {cliente.notas && (
        <section aria-labelledby={`notas-${cliente.id}`}>
          <h3 id={`notas-${cliente.id}`} className="text-base font-bold">Notas</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{cliente.notas}</p>
        </section>
      )}

      <FijosDelCliente series={detalle.series} clienteId={cliente.id} />
      <ReservasDelCliente ocupaciones={detalle.ocupaciones} clienteId={cliente.id} />
      <PagosDelCliente pagos={detalle.pagos} clienteId={cliente.id} />
    </div>
  );
}

function FijosDelCliente({ series, clienteId }: { series: ClienteDetalle['series']; clienteId: number }) {
  const id = `fijos-${clienteId}`;
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-base font-bold">Fijos</h3>
      {series.length ? (
        <ul className="mt-2 space-y-2">
          {series.map((serie) => (
            <li key={serie.id} className="flex items-center justify-between gap-3 rounded-xl border border-l-4 border-ink/10 border-l-indigo-500 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{serie.titulo}</p>
                <p className="text-sm text-ink/65">
                  {DIAS_SEMANA[serie.dia_semana]} {serie.hora_inicio} · {formatDuracion(serie.duracion_min)}
                </p>
              </div>
              <Badge variant={serie.activa ? 'success' : 'muted'}>{serie.activa ? 'Activo' : 'Finalizado'}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink/65">No tiene alquileres fijos.</p>
      )}
    </section>
  );
}

function ReservasDelCliente({ ocupaciones, clienteId }: { ocupaciones: Ocupacion[]; clienteId: number }) {
  const { panel } = useGestion();
  const [todas, setTodas] = useState(false);
  const id = `reservas-${clienteId}`;
  const visibles = todas ? ocupaciones : ocupaciones.slice(0, VISIBLES);
  const nombreCancha = (canchaId: number) => panel.canchas.find((cancha) => cancha.id === canchaId)?.titulo ?? 'Cancha';

  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-base font-bold">Reservas recientes</h3>
      {ocupaciones.length ? (
        <>
          <ul className="mt-2 divide-y divide-ink/5 rounded-xl border border-ink/10">
            {visibles.map((ocupacion) => {
              const estado = etiquetaEstadoReserva(ocupacion);
              const pago = ocupacion.estado === 'confirmada' || ocupacion.estado_pago === 'a_devolver'
                ? etiquetaEstadoPago(ocupacion.estado_pago, yaEmpezo(ocupacion.inicio))
                : null;
              const activa = ocupacion.estado === 'pendiente' || ocupacion.estado === 'confirmada';
              return (
                <li key={ocupacion.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className={clsx('font-semibold text-ink', !activa && 'text-ink/65 line-through')}>
                      {formatFechaHora(ocupacion.inicio)}
                    </p>
                    <p className="text-sm text-ink/65">
                      {nombreCancha(ocupacion.cancha_id)}{ocupacion.titulo ? ` · ${ocupacion.titulo}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Badge variant={estado.variante} className={estado.className}>{estado.texto}</Badge>
                      {pago && <Badge variant={pago.variante} className={pago.className}>{pago.texto}</Badge>}
                    </div>
                    {Number(ocupacion.precio) > 0 && (
                      <span className="text-xs text-ink/65">
                        Pagó {formatMoney(ocupacion.pagado)} de {formatMoney(ocupacion.precio)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {ocupaciones.length > VISIBLES && (
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => setTodas(!todas)} aria-expanded={todas}>
              {todas ? 'Ver menos' : `Ver todas (${ocupaciones.length})`}
            </Button>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-ink/65">Todavía no tiene reservas.</p>
      )}
    </section>
  );
}

function PagosDelCliente({ pagos, clienteId }: { pagos: PagoDeCliente[]; clienteId: number }) {
  const [todos, setTodos] = useState(false);
  const id = `pagos-${clienteId}`;
  const visibles = todos ? pagos : pagos.slice(0, VISIBLES);

  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-base font-bold">Pagos</h3>
      {pagos.length ? (
        <>
          <ul className="mt-2 divide-y divide-ink/5 rounded-xl border border-ink/10">
            {visibles.map((pago) => (
              <li key={pago.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className={clsx('text-sm font-semibold text-ink', pago.anulado && 'text-ink/65 line-through')}>
                    {formatFechaCorta(pago.fecha)} · {etiquetaMedio(pago.medio)}
                  </p>
                  {pago.nota && <p className="text-sm text-ink/65">{pago.nota}</p>}
                  {pago.anulado && <Badge variant="muted" className="mt-1">Anulado</Badge>}
                </div>
                <span
                  className={clsx(
                    'shrink-0 font-bold',
                    pago.anulado ? 'text-ink/65 line-through' : Number(pago.monto) < 0 ? 'text-red-700' : 'text-green-700',
                  )}
                >
                  {Number(pago.monto) < 0 ? `−${formatMoney(-pago.monto)}` : formatMoney(pago.monto)}
                </span>
              </li>
            ))}
          </ul>
          {pagos.length > VISIBLES && (
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => setTodos(!todos)} aria-expanded={todos}>
              {todos ? 'Ver menos' : `Ver todos (${pagos.length})`}
            </Button>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-ink/65">No hay pagos registrados.</p>
      )}
    </section>
  );
}
