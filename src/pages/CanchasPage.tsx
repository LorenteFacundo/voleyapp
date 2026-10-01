import { useState, useEffect, useMemo } from 'react';
import { MapPin, ArrowLeft, Search, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { BottomNav } from '@/components/layout/BottomNav';

type CanchaConClub = {
  id: number;
  titulo: string;
  descripcion: string | null;
  fotos: string[];
  precio_total: number;
  precio_sena: number;
  club_nombre: string;
  club_direccion: string | null;
};

export function CanchasPage() {
  const navigate = useNavigate();
  const [canchas, setCanchas] = useState<CanchaConClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('canchas')
      .select(`
        id, titulo, descripcion, fotos, precio_total, precio_sena,
        clubes:club_id (nombre, direccion)
      `)
      .order('titulo', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching canchas:', error);
          setCanchas([]);
        } else {
          const mapped = (data ?? []).map((c: any) => ({
            id: c.id,
            titulo: c.titulo,
            descripcion: c.descripcion,
            fotos: c.fotos ?? [],
            precio_total: c.precio_total,
            precio_sena: c.precio_sena,
            club_nombre: c.clubes?.nombre ?? 'Sin club',
            club_direccion: c.clubes?.direccion ?? null,
          }));
          setCanchas(mapped);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return canchas;
    const term = search.toLowerCase();
    return canchas.filter(
      (c) =>
        c.titulo.toLowerCase().includes(term) ||
        c.club_nombre.toLowerCase().includes(term) ||
        (c.club_direccion?.toLowerCase().includes(term) ?? false)
    );
  }, [canchas, search]);

  return (
    <div className="app-shell pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/app')}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-lg font-bold text-vb-blue">Canchas</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-vb-gray/40" size={18} />
          <Input
            className="pl-10"
            placeholder="Buscar por nombre, club o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={220} rounded />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
              <MapPin size={40} />
            </div>
            <h2 className="text-2xl font-bold text-vb-blue">
              {search ? 'Sin resultados' : 'Sin canchas disponibles'}
            </h2>
            <p className="max-w-sm text-vb-gray/65">
              {search
                ? 'No se encontraron canchas con ese criterio. Probá con otro término.'
                : 'Todavía no hay canchas publicadas. Volvé más tarde.'}
            </p>
            {search && (
              <Button variant="secondary" onClick={() => setSearch('')}>
                Limpiar búsqueda
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-vb-gray/60">
              {filtered.length} cancha{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((cancha) => (
                <Card
                  key={cancha.id}
                  hover
                  padding="none"
                  className="cursor-pointer overflow-hidden"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/cancha/${cancha.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/cancha/${cancha.id}`);
                    }
                  }}
                >
                  {cancha.fotos[0] ? (
                    <img
                      src={cancha.fotos[0]}
                      alt={cancha.titulo}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-vb-light text-vb-orange">
                      <MapPin size={40} />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-vb-blue truncate">{cancha.titulo}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-vb-gray/60">
                      <MapPin size={14} />
                      <span className="truncate">{cancha.club_nombre}</span>
                    </p>
                    {cancha.club_direccion && (
                      <p className="mt-0.5 text-xs text-vb-gray/50 truncate">
                        {cancha.club_direccion}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <Badge variant="court">
                        <DollarSign size={12} className="mr-0.5" />
                        {formatMoney(cancha.precio_total)}
                      </Badge>
                      <span className="text-xs text-vb-gray/50">
                        Seña {formatMoney(cancha.precio_sena)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
