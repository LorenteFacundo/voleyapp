import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CalendarClock, LogIn, MailWarning, UserPlus, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import { jugadorApi } from '@/api/jugador';
import type { InvitacionClub } from '@/api/tipos';
import { useAuth } from '@/contexts/auth';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Aviso, Cargando, ErrorCarga } from '@/components/ui/Estados';
import { rutaIngreso } from '@/lib/navigation';
import { coincideEmailEnmascarado, ROLES_CLUB, vencimientoInvitacion } from '@/features/ajustes/equipo';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { useInvitacionClub } from '@/features/ajustes/useInvitacionClub';

const MOTIVOS: Record<NonNullable<InvitacionClub['motivo']>, { titulo: string; texto: string }> = {
  no_existe: {
    titulo: 'El enlace no es válido',
    texto: 'Revisá que lo hayas copiado completo. Si sigue sin funcionar, pedile al club que te mande una invitación nueva.',
  },
  aceptada: {
    titulo: 'Esta invitación ya se usó',
    texto: 'Si la aceptaste vos, ya podés entrar al panel del club desde “Mi club”.',
  },
  revocada: {
    titulo: 'La invitación fue anulada',
    texto: 'El club la canceló. Si todavía tenés que sumarte, pedile una nueva.',
  },
  vencida: {
    titulo: 'La invitación venció',
    texto: 'Las invitaciones duran 7 días. Pedile al club que te mande una nueva.',
  },
};

function InvitacionInvalida({ motivo }: { motivo: keyof typeof MOTIVOS }) {
  const { session } = useAuth();
  return (
    <Card padding="lg" className="text-center">
      <MailWarning className="mx-auto text-vb-orange-ink" size={36} aria-hidden="true" />
      <h1 className="mt-3 font-display text-2xl font-black text-vb-blue">{MOTIVOS[motivo].titulo}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink/65">{MOTIVOS[motivo].texto}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {motivo === 'aceptada' && session && <Link to="/gestion" className={clasesBoton({ variant: 'primary' })}>Ir a mi club</Link>}
        <Link to="/app" className={clasesBoton({ variant: 'secondary' })}>Ir al inicio</Link>
      </div>
    </Card>
  );
}

function Contenido({ token }: { token: string }) {
  const { session, perfil, loading, refreshPerfil, signOut } = useAuth();
  const navigate = useNavigate();
  const invitacion = useInvitacionClub(token);
  const [error, setError] = useState<string | null>(null);
  const ruta = `/invitacion/${encodeURIComponent(token)}`;

  const aceptar = useMutation({
    mutationFn: () => jugadorApi.aceptarInvitacionClub(token),
    onSuccess: async (resultado) => {
      await refreshPerfil();
      toast.success(`¡Listo! Ya sos parte del equipo de ${resultado.club_nombre}.`);
      navigate(`/gestion/${resultado.club_id}/agenda`, { replace: true });
    },
    onError: (motivo) => setError(mensajeDeError(motivo)),
  });

  if (!token) return <InvitacionInvalida motivo="no_existe" />;
  if (invitacion.isPending) return <Cargando texto="Buscando la invitación…" />;
  if (invitacion.isError) return <ErrorCarga error={invitacion.error} onRetry={() => invitacion.refetch()} />;
  const datos = invitacion.data;
  if (!datos.valida || !datos.rol) return <InvitacionInvalida motivo={datos.motivo ?? 'no_existe'} />;

  const miEmail = perfil?.email ?? session?.user.email ?? null;
  const coincide = coincideEmailEnmascarado(datos.email, miEmail);

  async function cambiarDeCuenta() {
    await signOut();
    navigate(rutaIngreso(ruta));
  }

  return (
    <Card padding="lg">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-vb-orange-light text-vb-orange-ink" aria-hidden="true">
          <UsersRound size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-vb-orange-ink">Invitación al equipo</p>
          <h1 className="font-display text-2xl font-black text-vb-blue">{datos.club_nombre}</h1>
        </div>
      </div>

      <p className="mt-4 text-ink/80">
        Te invitaron a sumarte como <strong>{ROLES_CLUB[datos.rol].etiqueta.toLowerCase()}</strong>.
      </p>
      <p className="mt-1 text-sm text-ink/65">{ROLES_CLUB[datos.rol].resumen}</p>

      <dl className="mt-4 grid gap-2 rounded-xl bg-ink/5 p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-ink/65">Para</dt>
          <dd className="break-all font-semibold text-ink">{datos.email}</dd>
        </div>
        {datos.expira_at && (
          <div>
            <dt className="text-xs font-semibold text-ink/65">Vence</dt>
            <dd className="flex items-center gap-1.5 font-semibold text-ink">
              <CalendarClock size={14} aria-hidden="true" /> {vencimientoInvitacion(datos.expira_at)}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-5 space-y-3">
        {loading ? (
          <Cargando texto="Verificando tu sesión…" className="py-4" />
        ) : !session ? (
          <>
            <p className="text-sm text-ink/70">Para aceptarla, ingresá con <strong className="break-all">{datos.email}</strong>.</p>
            <div className="flex flex-wrap gap-2">
              <Link to={rutaIngreso(ruta)} className={clasesBoton({ variant: 'primary' })}>
                <LogIn size={16} aria-hidden="true" /> Ingresar
              </Link>
              <Link to={`${rutaIngreso(ruta)}&modo=registro`} className={clasesBoton({ variant: 'secondary' })}>
                <UserPlus size={16} aria-hidden="true" /> Crear cuenta
              </Link>
            </div>
            <p className="text-xs text-ink/65">
              Si creás la cuenta y te pedimos confirmar el email, después volvé a abrir este enlace para terminar.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-ink/70">
              Estás usando la cuenta <strong className="break-all">{miEmail}</strong>.
            </p>
            {coincide === false && (
              <Aviso tono="alerta" titulo="La invitación es para otra cuenta">
                Cerrá sesión e ingresá con {datos.email} para aceptarla.
              </Aviso>
            )}
            {error && <Aviso tono="error">{error}</Aviso>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setError(null); aceptar.mutate(); }} loading={aceptar.isPending} disabled={coincide === false}>
                Aceptar invitación
              </Button>
              <Button variant="secondary" onClick={cambiarDeCuenta} disabled={aceptar.isPending}>
                Usar otra cuenta
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export function InvitacionClubPage() {
  const { token = '' } = useParams<{ token: string }>();
  return (
    <AppShell>
      <div className="mx-auto max-w-lg py-2 sm:py-6">
        <Contenido token={token} />
      </div>
    </AppShell>
  );
}
