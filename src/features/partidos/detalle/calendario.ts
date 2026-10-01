import type { PartidoDetalle } from '@/api/tipos';
import { agregarAlCalendario, lugarDelClub } from '@/features/jugador/calendario';

/** Descarga el .ics del partido con el enlace para volver a verlo. */
export function agregarPartidoAlCalendario(partido: PartidoDetalle, origen: string): void {
  agregarAlCalendario({
    id: `partido-${partido.id}`,
    titulo: `Partido de vóley en ${partido.club.nombre}`,
    inicio: partido.inicio,
    fin: partido.fin,
    lugar: lugarDelClub(partido.club),
    descripcion: `${partido.cancha.titulo}. Detalles: ${origen}/partido/${partido.id}`,
  }, `partido-${partido.id}.ics`);
}
