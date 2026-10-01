import { useMemo } from 'react';
import { Trophy, ArrowLeft, Users, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePartidosFiltrados } from '@/hooks/usePartidosFiltrados';
import { MatchFilters } from '@/components/features/MatchFilters';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { MatchCard } from '@/components/features/MatchCard';
import { BottomNav } from '@/components/layout/BottomNav';

export function PartidosPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const isAuthenticated = session != null;
  const { partidos, loading, filtros, setFiltros, refresh } = usePartidosFiltrados(isAuthenticated);

  const misOrganizados = useMemo(
    () => partidos.filter((p) => p.organizador_id === session?.user?.id),
    [partidos, session]
  );

  const misInscripciones = useMemo(
    () => partidos.filter(
      (p) => p.organizador_id !== session?.user?.id && p.mi_estado_inscripcion != null
    ),
    [partidos, session]
  );

  if (!isAuthenticated) {
    return (
      <div className="app-shell pb-20 md:pb-0">
        <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/app')}>
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
              Iniciá sesión para ver tus partidos y inscripciones.
            </p>
            <Button onClick={() => navigate('/perfil')}>Iniciar sesión</Button>
          </div>
        </main>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app-shell pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/app')}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-lg font-bold text-vb-blue">Mis Partidos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <MatchFilters
            filtros={filtros}
            onFiltrosChange={setFiltros}
            resultadoCount={partidos.length}
          />
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={160} rounded />
            ))}
          </div>
        ) : misOrganizados.length === 0 && misInscripciones.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
              <Trophy size={40} />
            </div>
            <h2 className="text-2xl font-bold text-vb-blue">Sin partidos todavía</h2>
            <p className="max-w-sm text-vb-gray/65">
              Cuando creés un partido o te inscribas a uno, va a aparecer acá.
            </p>
            <Button onClick={() => navigate('/app')}>Explorar partidos</Button>
          </div>
        ) : (
          <div className="grid gap-8">
            {/* Organizados por mí */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Calendar size={20} className="text-vb-orange" />
                <h2 className="text-lg font-bold text-vb-blue">
                  Organizados por mí
                </h2>
                <span className="rounded-full bg-vb-orange-light px-2 py-0.5 text-xs font-bold text-vb-orange">
                  {misOrganizados.length}
                </span>
              </div>
              {misOrganizados.length === 0 ? (
                <Card padding="md">
                  <p className="text-sm text-vb-gray/60 text-center py-4">
                    No creaste ningún partido todavía.
                  </p>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {misOrganizados.map((partido) => (
                    <MatchCard key={partido.id} partido={partido} />
                  ))}
                </div>
              )}
            </section>

            {/* Inscripto en */}
            <section>
              <div className="mb-4 flex items-center gap-2">
                <Users size={20} className="text-vb-orange" />
                <h2 className="text-lg font-bold text-vb-blue">
                  Inscripto en
                </h2>
                <span className="rounded-full bg-vb-orange-light px-2 py-0.5 text-xs font-bold text-vb-orange">
                  {misInscripciones.length}
                </span>
              </div>
              {misInscripciones.length === 0 ? (
                <Card padding="md">
                  <p className="text-sm text-vb-gray/60 text-center py-4">
                    No te inscribiste en ningún partido ajeno.
                  </p>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {misInscripciones.map((partido) => (
                    <MatchCard key={partido.id} partido={partido} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
