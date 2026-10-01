import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import { useEquipo } from '@/api/consultas';
import type { Equipo, InvitacionCreada, RolClub } from '@/api/tipos';
import { useAuth } from '@/contexts/auth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { fechaArgentina, formatDiaMes, formatRelativo } from '@/lib/date';
import { iniciales } from '@/lib/format';
import { useGestion } from '@/contexts/gestion';
import { Apartado } from './Apartado';
import { EnlaceInvitacion } from './EnlaceInvitacion';
import { etiquetaRol, ROLES_CLUB } from './equipo';
import { FormInvitar } from './FormInvitar';

type Miembro = Equipo['miembros'][number];

/** Personas que gestionan el club, invitaciones pendientes y alta de nuevas. */
export function SeccionEquipo() {
  const { clubId, panel } = useGestion();
  const equipo = useEquipo(clubId);
  const queryClient = useQueryClient();
  const confirmar = useConfirmar();
  const navigate = useNavigate();
  const { refreshPerfil } = useAuth();
  const [creada, setCreada] = useState<InvitacionCreada | null>(null);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: claves.gestion(clubId) });

  const cambiarMiembro = useMutation({
    mutationFn: ({ miembro, rol }: { miembro: Miembro; rol: RolClub | null }) => clubApi.cambiarMiembro(clubId, miembro.user_id, rol),
    onSuccess: async (_resultado, { miembro, rol }) => {
      toast.success(rol ? `${miembro.nombre} ahora es ${etiquetaRol(rol).toLowerCase()}.` : `${miembro.nombre} ya no es parte del equipo.`);
      // Sin rol de dueño ya no puede ver Ajustes: se lo lleva a donde sí tiene acceso.
      if (miembro.soy_yo && !rol) {
        await refreshPerfil();
        navigate('/gestion', { replace: true });
        return;
      }
      if (miembro.soy_yo && rol === 'encargado') {
        await Promise.all([refreshPerfil(), refrescar()]);
        navigate(`/gestion/${clubId}/agenda`, { replace: true });
        return;
      }
      void refrescar();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const revocar = useMutation({
    mutationFn: (invitacionId: number) => clubApi.revocarInvitacion(invitacionId),
    onSuccess: () => {
      toast.success('Invitación anulada. El enlace ya no funciona.');
      void refrescar();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const reenviar = useMutation({
    mutationFn: ({ email, rol }: { email: string; rol: RolClub }) => clubApi.invitar(clubId, email, rol),
    onSuccess: (invitacion) => {
      setCreada(invitacion);
      void refrescar();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  async function cambiarRol(miembro: Miembro, rol: RolClub) {
    const propio = miembro.soy_yo && rol === 'encargado';
    const { confirmado } = await confirmar({
      titulo: `¿Hacer ${etiquetaRol(rol).toLowerCase()} a ${miembro.nombre}?`,
      descripcion: propio
        ? 'Vas a dejar de ser dueño: ya no vas a ver la caja, los reportes ni los ajustes del club.'
        : ROLES_CLUB[rol].resumen,
      confirmar: 'Cambiar rol',
      peligro: propio,
    });
    if (confirmado) cambiarMiembro.mutate({ miembro, rol });
  }

  async function quitar(miembro: Miembro) {
    const { confirmado } = await confirmar({
      titulo: miembro.soy_yo ? '¿Salir del equipo?' : `¿Quitar a ${miembro.nombre} del equipo?`,
      descripcion: miembro.soy_yo
        ? 'Vas a dejar de gestionar este club. Para volver, otro dueño te tiene que invitar.'
        : 'Va a dejar de ver la agenda y los datos del club. Podés volver a invitarlo cuando quieras.',
      confirmar: miembro.soy_yo ? 'Salir del equipo' : 'Quitar',
      peligro: true,
    });
    if (confirmado) cambiarMiembro.mutate({ miembro, rol: null });
  }

  async function anular(invitacion: Equipo['invitaciones'][number]) {
    const { confirmado } = await confirmar({
      titulo: '¿Anular la invitación?',
      descripcion: `El enlace que le mandaste a ${invitacion.email} deja de funcionar.`,
      confirmar: 'Anular',
      peligro: true,
    });
    if (confirmado) revocar.mutate(invitacion.id);
  }

  if (equipo.isPending) return <Cargando texto="Cargando el equipo…" />;
  if (equipo.isError) return <ErrorCarga error={equipo.error} onRetry={() => equipo.refetch()} />;

  const { miembros, invitaciones } = equipo.data;
  const duenos = miembros.filter((miembro) => miembro.rol === 'dueno').length;
  const ocupado = cambiarMiembro.isPending;

  return (
    <div className="space-y-5">
      <Apartado titulo="Equipo" descripcion="Personas que pueden gestionar el club desde VoleyApp.">
        {miembros.length === 0 ? (
          <Vacio icono={<Users size={32} />} titulo="Todavía no hay nadie en el equipo" descripcion="Invitá a quienes atienden el club." />
        ) : (
          <ul className="divide-y divide-ink/10">
            {miembros.map((miembro) => {
              const unicoDueno = miembro.rol === 'dueno' && duenos <= 1;
              return (
                <li key={miembro.user_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-vb-blue text-sm font-bold text-white" aria-hidden="true">
                      {iniciales(miembro.nombre)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                        <span className="truncate">{miembro.nombre}</span>
                        {miembro.soy_yo && <Badge variant="info">vos</Badge>}
                      </p>
                      <p className="truncate text-sm text-ink/65">{miembro.email}</p>
                      <p className="text-xs text-ink/65">En el equipo desde el {formatDiaMes(fechaArgentina(miembro.created_at))}</p>
                    </div>
                  </div>
                  <div className="flex items-end gap-2 sm:w-auto">
                    <Select
                      label={<>Rol{' '}<span className="sr-only">de {miembro.nombre}</span></>}
                      labelOculto
                      className="flex-1 sm:w-40 sm:flex-none"
                      value={miembro.rol}
                      disabled={ocupado || unicoDueno}
                      onChange={(evento) => void cambiarRol(miembro, evento.target.value as RolClub)}
                    >
                      <option value="dueno">Dueño</option>
                      <option value="encargado">Encargado</option>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={ocupado || unicoDueno}
                      onClick={() => void quitar(miembro)}
                      aria-label={miembro.soy_yo ? 'Salir del equipo' : `Quitar a ${miembro.nombre} del equipo`}
                      className="text-red-700 hover:bg-red-50"
                    >
                      <UserMinus size={18} aria-hidden="true" />
                    </Button>
                  </div>
                  {unicoDueno && (
                    <p className="text-xs text-ink/65 sm:hidden">Es el único dueño: el club necesita al menos uno.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {duenos <= 1 && miembros.length > 0 && (
          <p className="mt-2 hidden text-xs text-ink/65 sm:block">El club necesita al menos un dueño: para cambiar el único, primero sumá otro.</p>
        )}
      </Apartado>

      {invitaciones.length > 0 && (
        <Apartado titulo="Invitaciones pendientes" descripcion="Todavía no las aceptaron. Cada enlace vence a los 7 días.">
          <ul className="divide-y divide-ink/10">
            {invitaciones.map((invitacion) => (
              <li key={invitacion.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{invitacion.email}</p>
                  <p className="text-xs text-ink/65">
                    {etiquetaRol(invitacion.rol)} · vence {formatRelativo(invitacion.expira_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    loading={reenviar.isPending && reenviar.variables?.email === invitacion.email}
                    onClick={() => reenviar.mutate({ email: invitacion.email, rol: invitacion.rol })}
                  >
                    <RefreshCw size={14} aria-hidden="true" /> Nuevo enlace
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-red-700"
                    loading={revocar.isPending && revocar.variables === invitacion.id}
                    onClick={() => void anular(invitacion)}
                    aria-label={`Anular la invitación de ${invitacion.email}`}
                  >
                    Anular
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Apartado>
      )}

      <Apartado
        titulo="Invitar a alguien"
        descripcion="Le generamos un enlace para que se sume. Tiene que ingresar con el email que pongas acá."
      >
        <FormInvitar
          clubId={clubId}
          onCreada={(invitacion) => {
            setCreada(invitacion);
            void refrescar();
          }}
        />
      </Apartado>

      <Modal
        open={!!creada}
        onClose={() => setCreada(null)}
        title="Enlace de invitación"
        footer={<Button onClick={() => setCreada(null)}>Listo</Button>}
      >
        {creada && <EnlaceInvitacion invitacion={creada} clubNombre={panel.club.nombre} />}
      </Modal>
    </div>
  );
}
