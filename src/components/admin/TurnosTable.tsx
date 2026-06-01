import { useState } from 'react';
import { Trash2, CalendarDays, Clock3, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { adminEliminarTurno } from '@/lib/admin';
import { formatDate } from '@/lib/format';
import type { TurnoAdmin } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from './ConfirmDialog';

type TurnosTableProps = {
  turnos: TurnoAdmin[];
  loading: boolean;
  onRefresh: () => void;
};

const estadoColors: Record<string, string> = {
  disponible: 'bg-vb-green/10 text-vb-green',
  reservado: 'bg-vb-red/10 text-vb-red',
  pre_reservado: 'bg-vb-yellow/20 text-vb-gray',
  bloqueado_club: 'bg-ink/10 text-ink/50',
};

export function TurnosTable({ turnos, loading, onRefresh }: TurnosTableProps) {
  const [eliminando, setEliminando] = useState<TurnoAdmin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState('');

  const filtered = filtroFecha
    ? turnos.filter((t) => t.fecha === filtroFecha)
    : turnos;

  async function handleDelete() {
    if (!eliminando) return;
    setSubmitting(true);
    try {
      await adminEliminarTurno(eliminando.id);
      toast.success('Turno eliminado');
      setEliminando(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-ink/50">Cargando turnos...</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-ink/50">{filtered.length} turnos</span>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-ink/40" />
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="rounded-md border border-ink/15 px-2 py-1 text-sm"
          />
          {filtroFecha && (
            <Button variant="ghost" size="sm" onClick={() => setFiltroFecha('')}>Limpiar</Button>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        {filtered.map((turno) => (
          <Card key={turno.id} padding="sm">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-ink">{turno.cancha_titulo}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${estadoColors[turno.estado] ?? 'bg-ink/10 text-ink/50'}`}>
                    {turno.estado}
                  </span>
                </div>
                <p className="text-xs text-ink/50">{turno.club_nombre}</p>
              </div>
              <div className="flex items-center gap-3 text-sm text-ink/70">
                <span className="flex items-center gap-1">
                  <CalendarDays size={14} />
                  {formatDate(turno.fecha)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock3 size={14} />
                  {turno.hora_inicio.slice(0, 5)}–{turno.hora_fin.slice(0, 5)}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEliminando(turno)}>
                <Trash2 size={14} className="text-vb-red" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={eliminando !== null}
        title="Eliminar turno"
        message={`¿Seguro que querés eliminar el turno del ${eliminando ? formatDate(eliminando.fecha) : ''} ${eliminando?.hora_inicio.slice(0, 5)}–${eliminando?.hora_fin.slice(0, 5)}? No se puede eliminar si está reservado.`}
        loading={submitting}
        onConfirm={handleDelete}
        onCancel={() => setEliminando(null)}
      />
    </>
  );
}
