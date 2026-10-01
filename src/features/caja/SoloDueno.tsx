import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Vacio } from '@/components/ui/Estados';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { useGestion } from '@/contexts/gestion';

/** Aviso para encargados que llegan a una sección reservada al dueño. */
export function SoloDueno({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  const { clubId } = useGestion();
  return (
    <Vacio
      className="rounded-2xl border border-vb-gray/10 bg-white"
      icono={<Lock size={32} />}
      titulo={titulo}
      descripcion={descripcion}
      accion={(
        <Link to={`/gestion/${clubId}/agenda`} className={clasesBoton({ variant: 'blue' })}>
          Ir a la agenda
        </Link>
      )}
    />
  );
}
