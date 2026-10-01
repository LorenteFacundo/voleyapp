import type { ReactNode } from 'react';
import { Banknote, Inbox, Lock, Plus, Share2, Trophy } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { ESTILO_BLOQUE, FONDO_BLOQUEO, LEYENDA } from './estilos';

type Tono = 'ambar' | 'violeta' | 'verde';

const TONOS: Record<Tono, string> = {
  ambar: 'border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-500',
  violeta: 'border-violet-300 bg-violet-50 text-violet-950 hover:border-violet-500',
  verde: 'border-green-300 bg-green-50 text-green-950 hover:border-green-600',
};

function Chip({ icono, valor, texto, tono, etiqueta, onClick }: {
  icono: ReactNode; valor: number | null; texto: ReactNode; tono: Tono; etiqueta: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className={clsx(
        'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
        valor ? TONOS[tono] : 'border-ink/10 bg-white text-ink/65 hover:border-ink/25',
      )}
    >
      {icono}
      <span className="font-black tabular-nums">{valor ?? '…'}</span>
      {texto}
    </button>
  );
}

export function ResumenAgenda({
  pedidos, pagosInformados, libres, libresHoy, onPedidos, onPagos, onLibres,
}: {
  pedidos: number;
  pagosInformados: number;
  /** null mientras se carga el día. */
  libres: number | null;
  /** true si los libres son de hoy (cambia el texto). */
  libresHoy: boolean;
  onPedidos: () => void;
  onPagos: () => void;
  onLibres: () => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <Chip
        icono={<Inbox size={17} aria-hidden="true" />}
        valor={pedidos}
        texto={pedidos === 1 ? 'pedido' : 'pedidos'}
        tono="ambar"
        etiqueta={`${pedidos} ${pedidos === 1 ? 'pedido sin responder' : 'pedidos sin responder'}. Ver pedidos`}
        onClick={onPedidos}
      />
      <Chip
        icono={<Banknote size={17} aria-hidden="true" />}
        valor={pagosInformados}
        texto={pagosInformados === 1 ? 'pago informado' : 'pagos informados'}
        tono="violeta"
        etiqueta={`${pagosInformados} ${pagosInformados === 1 ? 'pago informado' : 'pagos informados'} por jugadores. Revisar`}
        onClick={onPagos}
      />
      <Chip
        icono={<Share2 size={17} aria-hidden="true" />}
        valor={libres}
        texto={<>{libres === 1 ? 'libre' : 'libres'}{libresHoy ? ' hoy' : ''} <span className="font-normal opacity-75">· Compartir</span></>}
        tono="verde"
        etiqueta={libres === null
          ? 'Compartir turnos libres por WhatsApp'
          : `${libres} ${libres === 1 ? 'turno libre' : 'turnos libres'}${libresHoy ? ' hoy' : ''}. Compartir por WhatsApp`}
        onClick={onLibres}
      />
    </div>
  );
}

function BotonAccion({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-vb-gray/15 bg-white px-2',
        'text-xs font-semibold text-vb-gray transition hover:border-vb-orange-ink hover:text-vb-orange-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink focus-visible:ring-offset-2',
        'sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm',
      )}
    >
      {children}
    </button>
  );
}

export function AccionesAgenda({ onNueva, onBloquear, onPartido, onCompartir }: {
  onNueva: () => void; onBloquear: () => void; onPartido: () => void; onCompartir: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-wrap">
      <Button className="hidden lg:inline-flex" onClick={onNueva}>
        <Plus size={18} aria-hidden="true" /> Nueva reserva
      </Button>
      <BotonAccion onClick={onBloquear}>
        <Lock size={17} aria-hidden="true" /> Bloquear
      </BotonAccion>
      <BotonAccion onClick={onPartido}>
        <Trophy size={17} aria-hidden="true" />
        <span className="sm:hidden">Partido</span><span className="hidden sm:inline">Partido abierto</span>
      </BotonAccion>
      <BotonAccion onClick={onCompartir}>
        <Share2 size={17} aria-hidden="true" />
        <span className="sm:hidden">Compartir</span><span className="hidden sm:inline">Compartir turnos libres</span>
      </BotonAccion>
    </div>
  );
}

/** Acceso a "Nueva reserva" al alcance del pulgar en celulares. */
export function BotonNuevaReserva({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'fixed right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-vb-orange-ink pl-4 pr-5 text-base font-bold text-white shadow-soft',
        'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] transition active:scale-95 lg:hidden',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vb-orange-ink',
      )}
    >
      <Plus size={22} aria-hidden="true" /> Nueva reserva
    </button>
  );
}

export function LeyendaAgenda() {
  return (
    <details className="rounded-2xl border border-ink/10 bg-white px-4 py-2 text-sm">
      <summary className="min-h-9 cursor-pointer py-1.5 font-semibold text-ink/70">¿Qué significa cada color?</summary>
      <ul className="grid gap-2 pb-2 pt-1 sm:grid-cols-2 lg:grid-cols-3">
        {LEYENDA.map(({ apariencia, etiqueta }) => (
          <li key={apariencia} className="flex items-center gap-2">
            {apariencia === 'libre' ? (
              <span aria-hidden="true" className="h-5 w-8 shrink-0 rounded-md border border-dashed border-green-600/50 bg-green-50/40" />
            ) : (
              <span
                aria-hidden="true"
                className={clsx('relative h-5 w-8 shrink-0 rounded-md', ESTILO_BLOQUE[apariencia])}
                style={apariencia === 'bloqueo' ? FONDO_BLOQUEO : undefined}
              >
                {apariencia === 'pendiente' && <span className="absolute inset-0 rounded-md border-2 border-dashed border-amber-500" />}
              </span>
            )}
            <span className="text-ink/75">{etiqueta}</span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="w-8 shrink-0 text-center">
            <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">Debe</span>
          </span>
          <span className="text-ink/75">Ya jugaron y falta cobrar</span>
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-8 shrink-0 bg-red-500" />
          <span className="text-ink/75">Hora actual</span>
        </li>
      </ul>
    </details>
  );
}
