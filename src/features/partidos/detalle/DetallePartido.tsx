import type { PartidoDetalle } from '@/api/tipos';
import { AccionesJugador } from './AccionesJugador';
import { ChatPartido } from './ChatPartido';
import { CompartirPartido } from './CompartirPartido';
import { EncabezadoPartido } from './EncabezadoPartido';
import { PanelOrganizador } from './PanelOrganizador';
import { ParticipantesPartido } from './ParticipantesPartido';

/** Página de un partido: datos, mi lugar, invitación, organización, jugadores y charla. */
export function DetallePartido({ partido, invite }: { partido: PartidoDetalle; invite: string | null }) {
  // La charla es solo para quien organiza y las personas confirmadas.
  const enLaCharla = partido.soy_organizador || partido.mi_estado === 'confirmado';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <EncabezadoPartido partido={partido} />
      <AccionesJugador partido={partido} invite={invite} />
      <CompartirPartido partido={partido} />
      <PanelOrganizador partido={partido} />
      <ParticipantesPartido partido={partido} />
      {enLaCharla && <ChatPartido partidoId={partido.id} />}
    </div>
  );
}
