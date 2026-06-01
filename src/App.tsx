import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { isAdminGlobal } from '@/lib/roles';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HomePage } from '@/pages/HomePage';
import { PartidosPage } from '@/pages/PartidosPage';
import { CanchasPage } from '@/pages/CanchasPage';
import { PerfilPage } from '@/pages/PerfilPage';

const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const MatchDetailPage = lazy(() => import('@/pages/MatchDetailPage').then((m) => ({ default: m.MatchDetailPage })));

function AdminGuard() {
  const { session, perfil } = useAuth();

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (!isAdminGlobal(perfil?.rol)) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="animate-pulse text-ink/50">Cargando...</div></div>}>
      <AdminPage />
    </Suspense>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/partidos" element={<PartidosPage />} />
            <Route path="/canchas" element={<CanchasPage />} />
            <Route path="/perfil" element={<PerfilPage />} />
            <Route path="/admin" element={<AdminGuard />} />
            <Route
              path="/partido/:id"
              element={
                <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="animate-pulse text-ink/50">Cargando...</div></div>}>
                  <MatchDetailPage />
                </Suspense>
              }
            />
          </Routes>
          <Toaster position="bottom-right" richColors closeButton />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
