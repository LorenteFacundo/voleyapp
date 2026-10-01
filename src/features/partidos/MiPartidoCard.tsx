import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import clsx from 'clsx';
import type { MiPartido } from '@/api/tipos';
import { fechaArgentina, formatDiaRelativo, formatRangoHorario } from '@/lib/date';
import { BarraCupo } from './BarraCupo';
import { EtiquetaEstadoPartido, EtiquetaMiEstado, EtiquetaNivel, HojaCalendario } from './Etiquetas';

/** Partido propio (organizado o anotado) en la lista de "Mis partidos". */
export function MiPartidoCard({ partido, pasado = false }: { partido: MiPartido; pasado?: boolean }) {
  const fecha = fechaArgentina(partido.inicio);
  const apagado = pasado || partido.estado_partido === 'cancelado';
  const mostrarCupo = !apagado && partido.estado_partido !== 'finalizado';

  return (
    <Link
      to={`/partido/${partido.id}`}
      className={clsx(
        'group flex h-full flex-col rounded-2xl border bg-white p-4 shadow-card transition duration-200 hover:shadow-card-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
        apagado ? 'border-ink/10 opacity-80' : 'border-vb-gray/10 hover:-translate-y-0.5',
      )}
    >
      <div className="flex items-start gap-3">
        <HojaCalendario fecha={fecha} apagada={apagado} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">
            {formatDiaRelativo(fecha)} · {formatRangoHorario(partido.inicio, partido.fin)}
          </p>
          <p className={clsx(
            'truncate font-display text-lg font-black leading-tight transition-colors group-hover:text-vb-orange-ink',
            partido.estado_partido === 'cancelado' ? 'text-ink/65 line-through' : 'text-vb-blue',
          )}
          >
            {partido.club.nombre}
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink/65">
            <MapPin size={12} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{[partido.club.zona, partido.cancha.titulo].filter(Boolean).join(' · ')}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <EtiquetaEstadoPartido estado={partido.estado_partido} />
        <EtiquetaMiEstado estado={partido.mi_estado} organizo={partido.soy_organizador} />
        <EtiquetaNivel nivel={partido.nivel_requerido} />
      </div>
      {mostrarCupo && (
        <BarraCupo className="mt-3" ocupados={partido.ocupados} minimo={partido.cupo_minimo} maximo={partido.cupo_maximo} />
      )}
    </Link>
  );
}
