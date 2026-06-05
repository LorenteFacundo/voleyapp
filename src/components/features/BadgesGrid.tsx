import { Award, Lock } from 'lucide-react';
import { useBadges } from '@/hooks/useBadges';

const BADGE_EMOJIS: Record<string, string> = {
  Volleyball: '🏐',
  Flame: '🔥',
  Star: '⭐',
  Users: '🤝',
  Trophy: '🏆',
  Zap: '💪',
};

type Props = {
  usuarioId: string;
};

export function BadgesGrid({ usuarioId }: Props) {
  const { obtenidos, catalogo, loading } = useBadges(usuarioId);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-vb-gray/10" />
        ))}
      </div>
    );
  }

  const obtenidosIds = new Set(obtenidos.map((b) => b.id));

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {catalogo.map((badge) => {
        const tiene = obtenidosIds.has(badge.id);
        return (
          <div
            key={badge.id}
            className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center transition ${
              tiene ? 'bg-vb-orange-light' : 'bg-vb-gray/5 opacity-50'
            }`}
            title={badge.descripcion}
          >
            <div className={`grid h-10 w-10 place-items-center rounded-full ${tiene ? 'bg-vb-orange text-white' : 'bg-vb-gray/10 text-vb-gray/40'}`}>
              {tiene ? (
                <span className="text-lg">{BADGE_EMOJIS[badge.icono] ?? '🏅'}</span>
              ) : (
                <Lock size={16} />
              )}
            </div>
            <span className={`text-xs font-semibold ${tiene ? 'text-vb-blue' : 'text-vb-gray/50 line-through'}`}>
              {badge.nombre}
            </span>
          </div>
        );
      })}
    </div>
  );
}
