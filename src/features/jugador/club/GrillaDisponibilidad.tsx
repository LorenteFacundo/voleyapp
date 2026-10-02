import type { UseQueryResult } from '@tanstack/react-query';
import { CalendarX2, Sun, Umbrella } from 'lucide-react';
import type { BloqueDisponible, ClubPublico, Disponibilidad } from '@/api/tipos';
import { ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Skeleton } from '@/components/ui/Skeleton';
import { ChipFiltro } from '../ChipFiltro';
import { etiquetaSuperficie } from './politicas';
import { agruparPorCancha, cubreFecha } from './disponibilidad';
import { BloqueHorario } from './BloqueHorario';

function Leyenda() {
  const items = [
    { color: 'bg-green-600', texto: 'Libre' },
    { color: 'bg-ink/25', texto: 'Ocupado' },
    { color: 'bg-amber-500', texto: 'Tu pedido' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/65" aria-label="Referencias">
      {items.map((item) => (
        <li key={item.texto} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${item.color}`} aria-hidden="true" /> {item.texto}
        </li>
      ))}
    </ul>
  );
}

/** Horarios del día elegido, agrupados por cancha, con filtro de cancha. */
export function GrillaDisponibilidad({
  club, fecha, hoy, canchaId, consulta, onElegirCancha, onElegirBloque,
}: {
  club: ClubPublico;
  fecha: string;
  hoy: string;
  canchaId: number | null;
  consulta: UseQueryResult<Disponibilidad>;
  onElegirCancha: (canchaId: number | null) => void;
  onElegirBloque: (bloque: BloqueDisponible) => void;
}) {
  const cargandoFecha = consulta.isPending || (!cubreFecha(consulta.data, fecha) && consulta.isFetching);
  const grupos = agruparPorCancha(club.canchas, consulta.data?.bloques ?? [], fecha, canchaId);
  const hayBloques = grupos.some((grupo) => grupo.bloques.length > 0);
  const mostrarTitulos = canchaId == null && club.canchas.length > 1;

  return (
    <div className="space-y-4">
      {club.canchas.length > 1 && (
        <div role="group" aria-label="Filtrar por cancha" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <ChipFiltro activo={canchaId == null} onClick={() => onElegirCancha(null)}>Todas las canchas</ChipFiltro>
          {club.canchas.map((cancha) => (
            <ChipFiltro key={cancha.id} activo={canchaId === cancha.id} onClick={() => onElegirCancha(cancha.id)}>
              {cancha.titulo}
            </ChipFiltro>
          ))}
        </div>
      )}

      <Leyenda />

      {consulta.isError && !cubreFecha(consulta.data, fecha) ? (
        <ErrorCarga error={consulta.error} onRetry={() => consulta.refetch()} />
      ) : cargandoFecha ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 8 }, (_, indice) => <Skeleton key={indice} height={76} className="rounded-xl" />)}
        </div>
      ) : !hayBloques ? (
        <Vacio
          icono={<CalendarX2 size={32} />}
          titulo="No hay horarios publicados para este día"
          descripcion="Probá con otro día o escribile al club para consultar."
          className="rounded-2xl border border-dashed border-ink/15 bg-white"
        />
      ) : (
        <div className="space-y-5" aria-busy={consulta.isFetching || undefined}>
          {grupos.map(({ cancha, bloques }) => (
            <div key={cancha.id}>
              {mostrarTitulos && (
                <h3 className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-ink">
                  {cancha.titulo}
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink/65">
                    {cancha.techada ? <Umbrella size={12} aria-hidden="true" /> : <Sun size={12} aria-hidden="true" />}
                    {[cancha.techada ? 'Techada' : 'Al aire libre', etiquetaSuperficie(cancha.superficie)].filter(Boolean).join(' · ')}
                  </span>
                </h3>
              )}
              {bloques.length ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {bloques.map((bloque) => (
                    <li key={`${bloque.horario_id}-${bloque.fecha}`}>
                      <BloqueHorario
                        bloque={bloque}
                        canchaTitulo={cancha.titulo}
                        hoy={hoy}
                        ventanaDias={club.ventana_reserva_dias}
                        onElegir={onElegirBloque}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-ink/5 px-3 py-3 text-sm text-ink/65">Esta cancha no tiene horarios este día.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
