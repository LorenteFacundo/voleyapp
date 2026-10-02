import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { AppShell, PageTitle } from '@/components/layout/AppShell';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { ListaReservas } from '@/features/jugador/ListaReservas';
import { clasesBoton } from '@/components/ui/estilosBoton';

type Vista = 'proximas' | 'historial';

const VISTAS: { id: Vista; label: string }[] = [
  { id: 'proximas', label: 'Próximas' },
  { id: 'historial', label: 'Historial' },
];

export function MisReservasPage() {
  const [params, setParams] = useSearchParams();
  const idPestanas = useId();
  const vista: Vista = params.get('vista') === 'historial' ? 'historial' : 'proximas';

  function cambiarVista(nueva: Vista) {
    setParams((actuales) => {
      const proximos = new URLSearchParams(actuales);
      if (nueva === 'historial') proximos.set('vista', 'historial');
      else proximos.delete('vista');
      return proximos;
    }, { replace: true });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <PageTitle
          titulo="Mis reservas"
          descripcion="Tus pedidos, confirmaciones y pagos en un solo lugar."
          acciones={(
            <Link to="/canchas" className={clasesBoton({ variant: 'secondary' })}>
              <Search size={17} aria-hidden="true" /> Buscar cancha
            </Link>
          )}
        />
        <Tabs tabs={VISTAS} activeTab={vista} onChange={cambiarVista} label="Vistas de reservas" idBase={idPestanas} className="mb-5 sm:max-w-sm" />
        <TabPanel idBase={idPestanas} id={vista}>
          <ListaReservas key={vista} historial={vista === 'historial'} />
        </TabPanel>
      </div>
    </AppShell>
  );
}
