import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock3, Users, UserCheck } from 'lucide-react';
import type { PartidoPublico } from '@/types';
import { formatDate, formatMoney } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type MatchCardProps = {
  partido: PartidoPublico;
};

export function MatchCard({ partido }: MatchCardProps) {
  const navigate = useNavigate();
  const yaInscripto = partido.mi_estado_inscripcion != null;
  const estaLleno = partido.jugadores_confirmados >= partido.cupo_maximo;

  return (
    <Card
      hover
      padding="md"
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/partido/${partido.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/partido/${partido.id}`);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-ink truncate">{partido.club_nombre}</h3>
          <p className="text-sm text-ink/60">{partido.cancha_nombre}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="court">{partido.nivel_requerido}</Badge>
          {yaInscripto && (
            <Badge variant="success">
              <UserCheck size={12} className="mr-1" />
              Inscripto
            </Badge>
          )}
          {estaLleno && !yaInscripto && (
            <Badge variant="warning">Lleno</Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <span className="flex items-center gap-2 text-ink/70">
          <CalendarDays size={16} />
          {formatDate(partido.fecha)}
        </span>
        <span className="flex items-center gap-2 text-ink/70">
          <Clock3 size={16} />
          {partido.hora_inicio.slice(0, 5)}
        </span>
        <span className="flex items-center gap-2 text-ink/70">
          <Users size={16} />
          {partido.jugadores_confirmados}/{partido.cupo_maximo}
        </span>
        <span className="font-semibold text-ink">
          {formatMoney(partido.precio_total)}
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-court transition-all"
          style={{
            width: `${Math.min(100, (partido.jugadores_confirmados / partido.cupo_maximo) * 100)}%`,
          }}
        />
      </div>
    </Card>
  );
}
