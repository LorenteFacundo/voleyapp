import { Volleyball } from 'lucide-react';
import type { PartidoPublico } from '@/types';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { MatchCardV2 } from '@/components/features/MatchCardV2';

type MatchListProps = {
  partidos: PartidoPublico[];
  loading: boolean;
  isAuthenticated: boolean;
};

export function MatchList({ partidos, loading }: MatchListProps) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-vb-blue">Partidos abiertos</h2>
        <span className="rounded-full bg-vb-orange-light px-3 py-1 text-xs font-bold text-vb-orange">
          {loading ? '...' : `${partidos.length}`}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={180} rounded />
          ))}
        </div>
      ) : partidos.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
              <Volleyball size={32} />
            </div>
            <div>
              <h3 className="font-bold text-vb-blue">Sin partidos publicados</h3>
              <p className="mt-1 text-sm text-vb-gray/65">
                Todavía no hay partidos activos. ¡Creá el primero!
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
          {partidos.map((partido) => (
            <MatchCardV2 key={partido.id} partido={partido} />
          ))}
        </div>
      )}
    </div>
  );
}
