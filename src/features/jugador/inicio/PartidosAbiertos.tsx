import { Link } from 'react-router-dom';
import { Volleyball } from 'lucide-react';
import { useExplorarPartidos } from '@/api/consultas';
import { ErrorCarga, Vacio } from '@/components/ui/Estados';
import { MatchCard } from '@/features/partidos/MatchCard';
import { TarjetasCargando } from '@/features/partidos/ExplorarPartidos';
import { Seccion } from '../Seccion';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { claseEnlace } from '../estilos';

const CANTIDAD = 6;

/** Los próximos partidos abiertos (los mismos que en "Explorar", sin filtros). */
export function PartidosAbiertos() {
  const partidos = useExplorarPartidos({});

  return (
    <Seccion
      titulo="Partidos abiertos"
      descripcion="Sumate a uno y conocé gente para jugar."
      accion={<Link to="/partidos" className={`${claseEnlace} text-sm`}>Ver todos</Link>}
    >
      {partidos.isPending ? (
        <TarjetasCargando cantidad={2} />
      ) : partidos.isError ? (
        <ErrorCarga error={partidos.error} onRetry={() => partidos.refetch()} />
      ) : !partidos.data.length ? (
        <Vacio
          icono={<Volleyball size={36} />}
          titulo="Todavía no hay partidos abiertos"
          descripcion='Armá el primero: reservá una cancha y activá "Organizar un partido" para que se sume gente.'
          accion={<Link to="/canchas" className={clasesBoton({ variant: 'primary' })}>Reservar una cancha</Link>}
          className="rounded-2xl border border-dashed border-ink/15 bg-white"
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {partidos.data.slice(0, CANTIDAD).map((partido) => <li key={partido.id}><MatchCard partido={partido} /></li>)}
          </ul>
          {partidos.data.length > CANTIDAD && (
            <div className="mt-4 text-center">
              <Link to="/partidos" className={clasesBoton({ variant: 'secondary' })}>Ver los {partidos.data.length} partidos</Link>
            </div>
          )}
        </>
      )}
    </Seccion>
  );
}
