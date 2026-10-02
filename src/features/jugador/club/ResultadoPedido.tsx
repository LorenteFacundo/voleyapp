import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CircleCheckBig, Hourglass, MessageCircle, Trophy } from 'lucide-react';
import clsx from 'clsx';
import type { BloqueDisponible, ClubPublico, ResultadoSolicitud } from '@/api/tipos';
import { useAuth } from '@/contexts/auth';
import { formatFechaHora } from '@/lib/date';
import { enlaceWhatsApp } from '@/lib/telefono';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { agregarAlCalendario, lugarDelClub } from '../calendario';
import { DatosTransferencia } from '../DatosTransferencia';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { claseEnlace } from '../estilos';
import { mensajeWhatsAppTurno } from '../reservas';
import { ResumenTurno } from './ResumenTurno';

/** Lo que ve la persona después de pedir: confirmada al instante o esperando al club. */
export function ResultadoPedido({
  resultado, club, canchaTitulo, bloque,
}: { resultado: ResultadoSolicitud; club: ClubPublico; canchaTitulo: string; bloque: BloqueDisponible }) {
  const { perfil } = useAuth();
  const confirmada = resultado.estado === 'confirmada';
  const whatsapp = resultado.club.whatsapp ?? club.whatsapp;
  const alias = resultado.club.alias_pago;
  const mensaje = useRef<HTMLParagraphElement>(null);

  // El botón que envió el pedido desaparece: el foco pasa al mensaje para que se lea.
  useEffect(() => {
    mensaje.current?.focus();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'grid h-12 w-12 shrink-0 place-items-center rounded-2xl',
            confirmada ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
          )}
          aria-hidden="true"
        >
          {confirmada ? <CircleCheckBig size={26} /> : <Hourglass size={26} />}
        </span>
        <p ref={mensaje} tabIndex={-1} className="rounded text-sm text-ink/75 focus:outline-none">
          {confirmada
            ? <>Listo, la cancha es tuya. <strong className="text-ink">{club.nombre}</strong> ya tiene tu reserva.</>
            : (
              <>
                <strong className="text-ink">{club.nombre}</strong> tiene hasta el{' '}
                <strong className="text-ink">{resultado.vence_at ? formatFechaHora(resultado.vence_at) : 'turno'}</strong>{' '}
                para responder. Te avisamos por acá apenas lo haga.
              </>
            )}
        </p>
      </div>

      <ResumenTurno clubNombre={club.nombre} canchaTitulo={canchaTitulo} bloque={bloque} />

      {resultado.partido_id && (
        <Aviso tono={confirmada ? 'exito' : 'info'} titulo={confirmada ? 'Tu partido ya está publicado' : 'Tu partido está listo'}>
          <p>
            {confirmada
              ? 'Compartilo para que se sume gente.'
              : 'Se abre para que se sume gente cuando el club confirme la cancha. Te avisamos y ahí lo compartís.'}
          </p>
          <Link to={`/partido/${resultado.partido_id}`} className={clsx(claseEnlace, 'mt-1 inline-flex items-center gap-1')}>
            <Trophy size={15} aria-hidden="true" /> Ver el partido
          </Link>
        </Aviso>
      )}

      {resultado.sena > 0 && (alias ? (
        <DatosTransferencia
          alias={alias}
          titular={resultado.club.titular_pago}
          monto={resultado.sena}
          concepto="seña"
          nota={confirmada
            ? 'Transferí la seña y avisá desde Mis reservas con "Ya transferí la seña".'
            : 'Si el club te pide la seña para confirmar, transferí a este alias y avisá desde Mis reservas.'}
        />
      ) : (
        <p className="text-sm text-ink/65">El club te va a indicar cómo pagar la seña de este turno.</p>
      ))}

      <div className="flex flex-wrap gap-2">
        {whatsapp && (
          <a
            href={enlaceWhatsApp(whatsapp, mensajeWhatsAppTurno({
              motivo: confirmada ? 'reserva' : 'pedido_nuevo',
              nombre: perfil?.nombre,
              cancha: canchaTitulo,
              inicio: bloque.inicio,
              fin: bloque.fin,
            }))}
            target="_blank"
            rel="noopener noreferrer"
            className={clasesBoton({ variant: 'success', size: 'sm' })}
          >
            <MessageCircle size={16} aria-hidden="true" /> Escribirle al club
          </a>
        )}
        {confirmada && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => agregarAlCalendario({
              id: `reserva-${resultado.ocupacion_id}`,
              titulo: `Vóley en ${club.nombre}`,
              inicio: bloque.inicio,
              fin: bloque.fin,
              lugar: lugarDelClub(club),
              descripcion: `${canchaTitulo}. Reserva hecha en VoleyApp.`,
            }, `reserva-${resultado.ocupacion_id}.ics`)}
          >
            <CalendarPlus size={16} aria-hidden="true" /> Agregar al calendario
          </Button>
        )}
      </div>
    </div>
  );
}
