import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, CircleCheckBig, Crown, Hourglass, LogIn, UserMinus, UserPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import type { PartidoDetalle } from '@/api/tipos';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { mensajeDeError } from '@/api/cliente';
import { useAuth } from '@/contexts/auth';
import { cumpleNivel, etiquetaNivelPartido, etiquetaNivelVoley } from '@/lib/nivel';
import { rutaIngreso } from '@/lib/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Aviso } from '@/components/ui/Estados';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { AvisoOperacion } from '@/features/jugador/AvisoOperacion';
import { claseEnlace } from '@/features/jugador/estilos';
import { usePuedeReservar } from '@/features/jugador/usePuedeReservar';
import { useAhora } from '@/features/jugador/useAhora';
import { evaluarInscripcion } from '../estado';
import { agregarPartidoAlCalendario } from './calendario';

function BotonCalendario({ partido }: { partido: PartidoDetalle }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => agregarPartidoAlCalendario(partido, window.location.origin)}>
      <CalendarPlus size={16} aria-hidden="true" /> Agregar al calendario
    </Button>
  );
}

/** Mi situación en el partido y las acciones que corresponden: sumarme, bajarme o esperar. */
export function AccionesJugador({ partido, invite }: { partido: PartidoDetalle; invite: string | null }) {
  const { session, perfil } = useAuth();
  const navigate = useNavigate();
  const confirmar = useConfirmar();
  const queryClient = useQueryClient();
  const { puede, situacion } = usePuedeReservar();
  const ahora = useAhora(60_000);
  const enCurso = partido.estado_partido !== 'cancelado' && partido.estado_partido !== 'finalizado'
    && new Date(partido.fin).getTime() > ahora.getTime();

  const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.partidos });

  const unirse = useMutation({
    mutationFn: () => jugadorApi.unirseAPartido(partido.id, invite),
    onSuccess: (resultado) => {
      toast.success(resultado.estado_inscripcion === 'confirmado'
        ? '¡Te sumaste al partido! Nos vemos en la cancha.'
        : 'Pediste sumarte. Te avisamos cuando quien organiza responda.');
      void refrescar();
    },
    onError: (error) => {
      toast.error(mensajeDeError(error));
      void refrescar();
    },
  });

  const salir = useMutation({
    mutationFn: () => jugadorApi.salirDePartido(partido.id),
    onSuccess: () => {
      toast.success(partido.mi_estado === 'pendiente_aprobacion' ? 'Retiraste tu pedido.' : 'Te bajaste del partido.');
      void refrescar();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  async function pedirSalida() {
    const pendiente = partido.mi_estado === 'pendiente_aprobacion';
    const respuesta = await confirmar({
      titulo: pendiente ? '¿Retirar tu pedido?' : '¿Bajarte del partido?',
      descripcion: pendiente
        ? 'Quien organiza ya no va a ver tu pedido para sumarte.'
        : 'Liberás tu lugar para que lo use otra persona. Le avisamos a quien organiza.',
      confirmar: pendiente ? 'Sí, retirar' : 'Sí, bajarme',
      cancelar: 'Volver',
      peligro: true,
    });
    if (respuesta.confirmado) salir.mutate();
  }

  if (partido.soy_organizador) {
    return (
      <Card padding="lg">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-vb-yellow/40 text-vb-blue" aria-hidden="true">
            <Crown size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-black text-vb-blue">Organizás este partido</h2>
            <p className="text-sm text-ink/65">
              {{
                borrador: 'Cuando el club confirme la cancha, el partido se abre y vas a poder invitar gente.',
                pre_reservado: 'Cuando el club confirme la cancha, el partido se abre y vas a poder invitar gente.',
                cancelado: 'Este partido está cancelado.',
                finalizado: '¡Gracias por organizar! Este partido ya se jugó.',
                abierto: 'Compartí el enlace, aprobá a quienes se sumen y coordiná por la charla.',
                confirmado: 'Compartí el enlace, aprobá a quienes se sumen y coordiná por la charla.',
              }[partido.estado_partido]}
            </p>
          </div>
        </div>
        {enCurso && <div className="mt-4"><BotonCalendario partido={partido} /></div>}
      </Card>
    );
  }

  if (partido.mi_estado === 'confirmado' || partido.mi_estado === 'pendiente_pago') {
    return (
      <Card padding="lg">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700" aria-hidden="true">
            <CircleCheckBig size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-black text-vb-blue">Estás anotado</h2>
            <p className="text-sm text-ink/65">
              {partido.estado_partido === 'cancelado'
                ? 'El partido se canceló: no hace falta que hagas nada.'
                : partido.estado_partido === 'finalizado'
                  ? 'Este partido ya se jugó. ¡Gracias por sumarte!'
                  : '¡Nos vemos en la cancha!'}
            </p>
          </div>
        </div>
        {enCurso && (
          <div className="mt-4 flex flex-wrap gap-2">
            <BotonCalendario partido={partido} />
            <Button variant="ghost" size="sm" onClick={pedirSalida} loading={salir.isPending}>
              {!salir.isPending && <UserMinus size={16} aria-hidden="true" />} Bajarme del partido
            </Button>
          </div>
        )}
      </Card>
    );
  }

  if (partido.mi_estado === 'pendiente_aprobacion') {
    return (
      <Card padding="lg">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700" aria-hidden="true">
            <Hourglass size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-black text-vb-blue">Esperando aprobación</h2>
            <p className="text-sm text-ink/65">Pediste sumarte. Quien organiza tiene que aprobarte: te avisamos apenas responda.</p>
          </div>
        </div>
        {enCurso && (
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={pedirSalida} loading={salir.isPending}>
              {!salir.isPending && <UserMinus size={16} aria-hidden="true" />} Retirar pedido
            </Button>
          </div>
        )}
      </Card>
    );
  }

  if (partido.mi_estado === 'rechazado') {
    return (
      <Aviso tono="info" titulo="No quedaste en este partido">
        Quien organiza no aceptó tu inscripción. <Link to="/partidos" className={claseEnlace}>Buscá otro partido abierto</Link>.
      </Aviso>
    );
  }

  const inscripcion = evaluarInscripcion(partido, ahora);
  if (!inscripcion.puede) {
    return (
      <Card padding="lg">
        <p className="flex items-start gap-2 text-sm text-ink/70">
          <UserX size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink/65" />
          {inscripcion.motivo}
        </p>
        <Link to="/partidos" className={`${claseEnlace} mt-2 inline-block text-sm`}>Ver otros partidos abiertos</Link>
      </Card>
    );
  }

  const nivelInsuficiente = !!perfil && !cumpleNivel(perfil.nivel, partido.nivel_requerido);
  const rutaRegreso = `/partido/${partido.id}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;

  return (
    <Card padding="lg" className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-black text-vb-blue">¿Te sumás?</h2>
        <p className="text-sm text-ink/65">
          {partido.requiere_aprobacion
            ? 'Mandá tu pedido: quien organiza aprueba a cada persona y te avisamos su respuesta.'
            : 'Te anotás al toque y quedás en la lista del partido.'}
        </p>
      </div>

      {!session ? (
        <Button size="lg" fullWidth onClick={() => navigate(rutaIngreso(rutaRegreso))}>
          <LogIn size={18} aria-hidden="true" /> Ingresá para sumarte
        </Button>
      ) : !puede && situacion !== 'sin_sesion' ? (
        <AvisoOperacion />
      ) : nivelInsuficiente ? (
        <Aviso tono="alerta" titulo={`Este partido pide nivel ${etiquetaNivelPartido(partido.nivel_requerido).toLowerCase()}`}>
          En tu perfil figura nivel {etiquetaNivelVoley(perfil?.nivel).toLowerCase()}. Si jugás a ese nivel,{' '}
          <Link to="/perfil" className={claseEnlace}>actualizá tu nivel</Link> y volvé a intentarlo.
        </Aviso>
      ) : (
        <Button size="lg" fullWidth onClick={() => unirse.mutate()} loading={unirse.isPending}>
          {!unirse.isPending && <UserPlus size={18} aria-hidden="true" />}
          {partido.requiere_aprobacion ? 'Pedir sumarme' : 'Sumarme al partido'}
        </Button>
      )}
    </Card>
  );
}
