import { LogOut, Settings2, Volleyball, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isAdminGlobal } from '@/lib/roles';
import { Button } from '@/components/ui/Button';

type HeaderProps = {
  onOpenBooking: () => void;
  onRefresh: () => void;
};

export function Header({ onOpenBooking, onRefresh }: HeaderProps) {
  const { session, signOut, perfil } = useAuth();
  const navigate = useNavigate();
  const canManageCatalog = isAdminGlobal(perfil?.rol);

  return (
    <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-vb-orange text-white shadow-card">
            <Volleyball size={22} />
          </span>
          <div className="hidden sm:block">
            <h1 className="text-lg font-black tracking-tight text-vb-blue">VoleyApp</h1>
            <p className="text-xs text-vb-gray/60">Canchas, turnos y partidos</p>
          </div>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Button size="sm" onClick={onOpenBooking}>
            <Plus size={16} />
            Crear partido
          </Button>
          {canManageCatalog ? (
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin')}>
              <Settings2 size={16} />
              Admin
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Actualizar
          </Button>
          {session ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut size={16} />
              Salir
            </Button>
          ) : null}
        </div>

        {/* Mobile: just user actions */}
        <div className="flex items-center gap-2 md:hidden">
          {session ? (
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-vb-gray/60 transition hover:bg-vb-gray/5 hover:text-vb-gray"
            >
              <LogOut size={20} />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
