import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Crown, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { ParticipantePartido, PartidoDetalle } from '@/api/tipos';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { mensajeDeError } from '@/api/cliente';
import { etiquetaNivelVoley } from '@/lib/nivel';
import { iniciales, pluralizar } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { Seccion } from '@/features/jugador/Seccion';

function Persona({ participante, acciones }: { participante: ParticipantePartido; acciones?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <span
        aria-hidden="true"
        className={clsx(
          'grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-sm font-black',
          participante.es_organizador ? 'bg-vb-orange-ink text-white' : 'bg-vb-blue/10 text-vb-blue',
        )}
      >
        {iniciales(participante.nombre)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">
          <span className="truncate">{participante.nombre || 'Jugador'}</span>
          {participante.soy_yo && <Badge variant="court">Vos</Badge>}
          {participante.es_organizador && (
            <Badge variant="info"><Crown size={11} aria-hidden="true" /> Organiza</Badge>
          )}
        </span>
        <span className="block text-xs text-ink/65">Nivel {etiquetaNivelVoley(participante.nivel).toLowerCase()}</span>
      </span>
      {acciones}
    </li>
  );
}

/** Lista de jugadores. Quien organiza (o el club) ve y resuelve los pedidos pendientes. */
export function ParticipantesPartido({ partido }: { partido: PartidoDetalle }) {
  const queryClient = useQueryClient();
  const confirmar = useConfirmar();
  const confirmados = partido.participantes.filter((participante) => participante.estado === 'confirmado');
  const pendientes = partido.participantes.filter((participante) => participante.estado === 'pendiente_aprobacion');
  const activo = ['borrador', 'abierto', 'confirmado'].includes(partido.estado_partido);
  const puedeResolver = (partido.soy_organizador || partido.soy_staff) && activo;

  const resolver = useMutation({
    mutationFn: ({ usuarioId, aprobar }: { usuarioId: string; aprobar: boolean; nombre: string }) =>
      jugadorApi.resolverInscripcion(partido.id, usuarioId, aprobar),
    onSuccess: (_resultado, { aprobar, nombre }) => {
      toast.success(aprobar ? `${nombre} ya está en el partido.` : `Le avisamos a ${nombre} que no quedó.`);
      void queryClient.invalidateQueries({ queryKey: claves.partidos });
    },
    onError: (error) => {
      toast.error(mensajeDeError(error));
      void queryClient.invalidateQueries({ queryKey: claves.partidos });
    },
  });

  async function rechazar(participante: ParticipantePartido) {
    if (!participante.usuario_id) return;
    const respuesta = await confirmar({
      titulo: `¿Rechazar a ${participante.nombre}?`,
      descripcion: 'Le avisamos que no quedó en el partido. No va a poder volver a pedir lugar en este partido.',
      confirmar: 'Sí, rechazar',
      cancelar: 'Volver',
      peligro: true,
    });
    if (respuesta.confirmado) resolver.mutate({ usuarioId: participante.usuario_id, aprobar: false, nombre: participante.nombre });
  }

  const resolviendo = (usuarioId: string | null) => resolver.isPending && resolver.variables?.usuarioId === usuarioId;

  return (
    <Card padding="lg">
      <Seccion
        titulo="Jugadores"
        descripcion={`${pluralizar(confirmados.length + partido.invitados, 'confirmado', 'confirmados')} de ${partido.cupo_maximo} lugares.`}
      >
        {puedeResolver && pendientes.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2">
            <h3 className="pt-1 text-sm font-bold text-amber-950">
              {pendientes.length === 1 ? '1 persona quiere sumarse' : `${pendientes.length} personas quieren sumarse`}
            </h3>
            <ul className="divide-y divide-amber-200">
              {pendientes.map((participante) => (
                <Persona
                  key={participante.usuario_id ?? participante.nombre}
                  participante={participante}
                  acciones={participante.usuario_id && (
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        loading={resolviendo(participante.usuario_id) && resolver.variables?.aprobar}
                        disabled={resolver.isPending}
                        onClick={() => resolver.mutate({ usuarioId: participante.usuario_id!, aprobar: true, nombre: participante.nombre })}
                        aria-label={`Aprobar a ${participante.nombre}`}
                      >
                        <Check size={16} aria-hidden="true" /> Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={resolviendo(participante.usuario_id) && !resolver.variables?.aprobar}
                        disabled={resolver.isPending}
                        onClick={() => rechazar(participante)}
                        aria-label={`Rechazar a ${participante.nombre}`}
                      >
                        <X size={16} aria-hidden="true" /> Rechazar
                      </Button>
                    </span>
                  )}
                />
              ))}
            </ul>
          </div>
        )}

        {confirmados.length || partido.invitados ? (
          <ul className="divide-y divide-ink/10">
            {confirmados.map((participante) => (
              <Persona key={participante.usuario_id ?? `${participante.nombre}-${participante.es_organizador}`} participante={participante} />
            ))}
            {partido.invitados > 0 && (
              <li className="flex items-center gap-3 py-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/5 text-ink/65" aria-hidden="true">
                  <UserPlus size={18} />
                </span>
                <span className="text-sm text-ink/70">
                  {partido.invitados === 1 ? '1 invitado' : `${partido.invitados} invitados`} sin cuenta
                </span>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-ink/65">Todavía no hay jugadores confirmados.</p>
        )}

        {!puedeResolver && pendientes.some((participante) => participante.soy_yo) && (
          <p className="mt-3 text-xs text-ink/65">Tu pedido está esperando la aprobación de quien organiza.</p>
        )}
      </Seccion>
    </Card>
  );
}
