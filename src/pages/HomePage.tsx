import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePartidos } from '@/hooks/usePartidos';
import { useClubes } from '@/hooks/useClubes';
import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/layout/HeroSection';
import { BottomNav } from '@/components/layout/BottomNav';
import { ExpandableMap } from '@/components/features/ExpandableMap';
import { MatchList } from '@/components/features/MatchList';
import { BookingFlow } from '@/components/features/BookingFlow';
import { UserPanel } from '@/components/features/UserPanel';
import { AuthForm } from '@/components/features/AuthForm';
import { RankingBoard } from '@/components/features/RankingBoard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export function HomePage() {
  const { session, perfil } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = session != null;

  const { partidos, loading: loadingPartidos, refresh: refreshPartidos } = usePartidos();
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const visiblePartidos = useMemo(() => partidos.filter((partido) => {
    const term = search.toLocaleLowerCase('es-AR').trim();
    if (term && ![partido.club_nombre, partido.cancha_nombre, partido.direccion ?? ''].some((value) => value.toLocaleLowerCase('es-AR').includes(term))) return false;
    const date = new Date(`${partido.fecha}T12:00:00`);
    const today = new Date();
    if (quickFilter === 'Hoy' && date.toDateString() !== today.toDateString()) return false;
    if (quickFilter === 'Este finde' && ![0, 6].includes(date.getDay())) return false;
    if (quickFilter === 'Mi nivel' && perfil?.nivel_voley != null) {
      const level = perfil.nivel_voley < 3 ? 'recreativo' : perfil.nivel_voley < 6 ? 'intermedio' : 'competitivo';
      if (partido.nivel_requerido !== level) return false;
    }
    return true;
  }), [partidos, search, quickFilter, perfil?.nivel_voley]);
  const { clubes, refresh: refreshClubes } = useClubes();

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingClubId, setBookingClubId] = useState<number | null>(null);

  const openBooking = useCallback((clubId?: number) => {
    setBookingClubId(clubId ?? null);
    setBookingOpen(true);
  }, []);

  const closeBooking = useCallback(() => {
    setBookingOpen(false);
    setBookingClubId(null);
  }, []);

  const refresh = useCallback(() => {
    refreshPartidos();
    refreshClubes();
  }, [refreshPartidos, refreshClubes]);

  return (
    <div className="app-shell pb-20 md:pb-0">
      <Header onOpenBooking={() => openBooking()} onRefresh={refresh} />
      <HeroSection onSearch={setSearch} onQuickFilter={setQuickFilter} />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Main content */}
          <div className="grid gap-6">
            <ExpandableMap clubes={clubes} onSelectClub={(id) => openBooking(id)} />
            <MatchList partidos={visiblePartidos} loading={loadingPartidos} isAuthenticated={isAuthenticated} />
          </div>

          {/* Sidebar (desktop) */}
          <aside className="hidden content-start gap-6 lg:grid">
            {session ? (
              <UserPanel onNavigateAdmin={() => navigate('/admin')} />
            ) : (
              <Card padding="md">
                <AuthForm onMessage={(msg) => toast(msg)} />
              </Card>
            )}

            <Card padding="md">
              <div className="text-center">
                <h2 className="font-bold text-vb-blue">Reservar cancha</h2>
                <p className="mt-2 text-sm text-vb-gray/65">
                  Busca un club, elegí la cancha y mirá los horarios disponibles.
                </p>
                <Button className="mt-4" fullWidth onClick={() => openBooking()}>
                  Buscar y alquilar
                </Button>
              </div>
            </Card>

            <RankingBoard limit={10} />
          </aside>
        </div>
      </main>

      {/* FAB for mobile */}
      <button
        onClick={() => openBooking()}
        className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-vb-orange text-white shadow-lg shadow-vb-orange/30 transition hover:scale-105 active:scale-95 md:hidden"
        aria-label="Crear partido"
      >
        <Plus size={28} />
      </button>

      <BottomNav />

      <BookingFlow
        initialClubId={bookingClubId}
        open={bookingOpen}
        onClose={closeBooking}
        onRefresh={refresh}
      />
    </div>
  );
}
