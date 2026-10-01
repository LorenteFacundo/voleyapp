import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, Phone, Trophy } from 'lucide-react';
import clsx from 'clsx';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { ClubConfig, Ocupacion } from '@/api/tipos';
import { formatRelativo } from '@/lib/date';
import { formatTelefono } from '@/lib/telefono';
import { Badge } from '@/components/ui/Badge';
import { Aviso } from '@/components/ui/Estados';
import { AvisoCancelacionWhatsApp, AvisoConfirmacionWhatsApp, MensajesWhatsApp } from './MensajesWhatsApp';
import { useInvalidarAgenda } from './hooks';
import {
  ETIQUETA_APARIENCIA, ETIQUETA_ESTADO, ETIQUETA_ESTADO_PAGO, ETIQUETA_ORIGEN, aparienciaDe, debe, esActiva, esFijo,
  informoPago, montoCorto, nombreDeOcupacion, requiereAvisoManual, saldoDe, subtituloDeOcupacion, telefonoDeOcupacion,
  usaLaApp,
} from './presentacion';
import { RegistrarPago } from './RegistrarPago';

const VARIANTE_APARIENCIA = {
  pendiente: 'warning', app: 'info', manual: 'success', fijo: 'info', bloqueo: 'muted', cancelada: 'danger',
} as const;

const QUIEN_CANCELO = { club: 'el club', jugador: 'el jugador', sistema: 'el sistema' } as const;

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink/65">{titulo}</h3>
      {children}
    </section>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink/65">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

/** Estado, origen, cuenta de la app, pago y asistencia de un vistazo. */
export function InsigniasDetalle({ ocupacion, ahora }: { ocupacion: Ocupacion; ahora: number }) {
  const apariencia = aparienciaDe(ocupacion);
  const esBloqueo = ocupacion.tipo === 'bloqueo';
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant={VARIANTE_APARIENCIA[apariencia]}>
        {esActiva(ocupacion) ? ETIQUETA_APARIENCIA[apariencia] : ETIQUETA_ESTADO[ocupacion.estado]}
      </Badge>
      {!esBloqueo && ocupacion.origen !== 'fijo' && <Badge variant="muted">{ETIQUETA_ORIGEN[ocupacion.origen]}</Badge>}
      {usaLaApp(ocupacion) && <Badge variant="info">Usuario de la app</Badge>}
      {!esBloqueo && Number(ocupacion.precio) > 0 && (
        <Badge
          variant={ocupacion.estado_pago === 'pagado'
            ? 'success'
            : debe(ocupacion, ahora) || ocupacion.estado_pago === 'a_devolver' ? 'danger' : 'default'}
        >
          {ETIQUETA_ESTADO_PAGO[ocupacion.estado_pago]}
        </Badge>
      )}
      {ocupacion.asistencia === 'no_vinieron' && <Badge variant="danger">No vinieron</Badge>}
      {ocupacion.asistencia === 'jugaron' && <Badge variant="success">Jugaron</Badge>}
    </div>
  );
}

/** Motivo y responsable de una cancelación, rechazo o vencimiento. */
export function AvisoInactiva({ ocupacion }: { ocupacion: Ocupacion }) {
  const quien = ocupacion.cancelada_por ? ` por ${QUIEN_CANCELO[ocupacion.cancelada_por]}` : '';
  return (
    <Aviso tono="info" titulo={`${ETIQUETA_ESTADO[ocupacion.estado]}${quien}`}>
      {ocupacion.motivo_cancelacion ? `Motivo: ${ocupacion.motivo_cancelacion}` : 'Sin motivo indicado.'}
    </Aviso>
  );
}

/** Después de cancelar o mover: cómo se entera el cliente. */
export function AvisoPosterior({ tipo, ocupacion, club, cancha, hoy }: {
  tipo: 'cancelada' | 'movida'; ocupacion: Ocupacion; club: ClubConfig; cancha: string; hoy: string;
}) {
  const nombre = nombreDeOcupacion(ocupacion);
  if (tipo === 'movida') {
    if (!requiereAvisoManual(ocupacion)) return null;
    return (
      <Aviso tono="exito" titulo="Reserva movida">
        <div className="space-y-2">
          <p>Mandale el horario nuevo a {nombre}:</p>
          <AvisoConfirmacionWhatsApp ocupacion={ocupacion} club={club} cancha={cancha} hoy={hoy}>Avisar por WhatsApp</AvisoConfirmacionWhatsApp>
        </div>
      </Aviso>
    );
  }
  return (
    <Aviso tono="exito" titulo={esFijo(ocupacion) ? 'Fecha liberada' : 'Reserva cancelada'}>
      {requiereAvisoManual(ocupacion) ? (
        <div className="space-y-2">
          <p>{usaLaApp(ocupacion) ? 'Los turnos fijos no avisan solos.' : `${nombre} no usa la app.`} Avisale por WhatsApp:</p>
          <AvisoCancelacionWhatsApp ocupacion={ocupacion} club={club} cancha={cancha} hoy={hoy} />
        </div>
      ) : usaLaApp(ocupacion) ? (
        <p>Le avisamos por la app y por email.</p>
      ) : (
        <p>No tiene teléfono cargado: avisale por otro medio.</p>
      )}
    </Aviso>
  );
}

