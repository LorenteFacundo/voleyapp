import { Link } from 'react-router-dom';
import { ChevronRight, Hourglass, MapPin } from 'lucide-react';
import { useMisReservas } from '@/api/consultas';
import { fechaArgentina, formatDiaRelativo, formatRangoHorario } from '@/lib/date';
import { ErrorCarga } from '@/components/ui/Estados';
import { Skeleton } from '@/components/ui/Skeleton';
import { HojaCalendario } from '@/features/partidos/Etiquetas';
import { EtiquetaEstadoReserva, EtiquetaFijo } from '../EtiquetasReserva';
import { Seccion } from '../Seccion';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { claseEnlace } from '../estilos';
import { presentarEstadoReserva, proximaReserva, tiempoRestante } from '../reservas';
import { useAhora } from '../useAhora';

/** La primera reserva activa, para tenerla a mano en el inicio. */
export function ProximaReserva() {
  const reservas = useMisReservas(false);
  const ahora = useAhora(60_000);
  const reserva = reservas.data ? proximaReserva(reservas.data, ahora) : null;

  return (
    <Seccion
      titulo="Tu próxima reserva"
      accion={<Link to="/mis-reservas" className={`${claseEnlace} text-sm`}>Ver todas</Link>}
    >
      {reservas.isPending ? (
        <Skeleton height={104} className="rounded-2xl" />
      ) : reservas.isError ? (
        <ErrorCarga error={reservas.error} onRetry={() => reservas.refetch()} />
      ) : !reserva ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-ink/15 bg-white px-4 py-4">
          <p className="text-sm text-ink/65">No tenés reservas por jugar. ¿Buscamos cancha?</p>
          <Link to="/canchas" className={clasesBoton({ variant: 'primary', size: 'sm' })}>Reservar cancha</Link>
        </div>
      ) : (
        <Link
          to="/mis-reservas"
          className="group flex items-center gap-3 rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card transition hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
        >
          <HojaCalendario fecha={fechaArgentina(reserva.inicio)} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">
              {formatDiaRelativo(fechaArgentina(reserva.inicio))} · {formatRangoHorario(reserva.inicio, reserva.fin)}
            </span>
            <span className="block truncate font-display text-lg font-black leading-tight text-vb-blue group-hover:text-vb-orange-ink">
              {reserva.club.nombre}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink/65">
              <MapPin size={12} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{reserva.cancha.titulo}</span>
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <EtiquetaEstadoReserva estado={reserva.estado}>{presentarEstadoReserva(reserva).etiqueta}</EtiquetaEstadoReserva>
              {reserva.es_fijo && <EtiquetaFijo />}
              {reserva.estado === 'pendiente' && reserva.vence_at && tiempoRestante(reserva.vence_at, ahora) && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900">
                  <Hourglass size={12} aria-hidden="true" /> Responde en {tiempoRestante(reserva.vence_at, ahora)}
                </span>
              )}
            </span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-ink/65" aria-hidden="true" />
        </Link>
      )}
    </Seccion>
  );
}
