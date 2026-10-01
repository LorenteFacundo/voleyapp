import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, MapPin, ShieldCheck, UserRound, Volleyball, type LucideIcon } from 'lucide-react';
import type { PartidoDetalle } from '@/api/tipos';
import { fechaArgentina, horaArgentina } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { Aviso } from '@/components/ui/Estados';
import { capitalizar, fechaLarga } from '@/features/jugador/fechas';
import { claseEnlace } from '@/features/jugador/estilos';
import { etiquetaSuperficie } from '@/features/jugador/club/politicas';
import { enlaceGoogleMaps } from '@/features/mapa/enlaces';
import { BarraCupo } from '../BarraCupo';
import { precioPorJugador } from '../cupo';
import { EtiquetaEstadoPartido, EtiquetaNivel } from '../Etiquetas';
import { presentarEstadoPartido } from '../estado';

function Dato({ icono: Icono, titulo, children }: { icono: LucideIcon; titulo: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-vb-orange-light text-vb-orange-ink" aria-hidden="true">
        <Icono size={18} />
      </span>
      <div className="min-w-0 text-sm">
        <dt className="text-xs font-semibold text-ink/65">{titulo}</dt>
        <dd className="text-ink">{children}</dd>
      </div>
    </div>
  );
}

/** Cuándo, dónde, cuánto y quién organiza; más el estado del partido. */
export function EncabezadoPartido({ partido }: { partido: PartidoDetalle }) {
  const fecha = fechaArgentina(partido.inicio);
  const precio = precioPorJugador(partido);
  const mapa = enlaceGoogleMaps(partido.club);
  const estado = presentarEstadoPartido(partido.estado_partido);
  const activo = partido.estado_partido === 'abierto' || partido.estado_partido === 'confirmado';
  const superficie = etiquetaSuperficie(partido.cancha.superficie);

  return (
    <header className="overflow-hidden rounded-3xl border border-vb-gray/10 bg-white shadow-card">
      <div className="relative overflow-hidden bg-vb-blue px-5 pb-6 pt-5 text-white sm:px-7">
        <span className="pointer-events-none absolute -right-14 -top-20 h-52 w-52 rounded-full border-[2.25rem] border-vb-orange/90" aria-hidden="true" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-1.5">
            <EtiquetaNivel nivel={partido.nivel_requerido} />
            <EtiquetaEstadoPartido estado={partido.estado_partido} />
            {partido.visibilidad !== 'publico' && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white">Solo con enlace</span>
            )}
          </div>
          <p className="mt-4 text-sm font-semibold text-white/75">{capitalizar(fechaLarga(fecha))}</p>
          <h1 className="mt-0.5 font-display text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
            Partido en {partido.club.nombre}
          </h1>
          <p className="mt-1 font-display text-xl font-black text-vb-yellow">
            {horaArgentina(partido.inicio)} a {horaArgentina(partido.fin)}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-7">
        {!activo && (
          <Aviso tono={estado.tono === 'error' ? 'error' : estado.tono === 'alerta' ? 'alerta' : 'info'} titulo={estado.etiqueta}>
            {estado.descripcion}
          </Aviso>
        )}

        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato icono={MapPin} titulo="Dónde">
            <Link to={`/club/${partido.club.slug}`} className={claseEnlace}>{partido.club.nombre}</Link>
            {partido.club.direccion && <span className="block text-ink/70">{partido.club.direccion}</span>}
            {mapa && (
              <a href={mapa} target="_blank" rel="noopener noreferrer" className={`${claseEnlace} text-xs`}>
                Cómo llegar<span className="sr-only"> (abre Google Maps)</span>
              </a>
            )}
          </Dato>
          <Dato icono={Volleyball} titulo="Cancha">
            {partido.cancha.titulo}
            <span className="block text-ink/70">
              {[partido.cancha.techada ? 'Techada' : 'Al aire libre', superficie].filter(Boolean).join(' · ')}
            </span>
          </Dato>
          <Dato icono={Banknote} titulo="Precio por persona">
            {precio ? (
              <>
                <span className="font-bold">{precio.monto > 0 ? formatMoney(precio.monto) : 'Sin costo'}</span>
                {precio.estimado && (
                  <span className="block text-xs text-ink/65">
                    Aproximado: la cancha sale {formatMoney(partido.precio_total)} y se divide entre {partido.cupo_maximo}.
                  </span>
                )}
              </>
            ) : 'A definir'}
          </Dato>
          <Dato icono={UserRound} titulo="Organiza">
            {partido.organiza_club ? `${partido.club.nombre} (el club)` : partido.organizador_nombre}
            {partido.soy_organizador && <span className="block text-xs font-semibold text-vb-orange-ink">Sos vos</span>}
          </Dato>
        </dl>

        {partido.estado_partido !== 'cancelado' && partido.estado_partido !== 'finalizado' && (
          <BarraCupo ocupados={partido.ocupados} minimo={partido.cupo_minimo} maximo={partido.cupo_maximo} />
        )}

        {partido.requiere_aprobacion && (
          <p className="flex items-start gap-2 text-sm text-ink/70">
            <ShieldCheck size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-vb-blue" />
            Quien organiza aprueba a cada persona que quiere sumarse.
          </p>
        )}

        {partido.descripcion && (
          <div className="rounded-2xl bg-line px-4 py-3">
            <p className="text-xs font-semibold text-ink/65">Detalles</p>
            <p className="mt-1 whitespace-pre-line break-words text-sm text-ink/80">{partido.descripcion}</p>
          </div>
        )}
      </div>
    </header>
  );
}
