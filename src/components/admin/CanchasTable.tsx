import { useState } from 'react';
import { Pencil, Volleyball, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminActualizarCancha,
  adminListarHorariosSemanales,
  adminGuardarHorariosSemanales,
} from '@/lib/admin';
import { formatMoney, formatTime } from '@/lib/format';
import type { CanchaAdmin, HorarioSemanal } from '@/types';
import { DIA_SEMANA_LABEL, DIA_SEMANA_CORTO } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';

type CanchasTableProps = {
  canchas: CanchaAdmin[];
  loading: boolean;
  onRefresh: () => void;
};

type HorarioDraft = {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  precio_total: number;
  precio_sena: number;
};

const DIAS = [1, 2, 3, 4, 5, 6, 0]; // Lun a Dom

export function CanchasTable({ canchas, loading, onRefresh }: CanchasTableProps) {
  const [editando, setEditando] = useState<CanchaAdmin | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioTotal, setPrecioTotal] = useState('');
  const [precioSena, setPrecioSena] = useState('');

  // Horarios semanales
  const [horarios, setHorarios] = useState<HorarioDraft[]>([]);
  const [horariosLoading, setHorariosLoading] = useState(false);
  const [editandoHorario, setEditandoHorario] = useState<number | null>(null);

  // Form para nuevo horario
  const [nuevoDia, setNuevoDia] = useState(1);
  const [nuevaHoraInicio, setNuevaHoraInicio] = useState('18:00');
  const [nuevaHoraFin, setNuevaHoraFin] = useState('20:00');
  const [nuevoPrecioTotal, setNuevoPrecioTotal] = useState('');
  const [nuevoPrecioSena, setNuevoPrecioSena] = useState('');

  async function loadHorarios(canchaId: number) {
    setHorariosLoading(true);
    try {
      const data = await adminListarHorariosSemanales(canchaId);
      setHorarios(data.map((h) => ({
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        precio_total: h.precio_total,
        precio_sena: h.precio_sena,
      })));
    } catch {
      toast.error('Error al cargar horarios');
    } finally {
      setHorariosLoading(false);
    }
  }

  function startEdit(cancha: CanchaAdmin) {
    setEditando(cancha);
    setTitulo(cancha.titulo);
    setDescripcion(cancha.descripcion ?? '');
    setPrecioTotal(String(cancha.precio_total));
    setPrecioSena(String(cancha.precio_sena));
    setHorarios([]);
    loadHorarios(cancha.id);
  }

  async function handleSave() {
    if (!editando) return;
    setSubmitting(true);
    try {
      await adminActualizarCancha({
        canchaId: editando.id,
        titulo,
        descripcion,
        precioTotal: parseFloat(precioTotal),
        precioSena: parseFloat(precioSena),
        fotos: editando.fotos,
      });
      toast.success('Cancha actualizada');
      setEditando(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSubmitting(false);
    }
  }

  function handleAddHorario() {
    if (!nuevoPrecioTotal) {
      toast.error('Completá el precio');
      return;
    }
    setHorarios((prev) => [
      ...prev,
      {
        dia_semana: nuevoDia,
        hora_inicio: nuevaHoraInicio,
        hora_fin: nuevaHoraFin,
        precio_total: parseFloat(nuevoPrecioTotal),
        precio_sena: parseFloat(nuevoPrecioSena) || 0,
      },
    ]);
    setNuevoPrecioTotal('');
    setNuevoPrecioSena('');
  }

  function handleRemoveHorario(index: number) {
    setHorarios((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGuardarHorarios() {
    if (!editando) return;
    setSubmitting(true);
    try {
      await adminGuardarHorariosSemanales(editando.id, horarios);
      toast.success('Horarios guardados');
      loadHorarios(editando.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar horarios');
    } finally {
      setSubmitting(false);
    }
  }

  // Agrupar horarios por día para la vista previa
  const horariosPorDia = DIAS.reduce<Record<number, HorarioDraft[]>>((acc, dia) => {
    acc[dia] = horarios.filter((h) => h.dia_semana === dia).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    return acc;
  }, {});

  if (loading) {
    return <div className="text-center py-8 text-ink/50">Cargando canchas...</div>;
  }

  return (
    <>
      <div className="text-sm text-ink/50 mb-3">{canchas.length} canchas</div>

      <div className="grid gap-3">
        {canchas.map((cancha) => (
          <Card key={cancha.id} padding="md">
            <div className="flex items-start gap-3">
              {cancha.fotos[0] ? (
                <img src={cancha.fotos[0]} alt="" className="h-16 w-24 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="grid h-16 w-24 shrink-0 place-items-center rounded-md bg-court/5 text-court">
                  <Volleyball size={24} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-ink">{cancha.titulo}</h3>
                <p className="text-sm text-ink/60">{cancha.club_nombre}</p>
                <div className="mt-1 flex gap-2">
                  <Badge variant="court">{formatMoney(cancha.precio_total)}</Badge>
                  <span className="text-xs text-ink/40">{cancha.turnos_count} turnos</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(cancha)}>
                  <Pencil size={14} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <Card padding="lg" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-ink mb-4">Editar cancha</h2>
            <div className="flex flex-col gap-3">
              <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              <div className="flex flex-col">
                <label className="block text-sm font-semibold text-ink mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm focus:ring-2 focus:ring-court/40 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Precio total (default)" type="number" step="0.01" value={precioTotal} onChange={(e) => setPrecioTotal(e.target.value)} />
                <Input label="Precio seña (default)" type="number" step="0.01" value={precioSena} onChange={(e) => setPrecioSena(e.target.value)} />
              </div>

              {/* Horarios semanales */}
              <div className="mt-4 border-t border-ink/10 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-ink">Horarios semanales</h3>
                  <Button variant="secondary" size="sm" onClick={handleGuardarHorarios} loading={submitting}>
                    <Save size={14} />
                    Guardar horarios
                  </Button>
                </div>

                {/* Vista previa de horarios por día */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {DIAS.map((dia) => (
                    <div key={dia} className="text-center">
                      <div className="text-xs font-bold text-ink/60 mb-1">{DIA_SEMANA_CORTO[dia]}</div>
                      <div className="min-h-[60px] rounded-md border border-ink/10 p-1 bg-ink/[0.02]">
                        {horariosPorDia[dia].length === 0 ? (
                          <div className="text-[10px] text-ink/30 mt-2">-</div>
                        ) : (
                          horariosPorDia[dia].map((h, i) => {
                            const globalIndex = horarios.indexOf(h);
                            return (
                              <div
                                key={i}
                                className="group relative text-[10px] bg-court/10 rounded px-1 py-0.5 mb-0.5 cursor-pointer hover:bg-court/20"
                                onClick={() => handleRemoveHorario(globalIndex)}
                              >
                                <div>{h.hora_inicio.slice(0, 5)}</div>
                                <div>{h.hora_fin.slice(0, 5)}</div>
                                <div className="text-[9px] text-ink/50">{formatMoney(h.precio_total)}</div>
                                <div className="absolute inset-0 flex items-center justify-center bg-vb-red/80 text-white rounded opacity-0 group-hover:opacity-100 transition text-[9px]">
                                  Eliminar
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form para agregar horario */}
                <div className="p-3 rounded-md bg-ink/[0.02] border border-ink/10">
                  <h4 className="text-sm font-semibold text-ink mb-2">Agregar horario</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Día</label>
                      <select
                        value={nuevoDia}
                        onChange={(e) => setNuevoDia(Number(e.target.value))}
                        className="w-full rounded-md border border-ink/15 px-2 py-1.5 text-sm"
                      >
                        {DIAS.map((d) => (
                          <option key={d} value={d}>{DIA_SEMANA_LABEL[d]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Inicio</label>
                      <input
                        type="time"
                        value={nuevaHoraInicio}
                        onChange={(e) => setNuevaHoraInicio(e.target.value)}
                        className="w-full rounded-md border border-ink/15 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Fin</label>
                      <input
                        type="time"
                        value={nuevaHoraFin}
                        onChange={(e) => setNuevaHoraFin(e.target.value)}
                        className="w-full rounded-md border border-ink/15 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Precio</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio total"
                        value={nuevoPrecioTotal}
                        onChange={(e) => setNuevoPrecioTotal(e.target.value)}
                        className="w-full rounded-md border border-ink/15 px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Seña</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio seña"
                        value={nuevoPrecioSena}
                        onChange={(e) => setNuevoPrecioSena(e.target.value)}
                        className="w-full rounded-md border border-ink/15 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button variant="secondary" size="sm" onClick={handleAddHorario} fullWidth>
                        <Plus size={14} />
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <Button variant="ghost" onClick={() => setEditando(null)} disabled={submitting}>Cancelar</Button>
                <Button onClick={handleSave} loading={submitting}>Guardar cancha</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

    </>
  );
}
