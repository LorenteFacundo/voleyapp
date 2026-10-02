import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarCheck, CalendarDays, Home, LogIn, MapPin, Shield, Trophy, User, Volleyball,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/auth';
import { NotificationBell } from './NotificationBell';

type Item = { to: string; label: string; icon: typeof Home; activo?: (ruta: string) => boolean };

function itemsNavegacion(esStaff: boolean, esAdmin: boolean): Item[] {
  const base: Item[] = [
    { to: '/app', label: 'Inicio', icon: Home },
    { to: '/canchas', label: 'Canchas', icon: MapPin, activo: (ruta) => ruta.startsWith('/canchas') || ruta.startsWith('/club/') },
    { to: '/partidos', label: 'Partidos', icon: Trophy, activo: (ruta) => ruta.startsWith('/partido') },
    { to: '/mis-reservas', label: 'Reservas', icon: CalendarCheck },
  ];
  if (esStaff) base.push({ to: '/gestion', label: 'Mi club', icon: CalendarDays, activo: (ruta) => ruta.startsWith('/gestion') });
  if (esAdmin) base.push({ to: '/admin', label: 'Admin', icon: Shield, activo: (ruta) => ruta.startsWith('/admin') });
  return base;
}

function estaActivo(item: Item, ruta: string): boolean {
  return item.activo ? item.activo(ruta) : ruta === item.to;
}

export function AppHeader() {
  const { session, perfil, esStaff, esAdmin } = useAuth();
  const { pathname } = useLocation();
  const items = itemsNavegacion(esStaff, esAdmin);

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <Link to="/app" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-vb-orange-ink text-white shadow-card">
            <Volleyball size={22} aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-black tracking-tight text-vb-blue">VoleyApp</span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={clsx(
                'flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
                estaActivo(item, pathname) ? 'bg-vb-orange-light text-vb-orange-ink' : 'text-ink/65 hover:bg-ink/5 hover:text-ink',
              )}
            >
              <item.icon size={17} aria-hidden="true" /> {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {session && <NotificationBell />}
          {session ? (
            <Link
              to="/perfil"
              aria-label="Mi perfil"
              className="grid h-11 w-11 place-items-center rounded-full bg-vb-blue text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
            >
              {(perfil?.nombre?.trim() || session.user.email || '?').charAt(0).toUpperCase()}
            </Link>
          ) : (
            <Link
              to={`/ingresar?siguiente=${encodeURIComponent(pathname)}`}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-vb-blue px-4 text-sm font-bold text-white hover:bg-vb-blue/90"
            >
              <LogIn size={17} aria-hidden="true" /> Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const { session, esStaff, esAdmin } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const items = itemsNavegacion(esStaff, false);
  // En celulares: hasta 5 accesos. El staff ve "Mi club" en lugar de "Partidos".
  const visibles = esStaff ? items.filter((item) => item.to !== '/partidos') : items;
  const perfil: Item = { to: session ? '/perfil' : '/ingresar', label: session ? 'Perfil' : 'Ingresar', icon: User };
  const finales = [...visibles.slice(0, 4), perfil];

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {finales.map((item) => {
          const activo = estaActivo(item, pathname) || (item.to === '/perfil' && pathname === '/perfil');
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => navigate(item.to)}
              aria-current={activo ? 'page' : undefined}
              className={clsx(
                'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors',
                activo ? 'text-vb-orange-ink' : 'text-ink/65 hover:text-ink',
              )}
            >
              <item.icon size={22} strokeWidth={activo ? 2.5 : 2} aria-hidden="true" />
              {item.label}
              {activo && <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-vb-orange-ink" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {esAdmin && <span className="sr-only">El panel de administración está en el menú de perfil.</span>}
    </nav>
  );
}

/** Estructura de las pantallas de la app: encabezado, contenido y barra inferior. */
export function AppShell({ children, ancho = 'normal' }: { children: ReactNode; ancho?: 'normal' | 'amplio' }) {
  return (
    <div className="app-shell min-h-dvh">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        Saltar al contenido
      </a>
      <AppHeader />
      <main
        id="contenido"
        className={clsx('mx-auto w-full px-4 pb-28 pt-5 lg:pb-12', ancho === 'amplio' ? 'max-w-7xl' : 'max-w-5xl')}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

/** Título de página con acción opcional. */
export function PageTitle({ titulo, descripcion, acciones }: { titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-black tracking-tight text-vb-blue sm:text-3xl">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-ink/65">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}