export function SeccionCliente({ ocupacion, club, cancha, hoy }: {
  ocupacion: Ocupacion; club: ClubConfig; cancha: string; hoy: string;
}) {
  const telefono = telefonoDeOcupacion(ocupacion);
  const email = ocupacion.cliente?.email ?? ocupacion.jugador?.email ?? null;
  const subtitulo = subtituloDeOcupacion(ocupacion);
  return (
    <Seccion titulo="Cliente">
      <div className="space-y-1">
        <p className="text-base font-bold text-ink">{nombreDeOcupacion(ocupacion)}</p>
        {subtitulo && <p className="text-sm text-ink/65">{subtitulo}</p>}
        {telefono && (
          <a href={`tel:+${telefono}`} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-vb-blue hover:underline">
            <Phone size={15} aria-hidden="true" /> {formatTelefono(telefono)}
          </a>
        )}
        {email && <p className="break-all text-sm text-ink/65">{email}</p>}
        {!telefono && !email && <p className="text-sm text-ink/65">Sin datos de contacto.</p>}
      </div>
      {telefono && esActiva(ocupacion) && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-ink/65">Escribile por WhatsApp</p>
          <MensajesWhatsApp ocupacion={ocupacion} club={club} cancha={cancha} hoy={hoy} />
        </div>
      )}
    </Seccion>
  );
}

export function SeccionCobro({ clubId, ocupacion, esDueno, ahora, onActualizada }: {
  clubId: number; ocupacion: Ocupacion; esDueno: boolean; ahora: number; onActualizada: (ocupacion: Ocupacion) => void;
}) {
  const activa = esActiva(ocupacion);
  const aDevolver = ocupacion.estado_pago === 'a_devolver';
  const falta = aDevolver ? Number(ocupacion.pagado) : activa ? saldoDe(ocupacion) : 0;
  return (
    <Seccion titulo="Cobro">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato etiqueta="Precio">{montoCorto(ocupacion.precio)}</Dato>
        <Dato etiqueta="Seña">{Number(ocupacion.sena) > 0 ? montoCorto(ocupacion.sena) : '—'}</Dato>
        <Dato etiqueta="Pagado">{montoCorto(ocupacion.pagado)}</Dato>
        <Dato etiqueta={aDevolver ? 'A devolver' : 'Falta'}>
          <span className={clsx(falta > 0 ? 'text-red-700' : 'text-green-700')}>{montoCorto(falta)}</span>
        </Dato>
      </dl>
      {informoPago(ocupacion) && ocupacion.pago_informado_at && (
        <Aviso tono="info" titulo="Avisó que transfirió">
          Lo informó {formatRelativo(ocupacion.pago_informado_at, new Date(ahora))}. Verificá la transferencia y registrá el pago.
        </Aviso>
      )}
      {(activa || aDevolver) && (
        <RegistrarPago clubId={clubId} ocupacion={ocupacion} puedeAnular={esDueno} onRegistrado={onActualizada} />
      )}
    </Seccion>
  );
}

/** Jugaron / no vinieron (solo cuando el turno ya empezó). */
export function SeccionAsistencia({ clubId, ocupacion, onActualizada }: {
  clubId: number; ocupacion: Ocupacion; onActualizada: (ocupacion: Ocupacion) => void;
}) {
  const invalidar = useInvalidarAgenda(clubId);
  const asistencia = useMutation({
    mutationFn: (valor: 'jugaron' | 'no_vinieron' | null) => clubApi.actualizarOcupacion(ocupacion.id, { asistencia: valor }),
    onSuccess: (actualizada) => {
      toast.success(actualizada.asistencia === 'no_vinieron' ? 'Marcaste que no vinieron.' : 'Guardaste la asistencia.');
      onActualizada(actualizada);
    },
    onError: (error) => toast.error(mensajeDeError(error)),
    onSettled: () => {
      void invalidar({ clienteId: ocupacion.cliente?.id });
    },
  });

  return (
    <Seccion titulo="Asistencia">
      <div role="group" aria-label="Asistencia" className="grid grid-cols-2 gap-2">
        {([['jugaron', 'Jugaron'], ['no_vinieron', 'No vinieron']] as const).map(([valor, etiqueta]) => {
          const marcada = ocupacion.asistencia === valor;
          return (
            <button
              key={valor}
              type="button"
              aria-pressed={marcada}
              disabled={asistencia.isPending}
              onClick={() => asistencia.mutate(marcada ? null : valor)}
              className={clsx(
                'min-h-11 rounded-xl border px-3 text-sm font-semibold transition disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
                marcada
                  ? valor === 'jugaron' ? 'border-green-700 bg-green-700 text-white' : 'border-red-700 bg-red-700 text-white'
                  : 'border-ink/15 bg-white text-ink/75 hover:border-ink/40',
              )}
            >
              {etiqueta}
            </button>
          );
        })}
      </div>
    </Seccion>
  );
}

export function SeccionMasDatos({ ocupacion }: { ocupacion: Ocupacion }) {
  if (!ocupacion.notas && !ocupacion.partido) return null;
  return (
    <Seccion titulo="Más datos">
      {ocupacion.notas && <p className="whitespace-pre-line rounded-xl bg-ink/[0.04] p-3 text-sm text-ink/80">{ocupacion.notas}</p>}
      {ocupacion.partido && (
        <Link
          to={`/partido/${ocupacion.partido.id}`}
          className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm font-semibold text-vb-blue hover:border-vb-blue"
        >
          <span className="flex items-center gap-2">
            <Trophy size={16} aria-hidden="true" />
            {ocupacion.partido.organiza_club ? 'Partido abierto del club' : 'Partido abierto'}
            {' · '}{ocupacion.partido.ocupados}/{ocupacion.partido.cupo_maximo} jugadores
          </span>
          <ExternalLink size={15} aria-hidden="true" />
        </Link>
      )}
    </Seccion>
  );
}
