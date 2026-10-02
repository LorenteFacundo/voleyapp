import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { BloqueDisponible } from '@/api/tipos';
import { formatMoney } from '@/lib/format';
import { motivoNoDisponible } from './disponibilidad';

const BASE = 'flex min-h-[76px] w-full flex-col items-start justify-center rounded-xl border px-3 py-2 text-left';
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink focus-visible:ring-offset-1';

/** Un horario de la grilla con su estado. Solo los libres se pueden elegir. */
export function BloqueHorario({
  bloque, canchaTitulo, hoy, ventanaDias, onElegir,
}: {
  bloque: BloqueDisponible; canchaTitulo: string; hoy: string; ventanaDias: number; onElegir: (bloque: BloqueDisponible) => void;
}) {
  const rango = `${bloque.hora_inicio}–${bloque.hora_fin}`;

  switch (bloque.estado) {
    case 'libre':
      return (
        <button
          type="button"
          onClick={() => onElegir(bloque)}
          className={clsx(BASE, FOCO, 'border-green-200 bg-white shadow-sm transition hover:-translate-y-px hover:border-vb-orange-ink hover:shadow-card')}
        >
          <span className="font-display text-base font-black text-ink">{rango}</span>
          <span className="text-sm font-semibold text-ink/70">{formatMoney(bloque.precio)}</span>
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" aria-hidden="true" /> Libre
          </span>
          <span className="sr-only">. {canchaTitulo}. Pedir este horario.</span>
        </button>
      );
    case 'mi_solicitud':
    case 'mi_reserva': {
      const pedido = bloque.estado === 'mi_solicitud';
      return (
        <Link
          to="/mis-reservas"
          className={clsx(BASE, FOCO, pedido ? 'border-amber-200 bg-amber-50' : 'border-green-300 bg-green-50')}
        >
          <span className="font-display text-base font-black text-ink">{rango}</span>
          <span className={clsx('text-xs font-bold', pedido ? 'text-amber-900' : 'text-green-800')}>
            {pedido ? 'Tu pedido: esperando al club' : 'Tu reserva'}
          </span>
          <span className="sr-only">. {canchaTitulo}. Ver en mis reservas.</span>
        </Link>
      );
    }
    case 'ocupado':
      return (
        <div className={clsx(BASE, 'border-transparent bg-ink/5 text-ink/65')}>
          <span className="font-display text-base font-black line-through">{rango}</span>
          <span className="text-xs font-semibold">Ocupado</span>
        </div>
      );
    case 'no_disponible': {
      const motivo = motivoNoDisponible(bloque, hoy, ventanaDias);
      return (
        <div className={clsx(BASE, 'border-dashed border-ink/15 bg-white text-ink/65')}>
          <span className="font-display text-base font-black">{rango}</span>
          <span className="text-xs font-semibold">{motivo === 'sobre_la_hora' ? 'Sobre la hora: consultá al club' : 'Se habilita más adelante'}</span>
        </div>
      );
    }
  }
}
