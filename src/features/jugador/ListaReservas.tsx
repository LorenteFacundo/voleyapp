import { Link } from 'react-router-dom';
import { CalendarCheck, History } from 'lucide-react';
import { useMisReservas } from '@/api/consultas';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { ReservaCard } from './ReservaCard';
import { Seccion } from './Seccion';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { esReservaActiva } from './reservas';
import { useAhora } from './useAhora';

/** Reservas próximas (activas y canceladas hace poco) o el historial. */
export function ListaReservas({ historial }: { historial: boolean }) {
  const reservas = useMisReservas(historial);
  const ahora = useAhora(30_000);

  if (reservas.isPending) return <Cargando texto="Cargando tus reservas…" />;
  if (reservas.isError) return <ErrorCarga error={reservas.error} onRetry={() => reservas.refetch()} />;

  if (!reservas.data.length) {
    return historial ? (
      <Vacio
        icono={<History size={36} />}
        titulo="Todavía no hay reservas pasadas"
        descripcion="Acá vas a ver las reservas que ya se jugaron, se cancelaron o vencieron."
      />
    ) : (
      <Vacio
        icono={<CalendarCheck size={36} />}
        titulo="No tenés reservas próximas"
        descripcion="Buscá una cancha y pedí tu horario: el club te confirma por acá."
        accion={<Link to="/canchas" className={clasesBoton({ variant: 'primary' })}>Buscar cancha</Link>}
      />
    );
  }

  if (historial) {
    return (
      <ul className="space-y-3">
        {reservas.data.map((reserva) => (
          <li key={reserva.id}><ReservaCard reserva={reserva} ahora={ahora} historial /></li>
        ))}
      </ul>
    );
  }

  const activas = reservas.data.filter(esReservaActiva);
  const inactivas = reservas.data.filter((reserva) => !esReservaActiva(reserva));

  return (
    <div className="space-y-8">
      {activas.length ? (
        <ul className="space-y-3">
          {activas.map((reserva) => <li key={reserva.id}><ReservaCard reserva={reserva} ahora={ahora} /></li>)}
        </ul>
      ) : (
        <Vacio
          icono={<CalendarCheck size={36} />}
          titulo="No tenés reservas activas"
          descripcion="Buscá una cancha y pedí tu horario: el club te confirma por acá."
          accion={<Link to="/canchas" className={clasesBoton({ variant: 'primary' })}>Buscar cancha</Link>}
        />
      )}
      {inactivas.length > 0 && (
        <Seccion titulo="Canceladas o sin confirmar" descripcion="De los últimos 7 días.">
          <ul className="space-y-3">
            {inactivas.map((reserva) => <li key={reserva.id}><ReservaCard reserva={reserva} ahora={ahora} /></li>)}
          </ul>
        </Seccion>
      )}
    </div>
  );
}
