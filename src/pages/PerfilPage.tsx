import { User, ArrowLeft, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BottomNav } from '@/components/layout/BottomNav';
import { AuthForm } from '@/components/features/AuthForm';
import { toast } from 'sonner';

export function PerfilPage() {
  const navigate = useNavigate();
  const { session, perfil, signOut } = useAuth();

  if (!session) {
    return (
      <div className="app-shell pb-20 md:pb-0">
        <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft size={18} />
            </Button>
            <h1 className="text-lg font-bold text-vb-blue">Perfil</h1>
          </div>
        </header>

        <main className="mx-auto max-w-sm px-4 py-6">
          <Card padding="lg">
            <div className="flex flex-col items-center gap-4 mb-4 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
                <User size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-vb-blue">Bienvenido</h2>
                <p className="text-sm text-vb-gray/65">
                  Iniciá sesión o creá una cuenta para continuar.
                </p>
              </div>
            </div>
            <AuthForm onMessage={(msg) => toast(msg)} />
          </Card>
        </main>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app-shell pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-lg font-bold text-vb-blue">Perfil</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        <Card padding="lg">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-vb-orange text-white text-3xl font-black">
              {(perfil?.nombre_completo ?? session.user.email ?? 'U')[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-vb-blue">
                {perfil?.nombre_completo ?? 'Usuario'}
              </h2>
              <p className="text-sm text-vb-gray/65">{session.user.email}</p>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-vb-light p-3">
                <p className="text-2xl font-bold text-vb-orange">{perfil?.nivel_voley ?? '-'}</p>
                <p className="text-xs text-vb-gray/60">Nivel</p>
              </div>
              <div className="rounded-xl bg-vb-light p-3">
                <p className="text-2xl font-bold text-vb-blue capitalize">{perfil?.rol ?? 'jugador'}</p>
                <p className="text-xs text-vb-gray/60">Rol</p>
              </div>
            </div>

            <Button variant="danger" fullWidth onClick={signOut}>
              <LogOut size={17} />
              Cerrar sesión
            </Button>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
