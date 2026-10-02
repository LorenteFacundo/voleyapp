import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { rutaIngreso } from '@/lib/navigation';
import { Cargando } from '@/components/ui/Estados';

// Las guardas solo ordenan la navegación: cada RPC valida permisos en el servidor.

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Cargando texto="Verificando tu sesión…" className="min-h-[50dvh]" />;
  if (!session) return <Navigate to={rutaIngreso(location.pathname + location.search)} replace />;
  return <>{children}</>;
}

export function SinPermiso({ mensaje = 'No tenés acceso a esta sección.' }: { mensaje?: string }) {
  return (
    <div className="mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <ShieldAlert className="text-vb-orange-ink" size={36} aria-hidden="true" />
      <h1 className="text-xl font-bold text-ink">Acceso restringido</h1>
      <p className="text-sm text-ink/65">{mensaje}</p>
      <Link to="/app" className="mt-2 rounded-xl bg-vb-blue px-4 py-2.5 text-sm font-bold text-white">Volver al inicio</Link>
    </div>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { esAdmin, loading } = useAuth();
  return (
    <RequireAuth>
      {loading ? <Cargando /> : esAdmin ? children : <SinPermiso mensaje="Esta sección es solo para la administración de VoleyApp." />}
    </RequireAuth>
  );
}
