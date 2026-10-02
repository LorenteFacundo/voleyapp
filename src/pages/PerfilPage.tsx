import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { Perfil } from '@/api/tipos';
import { ApiError } from '@/api/cliente';
import { useAuth } from '@/contexts/auth';
import { AppShell, PageTitle } from '@/components/layout/AppShell';
import { Button, Spinner } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { FormularioNuevaClave } from '@/features/auth/FormularioNuevaClave';
import { InvitacionIngreso } from '@/features/jugador/InvitacionIngreso';
import { Seccion } from '@/features/jugador/Seccion';
import { AccesosPerfil } from '@/features/jugador/perfil/AccesosPerfil';
import { FormularioPerfil } from '@/features/jugador/perfil/FormularioPerfil';
import { ListaLogros } from '@/features/jugador/perfil/ListaLogros';
import { ModalCambiarClave } from '@/features/jugador/perfil/ModalCambiarClave';
import { ResumenPerfil } from '@/features/jugador/perfil/ResumenPerfil';

function ElegirNuevaClave() {
  const { terminarRecuperacion } = useAuth();
  return (
    <div className="mx-auto max-w-md">
      <PageTitle
        titulo="Elegí una nueva contraseña"
        descripcion="Entraste con el enlace para recuperar tu cuenta. Elegí la contraseña que vas a usar de ahora en más."
      />
      <Card padding="lg">
        <FormularioNuevaClave
          acciones={<Button variant="ghost" onClick={terminarRecuperacion}>Ahora no</Button>}
        />
      </Card>
    </div>
  );
}

function VistaPerfil({ perfil }: { perfil: Perfil }) {
  const { esStaff, esAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  async function cerrarSesion() {
    setSaliendo(true);
    try {
      await signOut();
      toast.success('Cerraste sesión. ¡Nos vemos en la cancha!');
      navigate('/app', { replace: true });
    } catch {
      toast.error('No pudimos cerrar la sesión. Intentá de nuevo.');
      setSaliendo(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle titulo="Tu perfil" descripcion="Tus datos, tus logros y los accesos de tu cuenta." />
      <div className="space-y-5">
        <ResumenPerfil perfil={perfil} />
        <AccesosPerfil esStaff={esStaff} esAdmin={esAdmin} />
        <Card padding="lg">
          <Seccion titulo="Tus datos" descripcion="Así te ven en los partidos y los clubes donde reservás.">
            <FormularioPerfil key={perfil.id} perfil={perfil} />
          </Seccion>
        </Card>
        <Card padding="lg">
          <Seccion titulo="Logros">
            <ListaLogros />
          </Seccion>
        </Card>
        <Card padding="lg">
          <Seccion titulo="Cuenta">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => setCambiandoClave(true)}>
                <KeyRound size={17} aria-hidden="true" /> Cambiar contraseña
              </Button>
              <button
                type="button"
                onClick={cerrarSesion}
                disabled={saliendo}
                aria-busy={saliendo || undefined}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saliendo ? <Spinner /> : <LogOut size={17} aria-hidden="true" />}
                {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </div>
          </Seccion>
        </Card>
      </div>
      <ModalCambiarClave abierto={cambiandoClave} onCerrar={() => setCambiandoClave(false)} />
    </div>
  );
}

export function PerfilPage() {
  const { session, perfil, loading, recuperandoClave, refreshPerfil } = useAuth();

  // Quien llega con el enlace de recuperación primero elige la contraseña.
  if (session && recuperandoClave) return <AppShell><ElegirNuevaClave /></AppShell>;
  if (loading) return <AppShell><Cargando texto="Cargando tu perfil…" className="min-h-[40dvh]" /></AppShell>;

  if (!session) {
    return (
      <AppShell>
        <PageTitle titulo="Tu perfil" />
        <InvitacionIngreso
          titulo="Ingresá para ver tu perfil"
          descripcion="Con tu cuenta seguís tus reservas y partidos, sumás puntos y desbloqueás logros."
          siguiente="/perfil"
          icono={<UserRound size={28} />}
        />
      </AppShell>
    );
  }

  if (!perfil) {
    return (
      <AppShell>
        <PageTitle titulo="Tu perfil" />
        <ErrorCarga
          error={new ApiError('No pudimos cargar tu perfil. Revisá tu conexión e intentá de nuevo.')}
          onRetry={() => void refreshPerfil()}
        />
      </AppShell>
    );
  }

  return <AppShell><VistaPerfil perfil={perfil} /></AppShell>;
}
