import { LogOut, RefreshCw, Search, Settings2, Volleyball } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isAdminGlobal } from '@/lib/roles';
import { Button } from '@/components/ui/Button';

type HeaderProps = {
  onOpenBooking: () => void;
  onRefresh: () => void;
};

export function Header({ onOpenBooking, onRefresh }: HeaderProps) {
  const { session, signOut } = useAuth();
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const canManageCatalog = isAdminGlobal(perfil?.rol);

  return (
    <header className="border-b border-ink/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-court text-white">
            <Volleyball size={24} />
          </span>
          <div>
            <h1 className="text-xl font-black tracking-normal text-ink">VoleyApp</h1>
            <p className="text-sm text-ink/65">Canchas, turnos y partidos cerca tuyo</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onOpenBooking}>
            <Search size={17} />
            Alquilar cancha
          </Button>
          {canManageCatalog ? (
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin')}>
              <Settings2 size={17} />
              Admin
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            <RefreshCw size={17} />
            Actualizar
          </Button>
          {session ? (
            <Button size="sm" onClick={signOut}>
              <LogOut size={17} />
              Salir
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
