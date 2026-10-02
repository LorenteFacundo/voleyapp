import { descargarArchivo, generarIcs } from '@/lib/archivos';

export type EventoCalendario = {
  id: string;
  titulo: string;
  inicio: string;
  fin: string;
  lugar?: string | null;
  descripcion?: string | null;
};

/** Descarga un .ics que el celular o la compu abren con su calendario. */
export function agregarAlCalendario(evento: EventoCalendario, nombreArchivo = 'voleyapp.ics'): void {
  descargarArchivo(nombreArchivo, generarIcs(evento), 'text/calendar;charset=utf-8');
}

/** "Club Sur, Av. Mitre 123" o solo el nombre del club. */
export function lugarDelClub(club: { nombre: string; direccion?: string | null; zona?: string | null }): string {
  return [club.nombre, club.direccion, club.zona].filter((parte) => parte?.trim()).join(', ');
}
