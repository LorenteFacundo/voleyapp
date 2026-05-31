import { ShieldCheck, Volleyball } from 'lucide-react';
import type { PartidoPublico } from '@/types';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { MatchCard } from '@/components/features/MatchCard';

type MatchListProps = {
  partidos: PartidoPublico[];
  loading: boolean;
  isAuthenticated: boolean;
};

export function MatchList({ partidos, loading, isAuthenticated }: MatchListProps) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Partidos abiertos</h2>
        <span className="text-sm text-ink/60">
          {loading ? 'Cargando...' : `${partidos.length} publicados`}
        </span>
      </div>

      {!isAuthenticated ? (
        <Card padding="lg">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 text-court" size={22} />
            <div>
              <h3 className="font-bold text-ink">
                Inicia sesion para ver y crear partidos
              </h3>
              <p className="mt-1 text-sm text-ink/65">
                Las canchas y turnos se pueden explorar, pero los partidos usan tu
                usuario para cuidar reservas e inscripciones.
              </p>
            </div>
          </div>
        </Card>
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={140} rounded />
          ))}
        </div>
      ) : partidos.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-court/10 text-court">
              <Volleyball size={24} />
            </div>
            <div>
              <h3 className="font-bold text-ink">Sin partidos publicados</h3>
              <p className="mt-1 text-sm text-ink/65">
                Todavia no hay partidos activos. Cuando haya turnos disponibles,
                podes crear el primero desde el panel lateral.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {partidos.map((partido) => (
            <MatchCard key={partido.id} partido={partido} />
          ))}
        </div>
      )}
    </div>
  );
}
