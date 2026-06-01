import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Volleyball } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMisPartidos } from '@/hooks/useMisPartidos';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { MatchCardV2 } from '@/components/features/MatchCardV2';
import { BottomNav } from '@/components/layout/BottomNav';

type Tab = 'todos' | 'organizados' | 'inscripto';

const TABS: { key: Tab; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'organizados', label: 'Organizados' },
  { key: 'inscripto', label: 'Inscripto' },
];

export function PartidosPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const isAuthenticated = session != null;
  const { partidos, loading } = useMisPartidos(isAuthenticated);
  const [tab, setTab] = useState<Tab>('todos');

  const filtered = tab === 'todos'
    ? partidos
    : tab === 'organizados'
      ? partidos.filter((p) => p.mi_rol === 'organizador')
      : partidos.filter((p) => p.mi_rol === 'jugador');

  return (
    <div className="app-shell pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-lg font-bold text-vb-blue">Mis Partidos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? 'bg-vb-blue text-white shadow-md'
                  : 'bg-vb-gray/10 text-vb-gray/70 hover:bg-vb-gray/20'
              }`}
            >
              {t.label}
              {t.key === 'todos' && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                  {partidos.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {!isAuthenticated ? (
          <Card padding="lg">
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
                <Trophy size={32} />
              </div>
              <div>
                <h3 className="font-bold text-vb-blue">Iniciá sesión para ver tus partidos</h3>
                <p className="mt-1 text-sm text-vb-gray/65">
                  Necesitás una cuenta para crear y unirte a partidos.
                </p>
              </div>
              <Button onClick={() => navigate('/')}>Volver al inicio</Button>
            </div>
          </Card>
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={180} rounded />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card padding="lg">
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
                <Volleyball size={32} />
              </div>
              <div>
                <h3 className="font-bold text-vb-blue">
                  {tab === 'organizados'
                    ? 'No organizaste ningún partido'
                    : tab === 'inscripto'
                      ? 'No te inscribiste en ningún partido'
                      : 'No tenés partidos'}
                </h3>
                <p className="mt-1 text-sm text-vb-gray/65">
                  {tab === 'organizados'
                    ? 'Creá un partido desde la pantalla principal.'
                    : 'Explorá los partidos abiertos y unite a uno.'}
                </p>
              </div>
              <Button onClick={() => navigate('/')}>Ver partidos abiertos</Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
            {filtered.map((partido) => (
              <MatchCardV2 key={partido.id} partido={partido} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
