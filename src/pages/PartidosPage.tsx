import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { AppShell, PageTitle } from '@/components/layout/AppShell';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { ExplorarPartidos } from '@/features/partidos/ExplorarPartidos';
import { MisPartidos } from '@/features/partidos/MisPartidos';

type Vista = 'explorar' | 'mios';

const VISTAS: { id: Vista; label: string }[] = [
  { id: 'explorar', label: 'Explorar' },
  { id: 'mios', label: 'Mis partidos' },
];

export function PartidosPage() {
  const [params, setParams] = useSearchParams();
  const idPestanas = useId();
  const vista: Vista = params.get('vista') === 'mios' ? 'mios' : 'explorar';

  function cambiarVista(nueva: Vista) {
    setParams((actuales) => {
      const proximos = new URLSearchParams(actuales);
      if (nueva === 'mios') proximos.set('vista', 'mios');
      else proximos.delete('vista');
      return proximos;
    }, { replace: true });
  }

  return (
    <AppShell ancho="amplio">
      <PageTitle
        titulo="Partidos"
        descripcion="Sumate a un partido abierto o seguí los tuyos."
        acciones={(
          <Link to="/canchas" className={clasesBoton({ variant: 'primary' })}>
            <Plus size={18} aria-hidden="true" /> Organizar un partido
          </Link>
        )}
      />
      <Tabs tabs={VISTAS} activeTab={vista} onChange={cambiarVista} label="Vistas de partidos" idBase={idPestanas} className="mb-5 sm:max-w-sm" />
      <TabPanel idBase={idPestanas} id={vista}>
        {vista === 'explorar' ? <ExplorarPartidos /> : <MisPartidos onExplorar={() => cambiarVista('explorar')} />}
      </TabPanel>
    </AppShell>
  );
}
