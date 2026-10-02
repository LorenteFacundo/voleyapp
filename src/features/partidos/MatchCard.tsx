import { Link } from 'react-router-dom';
import { MapPin, Navigation, ShieldCheck } from 'lucide-react';
import type { PartidoExplorado } from '@/api/tipos';
import { fechaArgentina, formatDiaRelativo, formatRangoHorario } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { formatDistancia } from '@/features/mapa/distancia';
import { BarraCupo } from './BarraCupo';
import { precioPorJugador } from './cupo';
import { EtiquetaMiEstado, EtiquetaNivel, HojaCalendario } from './Etiquetas';

/** Tarjeta de un partido abierto: toda la tarjeta lleva al detalle. */
export function MatchCard({ partido }: { partido: PartidoExplorado }) {
  const fecha = fechaArgentina(partido.inicio);
  const precio = precioPorJugador(partido);
  const lugar = [partido.club.zona, partido.cancha.titulo].filter(Boolean).join(' · ');

  return (
    <Link
      to={`/partido/${partido.id}`}
      className="group flex h-full flex-col rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
    >
      <div className="flex items-start gap-3">
        <HojaCalendario fecha={fecha} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">
            {formatDiaRelativo(fecha)} · {formatRangoHorario(partido.inicio, partido.fin)}
          </p>
          <p className="truncate font-display text-lg font-black leading-tight text-vb-blue transition-colors group-hover:text-vb-orange-ink">
            {partido.club.nombre}
          </p>
          {lugar && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink/65">
              <MapPin size={12} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{lugar}</span>
            </p>
          )}
        </div>
        <EtiquetaNivel nivel={partido.nivel_requerido} />
      </div>

      <BarraCupo className="mb-4 mt-4" ocupados={partido.ocupados} minimo={partido.cupo_minimo} maximo={partido.cupo_maximo} />

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-ink/10 pt-3">
        <div className="min-w-0 space-y-1 text-xs text-ink/65">
          <p className="truncate">{partido.organiza_club ? 'Organiza el club' : `Organiza ${partido.organizador_nombre}`}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <EtiquetaMiEstado estado={partido.mi_estado} organizo={partido.soy_organizador} />
            {partido.requiere_aprobacion && !partido.mi_estado && !partido.soy_organizador && (
              <span className="inline-flex items-center gap-1 font-semibold text-ink/65">
                <ShieldCheck size={13} aria-hidden="true" /> Con aprobación
              </span>
            )}
            {partido.distancia_km != null && (
              <span className="inline-flex items-center gap-1 font-semibold text-ink/65">
                <Navigation size={12} aria-hidden="true" /> {formatDistancia(partido.distancia_km)}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {precio ? (
            <>
              <p className="font-display text-lg font-black leading-tight text-ink">
                {precio.monto > 0 ? formatMoney(precio.monto) : 'Gratis'}
              </p>
              {precio.monto > 0 && (
                <p className="text-[11px] text-ink/65">{precio.estimado ? 'aprox. por persona' : 'por persona'}</p>
              )}
            </>
          ) : (
            <p className="text-xs font-semibold text-ink/65">Precio a definir</p>
          )}
        </div>
      </div>
    </Link>
  );
}
