import { Lock } from 'lucide-react';
import { Vacio } from '@/components/ui/Estados';
import { Ajustes } from '@/features/ajustes/Ajustes';
import { useGestion } from '@/contexts/gestion';

export function AjustesPage() {
  const { esDueno } = useGestion();
  if (!esDueno) {
    return (
      <Vacio
        icono={<Lock size={32} />}
        titulo="Los ajustes son solo para dueños"
        descripcion="Pedile a un dueño del club que haga el cambio o que te dé el rol de dueño desde Ajustes → Equipo."
      />
    );
  }
  return <Ajustes />;
}
