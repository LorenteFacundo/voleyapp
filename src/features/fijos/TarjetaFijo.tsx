import { useId } from 'react';
import { CalendarClock, Pencil } from 'lucide-react';
import clsx from 'clsx';
import type { Serie } from '@/api/tipos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDiaMes, formatDuracion } from '@/lib/date';
import { formatMoney, pluralizar } from '@/lib/format';
import { useGestion } from '@/contexts/gestion';
import { EnlaceWhatsApp } from '@/components/ui/EnlaceWhatsApp';
import { formatInstante } from '@/features/clientes/formato';
import { mensajeCobro, mensajeSaludo } from '@/features/clientes/mensajes';
import { describirFijoParaMensaje, horaFin } from './fijos';

type Props = {
  serie: Serie;
  onModificar: () => void;
  onTerminar: () => void;
  onVerCliente: (clienteId: number) => void;
};

/** Un alquiler fijo con su horario, cobro y acciones. */
export function TarjetaFijo({ serie, onModificar, onTerminar, onVerCliente }: Props) {
  const { panel } = useGestion();
  const tituloId = useId();
  const deuda = Number(serie.deuda);
  const cliente = serie.cliente;

  return (
    <article
      aria-labelledby={tituloId}
      className={clsx(
        'flex flex-col rounded-2xl border border-l-4 border-vb-gray/10 bg-white p-4 shadow-card',
        serie.vigente ? 'border-l-indigo-500' : 'border-l-ink/20 opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 id={tituloId} className="truncate text-base font-bold text-ink">{serie.titulo}</h4>
          {cliente ? (
            <button
              type="button"
              onClick={() => onVerCliente(cliente.id)}
              className="max-w-full truncate rounded text-left text-sm text-vb-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
            >
              {cliente.nombre}
            </button>
          ) : (
            <p className="text-sm text-ink/65">Sin cliente asignado</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-ink">{formatMoney(serie.precio)}</p>
          {!serie.vigente && <Badge variant="muted">Finalizado</Badge>}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-ink/65">Horario</dt>
          <dd className="font-semibold text-ink">{serie.hora_inicio}–{horaFin(serie.hora_inicio, serie.duracion_min)}</dd>
          <dd className="text-xs text-ink/65">{formatDuracion(serie.duracion_min)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-ink/65">Cancha</dt>
          <dd className="truncate font-semibold text-ink">{serie.cancha.titulo}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/65">Próxima</dt>
          <dd className="text-ink">{serie.proxima ? formatInstante(serie.proxima) : 'Sin fechas por delante'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/65">Fechas generadas</dt>
          <dd className="text-ink">{pluralizar(Number(serie.fechas_futuras), 'fecha')}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/65">Vigencia</dt>
          <dd className="text-ink">
            Desde el {formatDiaMes(serie.desde)}
            {serie.hasta ? ` al ${formatDiaMes(serie.hasta)}` : ', sin fin'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink/65">Deuda</dt>
          <dd className={deuda > 0 ? 'font-bold text-red-700' : 'text-ink/65'}>{deuda > 0 ? formatMoney(deuda) : 'Al día'}</dd>
        </div>
      </dl>

      {serie.notas && <p className="mt-2 line-clamp-2 text-xs text-ink/65">{serie.notas}</p>}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {cliente?.telefono && (
          <EnlaceWhatsApp
            tamano="sm"
            telefono={cliente.telefono}
            mensaje={deuda > 0
              ? mensajeCobro({
                cliente: cliente.nombre,
                monto: deuda,
                club: panel.club,
                motivo: describirFijoParaMensaje(serie.dia_semana, serie.hora_inicio),
              })
              : mensajeSaludo(cliente.nombre, panel.club.nombre)}
            etiqueta={deuda > 0 ? `Cobrarle a ${cliente.nombre}` : `Escribirle a ${cliente.nombre}`}
          >
            {deuda > 0 ? 'Cobrar' : 'Escribir'}
          </EnlaceWhatsApp>
        )}
        {serie.vigente && (
          <>
            <Button variant="secondary" size="sm" onClick={onModificar} aria-label={`Modificar el fijo ${serie.titulo}`}>
              <Pencil size={14} aria-hidden="true" /> Modificar
            </Button>
            <Button variant="ghost" size="sm" onClick={onTerminar} aria-label={`Terminar el fijo ${serie.titulo}`}>
              <CalendarClock size={14} aria-hidden="true" /> Terminar
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
