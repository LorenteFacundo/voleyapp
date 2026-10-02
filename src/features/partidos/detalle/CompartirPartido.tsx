import { Clock, MessageCircle, Share2 } from 'lucide-react';
import type { PartidoDetalle } from '@/api/tipos';
import { enlaceCompartirWhatsApp } from '@/lib/telefono';
import { Card } from '@/components/ui/Card';
import { BotonCopiar } from '@/components/ui/BotonCopiar';
import { Seccion } from '@/features/jugador/Seccion';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { enlaceInvitacion, textoInvitacion } from '../compartir';
import { precioPorJugador, progresoCupo } from '../cupo';

/** Enlace de invitación (solo lo reciben quien organiza, el club y los confirmados). */
export function CompartirPartido({ partido }: { partido: PartidoDetalle }) {
  if (!partido.token || partido.estado_partido === 'cancelado' || partido.estado_partido === 'finalizado') return null;

  if (partido.estado_partido === 'borrador' || partido.estado_partido === 'pre_reservado') {
    return (
      <Card padding="lg">
        <Seccion titulo="Invitá jugadores">
          <p className="flex items-start gap-2 text-sm text-ink/70">
            <Clock size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700" />
            Vas a poder compartir el enlace cuando el club confirme la cancha. Te avisamos apenas pase.
          </p>
        </Seccion>
      </Card>
    );
  }

  const enlace = enlaceInvitacion(window.location.origin, partido.token);
  const progreso = progresoCupo(partido.ocupados, partido.cupo_minimo, partido.cupo_maximo);
  const texto = textoInvitacion({
    clubNombre: partido.club.nombre,
    zona: partido.club.zona,
    canchaTitulo: partido.cancha.titulo,
    inicio: partido.inicio,
    fin: partido.fin,
    nivel: partido.nivel_requerido,
    faltanParaMinimo: progreso.faltanParaMinimo,
    libres: progreso.libres,
    precio: precioPorJugador(partido),
    enlace,
  });

  return (
    <Card padding="lg">
      <Seccion
        titulo="Invitá jugadores"
        descripcion={partido.visibilidad === 'publico'
          ? 'Aparece en "Buscar partido", pero con el enlace llegan directo.'
          : 'Es un partido solo con enlace: lo ve y se suma quien lo tenga.'}
      >
        <div className="rounded-xl border border-ink/10 bg-line px-3 py-2">
          <p className="text-xs font-semibold text-ink/65">Enlace de invitación</p>
          <p className="break-all font-mono text-sm text-ink">{enlace}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={enlaceCompartirWhatsApp(texto)} target="_blank" rel="noopener noreferrer" className={clasesBoton({ variant: 'success', size: 'sm' })}>
            <MessageCircle size={16} aria-hidden="true" /> Compartir por WhatsApp
          </a>
          <BotonCopiar texto={enlace} etiqueta="Copiar enlace" />
          <BotonCopiar texto={texto} etiqueta="Copiar mensaje" etiquetaAccesible="Copiar mensaje de invitación" />
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink/65">
          <Share2 size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          Cuidá el enlace: cualquiera que lo tenga puede ver el partido y pedir lugar.
        </p>
      </Seccion>
    </Card>
  );
}
