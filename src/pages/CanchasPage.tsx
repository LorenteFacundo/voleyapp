import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, Search, Volleyball } from 'lucide-react';
import { useAllCanchas } from '@/hooks/useAllCanchas';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { BottomNav } from '@/components/layout/BottomNav';

export function CanchasPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { canchas, loading } = useAllCanchas(search);

  return (
    <div className="app-shell pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
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
            placeholder="Buscar por nombre de cancha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Count */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-vb-blue">Canchas disponibles</h2>
          <span className="rounded-full bg-vb-orange-light px-3 py-1 text-xs font-bold text-vb-orange">
            {loading ? '...' : `${canchas.length}`}
          </span>
        </div>

        {/* List */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={220} rounded />
            ))}
          </div>
        ) : canchas.length === 0 ? (
          <Card padding="lg">
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
                <Volleyball size={32} />
              </div>
              <div>
                <h3 className="font-bold text-vb-blue">No se encontraron canchas</h3>
                <p className="mt-1 text-sm text-vb-gray/65">
                  {search ? 'Probá con otro término de búsqueda.' : 'Todavía no hay canchas publicadas.'}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
            {canchas.map((cancha) => (
              <Card
                key={cancha.id}
                hover
                padding="none"
                className="group cursor-pointer overflow-hidden"
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
                {/* Image */}
                {cancha.fotos[0] ? (
                  <img
                    alt={cancha.titulo}
                    className="h-40 w-full object-cover transition group-hover:scale-105"
                    src={cancha.fotos[0]}
                  />
                ) : (
                  <div className="grid h-40 place-items-center bg-court/5 text-court">
                    <Volleyball size={40} />
                  </div>
                )}

                <div className="p-4">
                  {/* Club name */}
                  {cancha.clubes && (
                    <p className="flex items-center gap-1.5 text-xs text-vb-gray/60">
                      <MapPin size={12} />
                      <span className="truncate">{cancha.clubes.nombre}</span>
                    </p>
                  )}

                  {/* Title */}
                  <h3 className="mt-1 text-lg font-bold text-vb-blue truncate group-hover:text-vb-orange transition-colors">
                    {cancha.titulo}
                  </h3>

                  {/* Description */}
                  {cancha.descripcion && (
                    <p className="mt-1 line-clamp-2 text-sm text-vb-gray/65">
                      {cancha.descripcion}
                    </p>
                  )}

                  {/* Info row */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="court">{formatMoney(cancha.precio_total)}</Badge>
                      {cancha.clubes?.direccion && (
                        <span className="flex items-center gap-1 text-xs text-vb-gray/55">
                          <MapPin size={11} />
                          <span className="truncate max-w-[120px]">{cancha.clubes.direccion}</span>
                        </span>
                      )}
                    </div>
                    {cancha.clubes?.telefono && (
                      <span className="flex items-center gap-1 text-xs text-vb-gray/55">
                        <Phone size={11} />
                        {cancha.clubes.telefono}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
