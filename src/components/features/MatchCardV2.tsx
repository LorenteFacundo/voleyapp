import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock3, Users, UserCheck, MapPin } from 'lucide-react';
import type { PartidoPublico } from '@/types';
import { formatDate, formatMoney } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function MatchCardV2({ partido }: { partido: PartidoPublico }) {
  const navigate = useNavigate();
  const yaInscripto = partido.mi_estado_inscripcion != null;
  const estaLleno = partido.jugadores_confirmados >= partido.cupo_maximo;
  const estadoCancha = partido.estado_cancha ?? (partido.estado_partido === 'pre_reservado' ? 'pendiente' : 'confirmada');
  const estadoGrupo = partido.estado_grupo ?? (estaLleno ? 'grupo_completo' : 'faltan_jugadores');
  const progress = Math.min(100, (partido.jugadores_confirmados / partido.cupo_maximo) * 100);

  return (
    <Card
      hover
      padding="md"
      className="group"
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-vb-gray/60">
            <MapPin size={12} />
            <span className="truncate">{partido.club_nombre}</span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-vb-blue truncate group-hover:text-vb-orange transition-colors">
            {partido.cancha_nombre}
          </h3>
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
            <Badge variant="danger">Lleno</Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <span className="flex items-center gap-2 text-vb-gray/70">
          <CalendarDays size={16} className="text-vb-orange" />
          {formatDate(partido.fecha)}
        </span>
        <span className="flex items-center gap-2 text-vb-gray/70">
          <Clock3 size={16} className="text-vb-orange" />
          {partido.hora_inicio.slice(0, 5)}
        </span>
        <span className="flex items-center gap-2 text-vb-gray/70">
          <Users size={16} className="text-vb-orange" />
          {partido.jugadores_confirmados}/{partido.cupo_maximo}
        </span>
        <span className="font-bold text-vb-blue text-lg">
          {formatMoney(partido.precio_total)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className={`rounded-full px-2.5 py-1 ${estadoCancha === 'pendiente' ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'}`}>
          {estadoCancha === 'pendiente' ? 'Cancha pendiente' : 'Cancha confirmada'}
        </span>
        <span className="rounded-full bg-vb-blue/5 px-2.5 py-1 text-vb-blue">
          {estadoGrupo === 'grupo_completo' ? 'Grupo completo' : 'Faltan jugadores'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-vb-gray/60 mb-1.5">
          <span>Progreso de equipo</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-vb-gray/10">
          <div
            className="h-full rounded-full bg-vb-orange transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
