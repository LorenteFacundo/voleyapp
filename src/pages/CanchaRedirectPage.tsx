import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicoApi } from '@/api/publico';
import { AppShell } from '@/components/layout/AppShell';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { NotFoundPage } from './NotFoundPage';

/** Enlaces anteriores /cancha/:id → página del club con esa cancha elegida. */
export function CanchaRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const canchaId = Number(id);
  const consulta = useQuery({
    queryKey: ['cancha-slug', canchaId],
    queryFn: () => publicoApi.slugDeCancha(canchaId),
    enabled: Number.isInteger(canchaId) && canchaId > 0,
  });
  if (!Number.isInteger(canchaId) || canchaId <= 0) return <NotFoundPage />;
  if (consulta.isPending) return <AppShell><Cargando /></AppShell>;
  if (consulta.isError) return <AppShell><ErrorCarga error={consulta.error} onRetry={() => consulta.refetch()} /></AppShell>;
  if (!consulta.data) return <NotFoundPage />;
  return <Navigate to={`/club/${consulta.data}?cancha=${canchaId}`} replace />;
}
