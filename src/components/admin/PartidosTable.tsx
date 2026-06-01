import { useState } from 'react';
import { XCircle, CalendarDays, Clock3, Users, Shield, User } from 'lucide-react';
import { toast } from 'sonner';
import { adminCancelarPartido } from '@/lib/admin';
import { formatDate } from '@/lib/format';
import type { PartidoAdmin } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from './ConfirmDialog';

type PartidosTableProps = {
  partidos: PartidoAdmin[];
  loading: boolean;
  onRefresh: () => void;
};

const estadoColors: Record<string, string> = {
  pre_reservado: 'warning',
  confirmado: 'success',
  cancelado: 'danger',
  abierto: 'court',
};

const nivelColors: Record<string, string> = {
  recreativo: 'court',
  intermedio: 'warning',
  competitivo: 'danger',
};

export function PartidosTable({ partidos, loading, onRefresh }: PartidosTableProps) {
  const [cancelando, setCancelando] = useState<PartidoAdmin | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCancel() {
    if (!cancelando) return;
    setSubmitting(true);
    try {
      await adminCancelarPartido(cancelando.id);
      toast.success('Partido cancelado');
      setCancelando(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-ink/50">Cargando partidos...</div>;
  }

  return (
    <>
      <div className="text-sm text-ink/50 mb-3">{partidos.length} partidos</div>

      <div className="grid gap-3">
        {partidos.map((partido) => (
          <Card key={partido.id} padding="md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-ink">{partido.cancha_titulo}</h3>
                  <Badge variant={(estadoColors[partido.estado_partido] as 'success' | 'warning' | 'danger' | 'court') ?? 'default'}>
                    {partido.estado_partido}
                  </Badge>
                  <Badge variant={(nivelColors[partido.nivel_requerido] as 'court' | 'warning' | 'danger') ?? 'default'}>
                    {partido.nivel_requerido}
                  </Badge>
                </div>
                <p className="text-xs text-ink/50">{partido.club_nombre}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink/70">
                  <span className="flex items-center gap-1">
                    <User size={14} />
                    {partido.organizador_nombre}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays size={14} />
                    {formatDate(partido.fecha)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock3 size={14} />
                    {partido.hora_inicio.slice(0, 5)}–{partido.hora_fin.slice(0, 5)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {partido.jugadores_confirmados}/{partido.cupo_maximo}
                  </span>
                  {partido.requiere_aprobacion && (
                    <span className="flex items-center gap-1 text-xs text-vb-yellow">
                      <Shield size={14} />
                      Requiere aprobación
                    </span>
                  )}
                </div>
              </div>
              {partido.estado_partido !== 'cancelado' && (
                <Button variant="ghost" size="sm" onClick={() => setCancelando(partido)}>
                  <XCircle size={14} className="text-vb-red" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={cancelando !== null}
        title="Cancelar partido"
        message={`¿Seguro que querés cancelar el partido de ${cancelando?.organizador_nombre} en ${cancelando?.cancha_titulo}?`}
        confirmLabel="Cancelar partido"
        loading={submitting}
        onConfirm={handleCancel}
        onCancel={() => setCancelando(null)}
      />
    </>
  );
}
