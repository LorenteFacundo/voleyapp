import { useId, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/auth';
import { AppShell, PageTitle } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Cargando } from '@/components/ui/Estados';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { FormularioIngreso } from '@/features/auth/FormularioIngreso';
import { FormularioRecuperar } from '@/features/auth/FormularioRecuperar';
import { FormularioRegistro } from '@/features/auth/FormularioRegistro';
import { RedirigirTrasIngreso } from '@/features/auth/RedirigirTrasIngreso';
import { destinoTrasIngreso } from '@/features/auth/validacion';

type Modo = 'ingresar' | 'registro' | 'recuperar';

const MODOS: { id: Modo; label: string }[] = [
  { id: 'ingresar', label: 'Ingresar' },
  { id: 'registro', label: 'Crear cuenta' },
  { id: 'recuperar', label: 'Recuperar' },
];

const ENCABEZADOS: Record<Modo, { titulo: string; descripcion: string }> = {
  ingresar: { titulo: 'Ingresá a tu cuenta', descripcion: 'Reservá canchas, organizá partidos y sumate a los de otros.' },
  registro: { titulo: 'Creá tu cuenta', descripcion: 'Es gratis y te lleva un minuto.' },
  recuperar: { titulo: 'Recuperá tu contraseña', descripcion: 'Te mandamos un enlace para elegir una nueva.' },
};

function leerModo(valor: string | null): Modo {
  return MODOS.some((modo) => modo.id === valor) ? (valor as Modo) : 'ingresar';
}

export function IngresarPage() {
  const { session, loading, recuperandoClave } = useAuth();
  const [params, setParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const idPestanas = useId();
  const siguiente = params.get('siguiente');
  const modo = leerModo(params.get('modo'));

  // El modo vive en la URL (?modo=registro) para poder enlazar directo a cada pestaña.
  function cambiarModo(nuevo: Modo) {
    setParams((actuales) => {
      const proximos = new URLSearchParams(actuales);
      if (nuevo === 'ingresar') proximos.delete('modo');
      else proximos.set('modo', nuevo);
      return proximos;
    }, { replace: true });
  }

  if (session && recuperandoClave) return <Navigate to="/perfil" replace />;
  if (session) return <AppShell><RedirigirTrasIngreso siguiente={siguiente} /></AppShell>;
  if (loading) return <AppShell><Cargando texto="Verificando tu sesión…" className="min-h-[40dvh]" /></AppShell>;

  const encabezado = ENCABEZADOS[modo];

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <PageTitle titulo={encabezado.titulo} descripcion={encabezado.descripcion} />

        <Card padding="lg">
          <Tabs tabs={MODOS} activeTab={modo} onChange={cambiarModo} label="Opciones de acceso" idBase={idPestanas} />
          <TabPanel idBase={idPestanas} id={modo} className="mt-5">
            {modo === 'ingresar' && (
              <FormularioIngreso email={email} onEmailChange={setEmail} onOlvideClave={() => cambiarModo('recuperar')} />
            )}
            {modo === 'registro' && (
              <FormularioRegistro
                email={email}
                onEmailChange={setEmail}
                onIrAIngresar={() => cambiarModo('ingresar')}
                destino={destinoTrasIngreso(siguiente, () => null)}
              />
            )}
            {modo === 'recuperar' && (
              <FormularioRecuperar email={email} onEmailChange={setEmail} onIrAIngresar={() => cambiarModo('ingresar')} />
            )}
          </TabPanel>
        </Card>

        {siguiente && (
          <p className="mt-4 text-center text-sm text-ink/65">Después de ingresar volvés a donde estabas.</p>
        )}
      </div>
    </AppShell>
  );
}
