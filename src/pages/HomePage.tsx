import { useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePartidos } from '@/hooks/usePartidos';
import { useClubes } from '@/hooks/useClubes';
import { isAdminGlobal } from '@/lib/roles';
import { Header } from '@/components/layout/Header';
import { MapView } from '@/components/features/MapView';
import { MatchList } from '@/components/features/MatchList';
import { AuthForm } from '@/components/features/AuthForm';
import { UserPanel } from '@/components/features/UserPanel';
import { BookingFlow } from '@/components/features/BookingFlow';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export function HomePage() {
  const { session, perfil } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = session != null;

  const { partidos, loading: loadingPartidos, refresh: refreshPartidos } = usePartidos(isAuthenticated);
  const { clubes, refresh: refreshClubes } = useClubes();

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingClubId, setBookingClubId] = useState<number | null>(null);

  const canManageCatalog = isAdminGlobal(perfil?.rol);

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
    <>
      <Header onOpenBooking={() => openBooking()} onRefresh={refresh} />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="grid gap-5">
          <MapView clubes={clubes} onSelectClub={(id) => openBooking(id)} />
          <MatchList partidos={partidos} loading={loadingPartidos} isAuthenticated={isAuthenticated} />
        </section>

        <aside className="grid content-start gap-5">
          {session ? (
            <UserPanel onNavigateAdmin={() => navigate('/admin')} />
          ) : (
            <Card padding="md">
              <AuthForm onMessage={(msg) => toast(msg)} />
            </Card>
          )}

          <Card padding="md">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-ink">Reservar cancha</h2>
              <Search size={20} className="text-court" />
            </div>
            <p className="text-sm text-ink/65">
              Busca un club, elegi la cancha y mira todos los horarios disponibles u ocupados antes de reservar.
            </p>
            <Button className="mt-4" fullWidth onClick={() => openBooking()}>
              <Search size={17} />
              Buscar y alquilar
            </Button>
          </Card>
        </aside>
      </div>

      <BookingFlow
        initialClubId={bookingClubId}
        open={bookingOpen}
        onClose={closeBooking}
        onRefresh={refresh}
      />
    </>
  );
}
