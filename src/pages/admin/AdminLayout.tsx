import { NavLink, Outlet } from 'react-router-dom';
import { Building2, ClipboardList, Gauge, Inbox, SlidersHorizontal, Users } from 'lucide-react';
import clsx from 'clsx';
import { useResumenAdmin } from '@/api/consultas';
import { AppShell, PageTitle } from '@/components/layout/AppShell';
import { RequireAdmin } from '@/components/layout/Guardas';

const SECCIONES = [
  { ruta: '/admin', label: 'Resumen', icon: Gauge, exacta: true },
  { ruta: '/admin/clubes', label: 'Clubes', icon: Building2 },
  { ruta: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { ruta: '/admin/solicitudes', label: 'Clubes interesados', icon: Inbox },
  { ruta: '/admin/operacion', label: 'Operación', icon: SlidersHorizontal },
  { ruta: '/admin/auditoria', label: 'Auditoría', icon: ClipboardList },
];

function NavegacionAdmin() {
  const resumen = useResumenAdmin();
  const leadsNuevos = resumen.data?.leads_nuevos ?? 0;

  return (
    <nav aria-label="Secciones de administración" className="-mx-4 mb-5 overflow-x-auto px-4">
      <div className="flex min-w-max gap-1 rounded-2xl bg-ink/5 p-1">
        {SECCIONES.map((seccion) => (
          <NavLink
            key={seccion.ruta}
            to={seccion.ruta}
            end={seccion.exacta}
            className={({ isActive }) => clsx(
              'flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
              isActive ? 'bg-white text-vb-blue shadow-sm' : 'text-ink/65 hover:text-ink',
            )}
          >
            <seccion.icon size={16} aria-hidden="true" />
            {seccion.label}
            {seccion.ruta === '/admin/solicitudes' && leadsNuevos > 0 && (
              <>
                <span className="rounded-full bg-vb-orange-ink px-1.5 text-xs font-bold text-white" aria-hidden="true">{leadsNuevos}</span>
                {' '}<span className="sr-only">({leadsNuevos} {leadsNuevos === 1 ? 'nuevo' : 'nuevos'})</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function AdminLayout() {
  return (
    <RequireAdmin>
      <AppShell ancho="amplio">
        <PageTitle titulo="Administración" descripcion="Clubes, usuarios y operación de VoleyApp." />
        <NavegacionAdmin />
        <Outlet />
      </AppShell>
    </RequireAdmin>
  );
}
