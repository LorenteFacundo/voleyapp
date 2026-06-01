import { Trophy, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { BottomNav } from '@/components/layout/BottomNav';

export function PartidosPage() {
  const navigate = useNavigate();

  return (
    <div className="app-shell pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-lg font-bold text-vb-blue">Partidos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
            <Trophy size={40} />
          </div>
          <h2 className="text-2xl font-bold text-vb-blue">Mis Partidos</h2>
          <p className="max-w-sm text-vb-gray/65">
            Acá vas a ver los partidos en los que te inscribiste y los que creaste.
          </p>
          <Button onClick={() => navigate('/')}>Volver al inicio</Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
