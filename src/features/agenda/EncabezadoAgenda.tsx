import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import clsx from 'clsx';
import {
  addDaysToISODate, DIAS_SEMANA, DIAS_SEMANA_CORTOS, diaSemana, diferenciaEnDias, esFechaISO, formatDiaMes,
  formatFechaLarga, inicioDeSemana,
} from '@/lib/date';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export type VistaAgenda = 'dia' | 'semana';

type Props = {
  fecha: string;
  hoy: string;
  vista: VistaAgenda;
  /** Cantidad de pedidos sin responder por fecha (para marcar los días). */
  pedidosPorDia: ReadonlyMap<string, number>;
  onFecha: (fecha: string) => void;
  /** Abre un día en la vista diaria. */
  onDia: (fecha: string) => void;
  onVista: (vista: VistaAgenda) => void;
};

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function relativoDe(fecha: string, hoy: string): string | null {
  const diferencia = diferenciaEnDias(hoy, fecha);
  if (diferencia === 0) return 'Hoy';
  if (diferencia === 1) return 'Mañana';
  if (diferencia === -1) return 'Ayer';
  return null;
}

export function EncabezadoAgenda({ fecha, hoy, vista, pedidosPorDia, onFecha, onDia, onVista }: Props) {
  const lunes = inicioDeSemana(fecha);
  const dias = Array.from({ length: 7 }, (_, indice) => addDaysToISODate(lunes, indice));
  const paso = vista === 'dia' ? 1 : 7;
  const otroAnio = fecha.slice(0, 4) !== hoy.slice(0, 4) ? ` de ${fecha.slice(0, 4)}` : '';
  const titulo = vista === 'dia'
    ? `${capitalizar(formatFechaLarga(fecha))}${otroAnio}`
    : `Semana del ${formatDiaMes(lunes)} al ${formatDiaMes(dias[6])}${otroAnio}`;
  const relativo = vista === 'dia' ? relativoDe(fecha, hoy) : dias.includes(hoy) ? 'Esta semana' : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0" aria-live="polite">
          <h2 className="font-display text-xl font-black leading-tight text-vb-blue sm:text-2xl">{titulo}</h2>
          {relativo && <p className="text-sm font-bold text-vb-orange-ink">{relativo}</p>}
        </div>
        <div role="group" aria-label="Vista de la agenda" className="flex rounded-xl bg-ink/5 p-1">
          {([
            { id: 'dia', etiqueta: 'Día', Icono: CalendarDays },
            { id: 'semana', etiqueta: 'Semana', Icono: List },
          ] as const).map(({ id, etiqueta, Icono }) => (
            <button
              key={id}
              type="button"
              aria-pressed={vista === id}
              onClick={() => onVista(id)}
              className={clsx(
                'flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
                vista === id ? 'bg-white text-vb-blue shadow-sm' : 'text-ink/65 hover:text-ink',
              )}
            >
              <Icono size={16} aria-hidden="true" /> {etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label={vista === 'dia' ? 'Día anterior' : 'Semana anterior'}
          onClick={() => onFecha(addDaysToISODate(fecha, -paso))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </Button>
        <Button variant="secondary" onClick={() => onFecha(hoy)} disabled={fecha === hoy}>Hoy</Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label={vista === 'dia' ? 'Día siguiente' : 'Semana siguiente'}
          onClick={() => onFecha(addDaysToISODate(fecha, paso))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </Button>
        <Input
          type="date"
          label="Ir a una fecha"
          labelOculto
          value={fecha}
          className="w-[9.5rem]"
          onChange={(evento) => {
            if (esFechaISO(evento.target.value)) onFecha(evento.target.value);
          }}
        />
      </div>

      <div role="group" aria-label="Días de la semana" className="grid grid-cols-7 gap-1 sm:gap-2">
        {dias.map((dia) => {
          const seleccionado = vista === 'dia' && dia === fecha;
          const esHoy = dia === hoy;
          const pedidos = pedidosPorDia.get(dia) ?? 0;
          const numero = Number(dia.slice(8, 10));
          return (
            <button
              key={dia}
              type="button"
              aria-pressed={seleccionado}
              aria-label={`${DIAS_SEMANA[diaSemana(dia)]} ${numero}${esHoy ? ', hoy' : ''}`
                + `${pedidos ? `, ${pedidos} ${pedidos === 1 ? 'pedido pendiente' : 'pedidos pendientes'}` : ''}`}
              onClick={() => onDia(dia)}
              className={clsx(
                'relative flex min-h-14 flex-col items-center justify-center rounded-xl border text-sm transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
                seleccionado
                  ? 'border-vb-blue bg-vb-blue text-white'
                  : esHoy
                    ? 'border-vb-orange/40 bg-vb-orange-light text-vb-orange-ink hover:border-vb-orange-ink'
                    : 'border-ink/10 bg-white text-ink/70 hover:border-ink/25',
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide">{DIAS_SEMANA_CORTOS[diaSemana(dia)]}</span>
              <span className="text-base font-black leading-tight">{numero}</span>
              {pedidos > 0 && (
                <span aria-hidden="true" className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
