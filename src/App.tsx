import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { isAdminGlobal } from '@/lib/roles';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { buscarPartidoPorToken } from '@/lib/booking';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { pilotBookingsEnabled } from '@/lib/pilot';

const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const PartidosPage = lazy(() => import('@/pages/PartidosPage').then((m) => ({ default: m.PartidosPage })));
const CanchasPage = lazy(() => import('@/pages/CanchasPage').then((m) => ({ default: m.CanchasPage })));
const PerfilPage = lazy(() => import('@/pages/PerfilPage').then((m) => ({ default: m.PerfilPage })));
const MisReservasPage = lazy(() => import('@/pages/MisReservasPage').then((m) => ({ default: m.MisReservasPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const MatchDetailPage = lazy(() => import('@/pages/MatchDetailPage').then((m) => ({ default: m.MatchDetailPage })));
const CanchaDetailPage = lazy(() => import('@/pages/CanchaDetailPage').then((m) => ({ default: m.CanchaDetailPage })));
const ClubAgendaPage = lazy(() => import('@/pages/ClubAgendaPage').then((m) => ({ default: m.ClubAgendaPage })));

function InviteRedirect() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!token) { navigate('/app'); return; }
    buscarPartidoPorToken(token).then((partidoId) => {
      if (partidoId) {
        navigate(`/partido/${partidoId}?invite=${encodeURIComponent(token)}`, { replace: true });
      } else {
        setExpired(true);
      }
    });
  }, [token, navigate]);

  if (expired) return (
    <div className="grid min-h-screen place-items-center bg-line px-5 py-12 text-center">
      <div className="max-w-md rounded-2xl bg-white p-8 shadow-soft">
        <h1 className="font-display text-2xl font-black text-ink">Este enlace no está disponible</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/60">Puede haber vencido o el partido ya no aceptar invitaciones. Pedile a quien te lo compartió un enlace actualizado.</p>
        <button onClick={() => navigate('/app', { replace: true })} className="mt-6 rounded-full bg-vb-blue px-5 py-3 text-sm font-bold text-white">Explorar partidos</button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-vb-orange border-t-transparent" />
    </div>
  );
}

function RouteFallback() {
  return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse text-ink/50">Cargando...</div></div>;
}

function AdminGuard({ agenda = false }: { agenda?: boolean }) {
  const { session, perfil, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-vb-orange border-t-transparent" />
          <p className="text-sm text-vb-gray/60">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/app" replace />;
  }

  if (!isAdminGlobal(perfil?.rol) && perfil?.rol !== 'admin_cancha') {
    return <Navigate to="/app" replace />;
  }

  if (perfil?.rol === 'admin_cancha' && !pilotBookingsEnabled) {
    return <Navigate to="/app" replace />;
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="animate-pulse text-ink/50">Cargando...</div></div>}>
      {pilotBookingsEnabled && (agenda || perfil?.rol === 'admin_cancha') ? <ClubAgendaPage /> : <AdminPage />}
    </Suspense>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<Suspense fallback={<RouteFallback />}><HomePage /></Suspense>} />
            <Route path="/partidos" element={<Suspense fallback={<RouteFallback />}><PartidosPage /></Suspense>} />
            <Route path="/canchas" element={<Suspense fallback={<RouteFallback />}><CanchasPage /></Suspense>} />
            <Route path="/perfil" element={<Suspense fallback={<RouteFallback />}><PerfilPage /></Suspense>} />
            <Route path="/mis-reservas" element={<Suspense fallback={<RouteFallback />}><MisReservasPage /></Suspense>} />
            <Route path="/admin" element={<AdminGuard />} />
            <Route path="/agenda" element={<AdminGuard agenda />} />
            <Route
              path="/partido/:id"
              element={
                <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="animate-pulse text-ink/50">Cargando...</div></div>}>
                  <MatchDetailPage />
                </Suspense>
              }
            />
            <Route
              path="/cancha/:id"
              element={
                <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="animate-pulse text-ink/50">Cargando...</div></div>}>
                  <CanchaDetailPage />
                </Suspense>
              }
            />
            <Route path="/partido/invitar/:token" element={<InviteRedirect />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster position="bottom-right" richColors closeButton />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
