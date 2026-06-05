import { Trophy, Medal } from 'lucide-react';
import { useRanking } from '@/hooks/useRanking';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

type Props = {
  limit?: number;
  mostrarTitulo?: boolean;
};

const MEDAL_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-700'];

export function RankingBoard({ limit = 20, mostrarTitulo = true }: Props) {
  const { ranking, loading } = useRanking(limit);

  return (
    <Card padding="lg">
      {mostrarTitulo && (
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-vb-blue">
          <Trophy size={20} className="text-vb-orange" />
          Ranking de jugadores
        </h2>
      )}

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={48} rounded />)}
        </div>
      ) : ranking.length === 0 ? (
        <p className="py-6 text-center text-sm text-vb-gray/60">
          Todavía no hay jugadores con puntos.
        </p>
      ) : (
        <div className="grid gap-1">
          {ranking.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-vb-light"
            >
              <span className={`w-6 text-center font-bold ${entry.posicion <= 3 ? 'text-lg' : 'text-sm text-vb-gray/50'}`}>
                {entry.posicion <= 3 ? (
                  <Medal size={18} className={MEDAL_COLORS[entry.posicion - 1]} />
                ) : (
                  entry.posicion
                )}
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-vb-orange-light text-vb-orange text-xs font-bold">
                {(entry.nombre_completo ?? 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-vb-blue">
                  {entry.nombre_completo ?? 'Jugador'}
                </p>
                <p className="text-xs text-vb-gray/50">Nivel {entry.nivel_voley ?? '-'}</p>
              </div>
              <span className="text-sm font-bold text-vb-orange">{entry.puntos_total}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
