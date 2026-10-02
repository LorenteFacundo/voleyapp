import { Trophy } from 'lucide-react';
import clsx from 'clsx';
import { useRanking } from '@/api/consultas';
import { etiquetaNivelVoley } from '@/lib/nivel';
import { formatNumero } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { Seccion } from '../Seccion';

const MEDALLAS: Record<number, string> = {
  1: 'bg-vb-yellow text-vb-blue',
  2: 'bg-slate-200 text-slate-700',
  3: 'bg-orange-200 text-orange-900',
};

/** Los cinco jugadores con más puntos. */
export function RankingTop() {
  const ranking = useRanking(5);

  return (
    <Card padding="lg">
      <Seccion titulo="Ranking" descripcion="Sumás 10 puntos por partido jugado y 5 por organizar.">
        {ranking.isPending ? (
          <Cargando />
        ) : ranking.isError ? (
          <ErrorCarga error={ranking.error} onRetry={() => ranking.refetch()} />
        ) : !ranking.data.length ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Trophy size={30} className="text-vb-orange-ink" aria-hidden="true" />
            <p className="text-sm text-ink/65">Todavía nadie sumó puntos. ¡Jugá un partido y estrená el ranking!</p>
          </div>
        ) : (
          <ol className="space-y-2">
            {ranking.data.map((jugador) => (
              <li
                key={`${jugador.posicion}-${jugador.nombre}`}
                className={clsx('flex items-center gap-3 rounded-xl px-3 py-2', jugador.soy_yo ? 'bg-vb-orange-light ring-1 ring-vb-orange/30' : 'bg-line')}
              >
                <span
                  className={clsx(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-black',
                    MEDALLAS[jugador.posicion] ?? 'bg-white text-ink/65',
                  )}
                >
                  <span className="sr-only">Puesto </span>{jugador.posicion}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">
                    {jugador.nombre}{jugador.soy_yo && <span className="font-semibold text-vb-orange-ink"> (vos)</span>}
                  </span>
                  <span className="block text-xs text-ink/65">{etiquetaNivelVoley(jugador.nivel)}</span>
                </span>
                <span className="shrink-0 font-display text-base font-black text-vb-blue">
                  {formatNumero(jugador.puntos)} <span className="text-xs font-semibold text-ink/65">pts</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Seccion>
    </Card>
  );
}
