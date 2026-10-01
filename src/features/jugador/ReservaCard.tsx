import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarPlus, CheckCircle2, Hourglass, MapPin, MessageCircle, Trophy, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { MiReserva } from '@/api/tipos';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { mensajeDeError } from '@/api/cliente';
import { useAuth } from '@/contexts/auth';
import { fechaArgentina, formatDiaRelativo, formatFechaHora, formatRangoHorario } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { enlaceWhatsApp } from '@/lib/telefono';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Aviso } from '@/components/ui/Estados';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { EtiquetaEstadoPartido, HojaCalendario } from '@/features/partidos/Etiquetas';
import { agregarAlCalendario, lugarDelClub } from './calendario';
import { DatosTransferencia } from './DatosTransferencia';
import { EtiquetaEstadoReserva, EtiquetaFijo } from './EtiquetasReserva';
import { clasesBoton } from '@/components/ui/estilosBoton';
import {
  detalleTurno, esReservaActiva, etiquetaPago, mensajeWhatsAppTurno, montoATransferir, motivoMensaje,
  presentarEstadoReserva, puedeInformarPago, tiempoRestante,
} from './reservas';

function useAccionesReserva(reserva: MiReserva) {
  const queryClient = useQueryClient();
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: claves.reservas });
    void queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
    void queryClient.invalidateQueries({ queryKey: claves.partidos });
  };
  const informar = useMutation({
    mutationFn: () => jugadorApi.informarPago(reserva.id),
    onSuccess: () => {
      toast.success(`Le avisamos a ${reserva.club.nombre} que transferiste. Lo va a verificar.`);
      void queryClient.invalidateQueries({ queryKey: claves.reservas });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });
  const cancelar = useMutation({
    mutationFn: (motivo: string) => jugadorApi.cancelarReserva(reserva.id, motivo),
    onSuccess: (resultado) => {
      toast.success(resultado.a_devolver > 0
        ? `Listo, cancelaste. ${reserva.club.nombre} te tiene que devolver ${formatMoney(resultado.a_devolver)}.`
        : reserva.estado === 'pendiente' ? 'Listo, retiraste el pedido.' : 'Listo, cancelaste la reserva.');
      refrescar();
    },
    onError: (error) => {
      toast.error(mensajeDeError(error));
      void queryClient.invalidateQueries({ queryKey: claves.reservas });
    },
  });
  return { informar, cancelar };
}

