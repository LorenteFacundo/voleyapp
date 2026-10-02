import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useMisPartidos } from '@/api/consultas';
import { useAuth } from '@/contexts/auth';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { InvitacionIngreso } from '@/features/jugador/InvitacionIngreso';
import { Seccion } from '@/features/jugador/Seccion';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { useAhora } from '@/features/jugador/useAhora';
import { MiPartidoCard } from './MiPartidoCard';
import { partidoTerminado } from './estado';

/** Partidos que organizo o a los que me anoté, separados en próximos y pasados. */
export function MisPartidos({ onExplorar }: { onExplorar: () => void }) {
  const { session, loading } = useAuth();
  const partidos = useMisPartidos();
  const ahora = useAhora(60_000);

  if (!session) {
    if (loading) return <Cargando />;
    return (
      <InvitacionIngreso
        titulo="Ingresá para ver tus partidos"
        descripcion="Acá vas a ver los partidos que organizás y a los que te sumaste."
        siguiente="/partidos?vista=mios"
        icono={<Trophy size={28} />}
      />
    );
  }
  if (partidos.isPending) return <Cargando texto="Cargando tus partidos…" />;
  if (partidos.isError) return <ErrorCarga error={partidos.error} onRetry={() => partidos.refetch()} />;

  const proximos = partidos.data
    .filter((partido) => !partidoTerminado(partido, ahora))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const pasados = partidos.data.filter((partido) => partidoTerminado(partido, ahora));

  if (!proximos.length && !pasados.length) {
    return (
      <Vacio
        icono={<Trophy size={36} />}
        titulo="Todavía no tenés partidos"
        descripcion='Sumate a uno abierto o armá el tuyo: reservá una cancha y activá "Organizar un partido".'
        accion={(
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onExplorar} className={clasesBoton({ variant: 'primary' })}>Buscar partidos</button>
            <Link to="/canchas" className={clasesBoton({ variant: 'secondary' })}>Reservar una cancha</Link>
          </div>
        )}
      />
    );
  }

  return (
    <div className="space-y-8">
      <Seccion titulo="Próximos">
        {proximos.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proximos.map((partido) => <li key={partido.id}><MiPartidoCard partido={partido} /></li>)}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/65">
            No tenés partidos próximos.{' '}
            <button type="button" onClick={onExplorar} className="font-semibold text-vb-blue underline-offset-2 hover:underline">
              Buscá uno abierto
            </button>
          </p>
        )}
      </Seccion>
      {pasados.length > 0 && (
        <Seccion titulo="Jugados y anteriores" descripcion="Los últimos 30 días.">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pasados.map((partido) => <li key={partido.id}><MiPartidoCard partido={partido} pasado /></li>)}
          </ul>
        </Seccion>
      )}
    </div>
  );
}
