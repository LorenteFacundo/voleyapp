import { useMemo, useState } from 'react';
import { CalendarClock, ImageOff, Pencil, Plus, Volleyball } from 'lucide-react';
import type { CanchaGestion } from '@/api/tipos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Vacio } from '@/components/ui/Estados';
import { formatMoney, pluralizar } from '@/lib/format';
import { useGestion } from '@/contexts/gestion';
import { Apartado } from './Apartado';
import { CanchaModal } from './CanchaModal';
import { etiquetaSuperficie, siguienteOrden } from './canchas';
import type { IrASeccion } from './secciones';

/** Canchas del club, incluidas las inactivas. */
export function SeccionCanchas({ irA }: { irA: IrASeccion }) {
  const { clubId, panel } = useGestion();
  const [editando, setEditando] = useState<CanchaGestion | 'nueva' | null>(null);
  const bloquesPorCancha = useMemo(() => {
    const cuenta = new Map<number, number>();
    for (const horario of panel.horarios) {
      if (horario.activo) cuenta.set(horario.cancha_id, (cuenta.get(horario.cancha_id) ?? 0) + 1);
    }
    return cuenta;
  }, [panel.horarios]);

  const nueva = (
    <Button onClick={() => setEditando('nueva')}>
      <Plus size={16} aria-hidden="true" /> Nueva cancha
    </Button>
  );

  return (
    <>
      <Apartado
        titulo="Canchas"
        descripcion="Nombre, fotos y características que ven los jugadores. Las inactivas no se muestran en la app."
        acciones={panel.canchas.length > 0 ? nueva : undefined}
      >
        {panel.canchas.length === 0 ? (
          <Vacio
            icono={<Volleyball size={32} />}
            titulo="Todavía no cargaste canchas"
            descripcion="Creá tu primera cancha y después cargale los horarios que se pueden reservar."
            accion={nueva}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {panel.canchas.map((cancha) => {
              const bloques = bloquesPorCancha.get(cancha.id) ?? 0;
              const superficie = etiquetaSuperficie(cancha.superficie);
              return (
                <li key={cancha.id} className="flex gap-3 rounded-2xl border border-ink/10 p-3">
                  {cancha.fotos[0] ? (
                    <img src={cancha.fotos[0]} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-20 w-24 shrink-0 place-items-center rounded-xl bg-ink/5 text-ink/65" aria-hidden="true">
                      <ImageOff size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="truncate font-bold text-ink">{cancha.titulo}</h4>
                      {!cancha.activa && <Badge variant="muted">Inactiva</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink/65">
                      {[cancha.techada ? 'Techada' : 'Al aire libre', superficie, pluralizar(cancha.fotos.length, 'foto')]
                        .filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-sm text-ink/75">
                      Referencia {formatMoney(cancha.precio_total)}
                      {cancha.precio_sena > 0 && ` · seña ${formatMoney(cancha.precio_sena)}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {bloques > 0 ? (
                        <Badge variant="success">{pluralizar(bloques, 'bloque publicado', 'bloques publicados')}</Badge>
                      ) : (
                        <Badge variant="warning">Sin horarios publicados</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button variant="secondary" onClick={() => setEditando(cancha)} aria-label={`Editar ${cancha.titulo}`}>
                        <Pencil size={14} aria-hidden="true" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => irA('horarios', { cancha: String(cancha.id) })}
                        aria-label={`Horarios de ${cancha.titulo}`}
                      >
                        <CalendarClock size={14} aria-hidden="true" /> Horarios
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Apartado>

      {editando && (
        <CanchaModal
          key={editando === 'nueva' ? 'nueva' : editando.id}
          clubId={clubId}
          cancha={editando === 'nueva' ? null : editando}
          ordenNueva={siguienteOrden(panel.canchas)}
          onClose={() => setEditando(null)}
          onIrAHorarios={(canchaId) => irA('horarios', { cancha: String(canchaId) })}
        />
      )}
    </>
  );
}