/** Tarjeta de una reserva propia con estado, pago y acciones. */
export function ReservaCard({ reserva, ahora, historial = false }: { reserva: MiReserva; ahora: Date; historial?: boolean }) {
  const { perfil } = useAuth();
  const confirmar = useConfirmar();
  const { informar, cancelar } = useAccionesReserva(reserva);
  const fecha = fechaArgentina(reserva.inicio);
  const activa = esReservaActiva(reserva);
  const estado = presentarEstadoReserva(reserva);
  const empezo = new Date(reserva.inicio).getTime() <= ahora.getTime();
  const numeroClub = reserva.club.whatsapp ?? reserva.club.telefono;
  const transferencia = montoATransferir(reserva);
  const restante = reserva.estado === 'pendiente' && reserva.vence_at ? tiempoRestante(reserva.vence_at, ahora) : null;

  const enlaceClub = (motivo: Parameters<typeof mensajeWhatsAppTurno>[0]['motivo']) => (numeroClub
    ? enlaceWhatsApp(numeroClub, mensajeWhatsAppTurno({
      motivo, nombre: perfil?.nombre, cancha: reserva.cancha.titulo, inicio: reserva.inicio, fin: reserva.fin,
    }))
    : null);

  async function pedirCancelacion() {
    const pendiente = reserva.estado === 'pendiente';
    const respuesta = await confirmar({
      titulo: pendiente ? '¿Retirar el pedido?' : '¿Cancelar la reserva?',
      descripcion: (
        <div className="space-y-2">
          <p>
            {reserva.club.nombre}: {detalleTurno(reserva.cancha.titulo, reserva.inicio, reserva.fin)}. Le avisamos al club.
          </p>
          {reserva.partido && reserva.partido.estado !== 'cancelado' && reserva.partido.estado !== 'finalizado' && (
            <p>El partido de esta cancha también se cancela y avisamos a quienes se anotaron.</p>
          )}
          {reserva.pagado > 0 && (
            <p className="font-semibold text-ink">
              Ya pagaste {formatMoney(reserva.pagado)}: coordiná la devolución con el club.
            </p>
          )}
        </div>
      ),
      confirmar: pendiente ? 'Sí, retirar' : 'Sí, cancelar',
      cancelar: 'Volver',
      peligro: true,
      pedirMotivo: { etiqueta: 'Motivo (opcional)', placeholder: 'Contale al club por qué cancelás' },
    });
    if (respuesta.confirmado) cancelar.mutate(respuesta.motivo);
  }

  async function pedirInformarPago() {
    if (!transferencia) return;
    const respuesta = await confirmar({
      titulo: '¿Ya hiciste la transferencia?',
      descripcion: `Le avisamos a ${reserva.club.nombre} que transferiste ${formatMoney(transferencia.monto)}${
        reserva.club.alias_pago ? ` al alias ${reserva.club.alias_pago}` : ''}. El club lo verifica y lo registra.`,
      confirmar: 'Sí, ya transferí',
      cancelar: 'Todavía no',
    });
    if (respuesta.confirmado) informar.mutate();
  }

  const whatsappReserva = enlaceClub(motivoMensaje(reserva.estado));
  const whatsappCancelar = enlaceClub('cancelar');

  return (
    <Card padding="none" className={clsx('overflow-hidden', !activa && 'bg-white/70')}>
      <div className="flex items-start gap-3 p-4">
        <HojaCalendario fecha={fecha} apagada={!activa || historial} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-bold text-ink">
              {formatDiaRelativo(fecha)} · {formatRangoHorario(reserva.inicio, reserva.fin)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <EtiquetaEstadoReserva estado={reserva.estado}>
                {historial && reserva.estado === 'confirmada' ? 'Jugada' : estado.etiqueta}
              </EtiquetaEstadoReserva>
              {reserva.es_fijo && <EtiquetaFijo />}
            </div>
          </div>
          <Link
            to={`/club/${reserva.club.slug}`}
            className="mt-0.5 block truncate font-display text-lg font-black leading-tight text-vb-blue hover:text-vb-orange-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
          >
            {reserva.club.nombre}
          </Link>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink/65">
            <MapPin size={12} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{[reserva.cancha.titulo, reserva.club.direccion].filter(Boolean).join(' · ')}</span>
          </p>
          {reserva.origen !== 'app' && <p className="mt-1 text-xs text-ink/65">Reserva cargada por el club.</p>}
        </div>
      </div>

      <div className="space-y-3 border-t border-ink/10 px-4 py-3 text-sm">
        {estado.detalle && <p className="text-ink/70">{estado.detalle}</p>}

        {reserva.estado === 'pendiente' && !historial && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-950">
            <Hourglass size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              {restante ? (
                <>
                  El club tiene <strong>{restante}</strong> para responder
                  {reserva.vence_at ? ` (hasta el ${formatFechaHora(reserva.vence_at)})` : ''}. Te avisamos apenas responda.
                </>
              ) : 'Se terminó el plazo para que el club responda: si no lo confirmó, el pedido vence y el horario se libera.'}
            </span>
          </p>
        )}

        {reserva.estado_pago === 'a_devolver' && reserva.pagado > 0 && (
          <Aviso tono="alerta">El club te tiene que devolver {formatMoney(reserva.pagado)}. Coordiná la devolución por WhatsApp.</Aviso>
        )}

        {activa && !historial && (
          <div className="space-y-3">
            {reserva.precio > 0 ? (
              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-ink/70">
                <div className="flex gap-1"><dt>Total:</dt><dd className="font-semibold text-ink">{formatMoney(reserva.precio)}</dd></div>
                {reserva.sena > 0 && (
                  <div className="flex gap-1"><dt>Seña:</dt><dd className="font-semibold text-ink">{formatMoney(reserva.sena)}</dd></div>
                )}
                <div className="flex gap-1"><dt>Pagado:</dt><dd className="font-semibold text-ink">{formatMoney(reserva.pagado)}</dd></div>
                <div className="flex gap-1">
                  <dt className="sr-only">Estado del pago:</dt>
                  <dd className="font-bold text-vb-blue">{etiquetaPago(reserva)}</dd>
                </div>
              </dl>
            ) : (
              <p className="font-semibold text-ink/70">Sin cargo.</p>
            )}
            {reserva.club.alias_pago && transferencia && (
              <DatosTransferencia
                alias={reserva.club.alias_pago}
                titular={reserva.club.titular_pago}
                monto={transferencia.monto}
                concepto={transferencia.concepto}
                nota={reserva.estado === 'pendiente' ? 'Si el club te pide la seña para confirmar, transferí a este alias.' : undefined}
              />
            )}
            {reserva.pago_informado_at ? (
              <p className="flex items-center gap-2 text-green-800">
                <CheckCircle2 size={16} aria-hidden="true" className="shrink-0" />
                Avisaste que transferiste el {formatFechaHora(reserva.pago_informado_at)}. El club lo verifica.
              </p>
            ) : puedeInformarPago(reserva) && (
              <Button variant="secondary" size="sm" onClick={pedirInformarPago} loading={informar.isPending}>
                {!informar.isPending && <CheckCircle2 size={16} aria-hidden="true" />}
                {transferencia?.concepto === 'seña' ? 'Ya transferí la seña' : 'Ya transferí'}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-ink/10 bg-line/60 px-4 py-3">
        {activa && !historial && whatsappReserva && (
          <a href={whatsappReserva} target="_blank" rel="noopener noreferrer" className={clasesBoton({ variant: 'success', size: 'sm' })}>
            <MessageCircle size={16} aria-hidden="true" /> WhatsApp
          </a>
        )}
        {activa && !historial && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => agregarAlCalendario({
              id: `reserva-${reserva.id}`,
              titulo: `Vóley en ${reserva.club.nombre}`,
              inicio: reserva.inicio,
              fin: reserva.fin,
              lugar: lugarDelClub(reserva.club),
              descripcion: `${reserva.cancha.titulo}. Reserva hecha en VoleyApp.`,
            }, `reserva-${reserva.id}.ics`)}
          >
            <CalendarPlus size={16} aria-hidden="true" /> Agregar al calendario
          </Button>
        )}
        {reserva.partido && (
          <Link to={`/partido/${reserva.partido.id}`} className={clasesBoton({ variant: 'secondary', size: 'sm' })}>
            <Trophy size={16} aria-hidden="true" /> Ver partido
            <EtiquetaEstadoPartido estado={reserva.partido.estado} />
          </Link>
        )}
        {(historial || !activa) && (
          <Link to={`/club/${reserva.club.slug}`} className={clasesBoton({ variant: 'secondary', size: 'sm' })}>Volver a reservar</Link>
        )}
        {activa && !historial && !empezo && reserva.puede_cancelar && (
          <Button variant="ghost" size="sm" onClick={pedirCancelacion} loading={cancelar.isPending} className="sm:ml-auto">
            {!cancelar.isPending && <XCircle size={16} aria-hidden="true" />}
            {reserva.estado === 'pendiente' ? 'Retirar pedido' : 'Cancelar'}
          </Button>
        )}
      </div>

      {activa && !historial && !empezo && !reserva.puede_cancelar && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-4 py-3 text-sm text-ink/70">
          <p>
            Faltan menos de {reserva.cancelacion_horas} h: para cancelar, escribile al club.
          </p>
          {whatsappCancelar && (
            <a href={whatsappCancelar} target="_blank" rel="noopener noreferrer" className={clasesBoton({ variant: 'secondary', size: 'sm' })}>
              <MessageCircle size={16} aria-hidden="true" /> Escribir al club
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
