import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Navigation, Sun, Umbrella, Volleyball, Zap } from 'lucide-react';
import type { ClubPublico } from '@/api/tipos';
import { formatMoney, pluralizar } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { formatDistancia } from '@/features/mapa/distancia';
import { precioDesde, tieneArena, tieneTechada } from './catalogo';

/** Tarjeta de un club en el catálogo: lleva a su página con los horarios. */
export function ClubCard({ club, distanciaKm }: { club: ClubPublico; distanciaKm: number | null }) {
  const foto = club.canchas.find((cancha) => cancha.fotos?.length)?.fotos[0] ?? null;
  const desde = precioDesde(club.canchas);
  const ubicacion = [club.zona, club.direccion].filter(Boolean).join(' · ');

  return (
    <Link
      to={`/club/${club.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-vb-gray/10 bg-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-vb-blue to-[#2c3aa3]">
        {foto ? (
          <img src={foto} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <span className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[1.5rem] border-vb-orange/80" />
            <Volleyball size={56} className="relative text-white/25" />
          </span>
        )}
        <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          {club.confirmacion_automatica ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-green-800 shadow-sm">
              <Zap size={12} aria-hidden="true" /> Confirmación inmediata
            </span>
          ) : <span />}
          {distanciaKm != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-vb-blue shadow-sm">
              <Navigation size={12} aria-hidden="true" /> {formatDistancia(distanciaKm)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-black leading-tight text-vb-blue transition-colors group-hover:text-vb-orange-ink">
          {club.nombre}
        </h3>
        <p className="mt-1 flex min-w-0 items-start gap-1 text-xs text-ink/65">
          <MapPin size={13} aria-hidden="true" className="mt-px shrink-0" />
          <span className="line-clamp-2">{ubicacion || 'Ubicación a confirmar'}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="muted">{club.canchas.length ? pluralizar(club.canchas.length, 'cancha') : 'Sin canchas publicadas'}</Badge>
          {tieneTechada(club) && <Badge variant="info"><Umbrella size={12} aria-hidden="true" /> Techada</Badge>}
          {tieneArena(club) && <Badge variant="court"><Sun size={12} aria-hidden="true" /> Arena</Badge>}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          {desde ? (
            <p className="leading-tight">
              <span className="block text-xs text-ink/65">Desde</span>
              <span className="font-display text-xl font-black text-ink">{formatMoney(desde)}</span>
              <span className="text-xs text-ink/65"> el turno</span>
            </p>
          ) : (
            <p className="text-xs font-semibold text-ink/65">Consultá precios</p>
          )}
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-vb-orange-ink">
            Ver horarios <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
