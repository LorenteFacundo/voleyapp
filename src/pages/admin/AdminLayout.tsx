import { Outlet } from 'react-router-dom';
import { AppShell, PageTitle } from '@/components/layout/AppShell';
import { RequireAdmin } from '@/components/layout/Guardas';

export function AdminLayout() {
  return (
    <RequireAdmin>
      <AppShell ancho="amplio">
        <PageTitle titulo="Administración" />
        <Outlet />
      </AppShell>
    </RequireAdmin>
  );
}
