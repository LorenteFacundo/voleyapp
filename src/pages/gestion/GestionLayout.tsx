import { useMemo } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3, CalendarDays, ExternalLink, Repeat2, Settings, Users, Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import { useClubPanel } from '@/api/consultas';
import { useAuth } from '@/contexts/auth';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, SinPermiso } from '@/components/layout/Guardas';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { Badge } from '@/components/ui/Badge';
import { GestionContext, type GestionClub } from './GestionContext';

const SECCIONES = [
  { ruta: 'agenda', label: 'Agenda', icon: CalendarDays, soloDueno: false },
  { ruta: 'clientes', label: 'Clientes', icon: Users, soloDueno: false },
  { ruta: 'fijos', label: 'Fijos', icon: Repeat2, soloDueno: false },
  { ruta: 'caja', label: 'Caja', icon: Wallet, soloDueno: true },
  { ruta: 'reportes', label: 'Reportes', icon: BarChart3, soloDueno: true },
  { ruta: 'ajustes', label: 'Ajustes', icon: Settings, soloDueno: true },
] as const;

function ContenidoGestion() {
  const { clubId: clubParam } = useParams<{ clubId: string }>();
  const clubId = Number(clubParam);
  const navigate = useNavigate();
  const { perfil } = useAuth();
  const panel = useClubPanel(Number.isFinite(clubId) && clubId > 0 ? clubId : null);

  const contexto = useMemo<GestionClub | null>(() => panel.data
    ? { clubId, panel: panel.data, rol: panel.data.mi_rol, esDueno: panel.data.mi_rol === 'dueno' }
    : null, [clubId, panel.data]);

  if (!Number.isFinite(clubId) || clubId <= 0) return <Navigate to="/gestion" replace />;
  if (panel.isPending) return <Cargando texto="Cargando el panel del club…" className="min-h-[50dvh]" />;
  if (panel.isError) {
    return /permiso/i.test(String((panel.error as Error).message))
      ? <SinPermiso mensaje="No sos parte del equipo de este club." />
      : <ErrorCarga error={panel.error} onRetry={() => panel.refetch()} />;
  }
  if (!contexto) return null;

  const clubes = perfil?.clubes ?? [];
  const secciones = SECCIONES.filter((seccion) => !seccion.soloDueno || contexto.esDueno);

  return (
    <GestionContext.Provider value={contexto}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-vb-orange">Panel del club</p>
          {clubes.length > 1 ? (
            <label className="mt-1 block">
              <span className="sr-only">Club</span>
              <select
                value={clubId}
                onChange={(evento) => navigate(`/gestion/${evento.target.value}/agenda`)}
                className="max-w-full rounded-xl border border-ink/15 bg-white py-1.5 pl-3 pr-8 font-display text-xl font-black text-vb-blue"
              >
                {clubes.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}
              </select>
            </label>
          ) : (
            <h1 className="truncate font-display text-2xl font-black text-vb-blue">{contexto.panel.club.nombre}</h1>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!contexto.panel.club.publicado && <Badge variant="warning">No publicado</Badge>}
          <Badge variant="muted">{contexto.esDueno ? 'Dueño' : 'Encargado'}</Badge>
          <Link
            to={`/club/${contexto.panel.club.slug}`}
            className="flex min-h-9 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-vb-blue hover:underline"
          >
            Ver página pública <ExternalLink size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <nav aria-label="Secciones del club" className="-mx-4 mb-5 overflow-x-auto px-4">
        <div className="flex min-w-max gap-1 rounded-2xl bg-ink/5 p-1">
          {secciones.map((seccion) => (
            <NavLink
              key={seccion.ruta}
              to={`/gestion/${clubId}/${seccion.ruta}`}
              className={({ isActive }) => clsx(
                'flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition',
                isActive ? 'bg-white text-vb-blue shadow-sm' : 'text-ink/60 hover:text-ink',
              )}
            >
              <seccion.icon size={16} aria-hidden="true" />
              {seccion.label}
              {seccion.ruta === 'agenda' && contexto.panel.pendientes > 0 && (
                <span className="rounded-full bg-vb-orange px-1.5 text-xs font-bold text-white" aria-label={`${contexto.panel.pendientes} pedidos pendientes`}>
                  {contexto.panel.pendientes}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet />
    </GestionContext.Provider>
  );
}

export function GestionLayout() {
  return (
    <RequireAuth>
      <AppShell ancho="amplio">
        <ContenidoGestion />
      </AppShell>
    </RequireAuth>
  );
}

/** /gestion: lleva al primer club del que la persona es parte. */
export function GestionInicio() {
  const { perfil, loading, esAdmin } = useAuth();
  if (loading) return <Cargando className="min-h-[50dvh]" />;
  const primero = perfil?.clubes[0];
  if (primero) return <Navigate to={`/gestion/${primero.id}/agenda`} replace />;
  if (esAdmin) return <Navigate to="/admin/clubes" replace />;
  return (
    <AppShell>
      <SinPermiso mensaje="Tu cuenta todavía no gestiona ningún club. Si sos parte de un club, pedile al dueño que te invite desde Ajustes → Equipo." />
    </AppShell>
  );
}
