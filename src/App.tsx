import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RequireAuth } from '@/components/layout/Guardas';
import { Cargando } from '@/components/ui/Estados';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function perezosa<T extends Record<string, ComponentType>>(
  cargar: () => Promise<T>, nombre: keyof T,
): LazyExoticComponent<ComponentType> {
  return lazy(() => cargar().then((modulo) => ({ default: modulo[nombre] })));
}

const HomePage = perezosa(() => import('@/pages/HomePage'), 'HomePage');
const CanchasPage = perezosa(() => import('@/pages/CanchasPage'), 'CanchasPage');
const ClubPage = perezosa(() => import('@/pages/ClubPage'), 'ClubPage');
const CanchaRedirectPage = perezosa(() => import('@/pages/CanchaRedirectPage'), 'CanchaRedirectPage');
const PartidosPage = perezosa(() => import('@/pages/PartidosPage'), 'PartidosPage');
const PartidoPage = perezosa(() => import('@/pages/PartidoPage'), 'PartidoPage');
const InvitacionPartidoPage = perezosa(() => import('@/pages/InvitacionPartidoPage'), 'InvitacionPartidoPage');
const MisReservasPage = perezosa(() => import('@/pages/MisReservasPage'), 'MisReservasPage');
const PerfilPage = perezosa(() => import('@/pages/PerfilPage'), 'PerfilPage');
const IngresarPage = perezosa(() => import('@/pages/IngresarPage'), 'IngresarPage');
const InvitacionClubPage = perezosa(() => import('@/pages/InvitacionClubPage'), 'InvitacionClubPage');

const GestionLayout = perezosa(() => import('@/pages/gestion/GestionLayout'), 'GestionLayout');
const GestionInicio = perezosa(() => import('@/pages/gestion/GestionLayout'), 'GestionInicio');
const AgendaPage = perezosa(() => import('@/pages/gestion/AgendaPage'), 'AgendaPage');
const ClientesPage = perezosa(() => import('@/pages/gestion/ClientesPage'), 'ClientesPage');
const FijosPage = perezosa(() => import('@/pages/gestion/FijosPage'), 'FijosPage');
const CajaPage = perezosa(() => import('@/pages/gestion/CajaPage'), 'CajaPage');
const ReportesPage = perezosa(() => import('@/pages/gestion/ReportesPage'), 'ReportesPage');
const AjustesPage = perezosa(() => import('@/pages/gestion/AjustesPage'), 'AjustesPage');

const AdminLayout = perezosa(() => import('@/pages/admin/AdminLayout'), 'AdminLayout');
const ResumenAdminPage = perezosa(() => import('@/pages/admin/ResumenAdminPage'), 'ResumenAdminPage');
const ClubesAdminPage = perezosa(() => import('@/pages/admin/ClubesAdminPage'), 'ClubesAdminPage');
const UsuariosAdminPage = perezosa(() => import('@/pages/admin/UsuariosAdminPage'), 'UsuariosAdminPage');
const SolicitudesAdminPage = perezosa(() => import('@/pages/admin/SolicitudesAdminPage'), 'SolicitudesAdminPage');
const OperacionAdminPage = perezosa(() => import('@/pages/admin/OperacionAdminPage'), 'OperacionAdminPage');
const AuditoriaAdminPage = perezosa(() => import('@/pages/admin/AuditoriaAdminPage'), 'AuditoriaAdminPage');

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<Cargando className="min-h-dvh" />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<HomePage />} />
            <Route path="/ingresar" element={<IngresarPage />} />
            <Route path="/canchas" element={<CanchasPage />} />
            <Route path="/club/:slug" element={<ClubPage />} />
            <Route path="/cancha/:id" element={<CanchaRedirectPage />} />
            <Route path="/partidos" element={<PartidosPage />} />
            <Route path="/partido/invitar/:token" element={<InvitacionPartidoPage />} />
            <Route path="/partido/:id" element={<PartidoPage />} />
            <Route path="/mis-reservas" element={<RequireAuth><MisReservasPage /></RequireAuth>} />
            <Route path="/perfil" element={<PerfilPage />} />
            <Route path="/invitacion/:token" element={<InvitacionClubPage />} />

            <Route path="/gestion" element={<RequireAuth><GestionInicio /></RequireAuth>} />
            <Route path="/gestion/:clubId" element={<GestionLayout />}>
              <Route index element={<Navigate to="agenda" replace />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="fijos" element={<FijosPage />} />
              <Route path="caja" element={<CajaPage />} />
              <Route path="reportes" element={<ReportesPage />} />
              <Route path="ajustes" element={<AjustesPage />} />
            </Route>

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<ResumenAdminPage />} />
              <Route path="clubes" element={<ClubesAdminPage />} />
              <Route path="usuarios" element={<UsuariosAdminPage />} />
              <Route path="solicitudes" element={<SolicitudesAdminPage />} />
              <Route path="operacion" element={<OperacionAdminPage />} />
              <Route path="auditoria" element={<AuditoriaAdminPage />} />
            </Route>

            {/* Rutas anteriores. */}
            <Route path="/agenda" element={<Navigate to="/gestion" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 5000 }} />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
