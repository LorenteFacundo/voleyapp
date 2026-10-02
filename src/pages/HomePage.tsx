import { Link } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { rutaIngreso } from '@/lib/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { AvisoOperacion } from '@/features/jugador/AvisoOperacion';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { AccesosRapidos } from '@/features/jugador/inicio/AccesosRapidos';
import { Bienvenida } from '@/features/jugador/inicio/Bienvenida';
import { PartidosAbiertos } from '@/features/jugador/inicio/PartidosAbiertos';
import { ProximaReserva } from '@/features/jugador/inicio/ProximaReserva';
import { RankingTop } from '@/features/jugador/inicio/RankingTop';
import { SumaTuClub } from '@/features/jugador/inicio/SumaTuClub';

export function HomePage() {
  const { session, perfil } = useAuth();

  return (
    <AppShell ancho="amplio">
      <Bienvenida nombre={perfil?.nombre} />

      <AvisoOperacion
        className="mt-4"
        mostrar={['lista', 'pausada', 'no_habilitada', 'sin_sesion']}
        accion={(situacion) => situacion === 'sin_sesion' && (
          <>
            <Link to={rutaIngreso('/app')} className={clasesBoton({ variant: 'blue', size: 'sm' })}>
              <LogIn size={16} aria-hidden="true" /> Ingresar
            </Link>
            <Link to={`${rutaIngreso('/app')}&modo=registro`} className={clasesBoton({ variant: 'secondary', size: 'sm' })}>
              <UserPlus size={16} aria-hidden="true" /> Crear cuenta
            </Link>
          </>
        )}
      />

      <AccesosRapidos className="mt-5" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          {session && <ProximaReserva />}
          <PartidosAbiertos />
        </div>
        <aside aria-label="Ranking y clubes" className="space-y-6">
          <RankingTop />
          <SumaTuClub />
        </aside>
      </div>
    </AppShell>
  );
}
