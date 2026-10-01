import type { EstadoOperacion } from '@/api/tipos';

// Durante el piloto, reservar y sumarse a partidos depende de dos cosas que
// controla la administración: que las reservas no estén pausadas y que la
// cuenta esté habilitada. El servidor lo valida igual (exigir_puede_reservar).

export type SituacionReserva = 'lista' | 'pausada' | 'no_habilitada' | 'sin_sesion';

export function situacionReserva(estado: EstadoOperacion | undefined, conSesion: boolean): SituacionReserva | null {
  if (!estado) return null;
  if (estado.puede_reservar) return 'lista';
  if (estado.reservas_pausadas) return 'pausada';
  if (!conSesion) return 'sin_sesion';
  if (estado.requiere_lista_acceso && !estado.cuenta_habilitada) return 'no_habilitada';
  return 'pausada';
}

export type MensajeSituacion = { tono: 'info' | 'exito' | 'alerta'; titulo: string; texto: string };

export function mensajeSituacion(situacion: SituacionReserva, motivoPausa?: string | null): MensajeSituacion {
  switch (situacion) {
    case 'lista':
      return {
        tono: 'exito',
        titulo: 'Ya podés reservar',
        texto: 'Elegí una cancha, pedí el horario y el club te confirma por acá.',
      };
    case 'pausada':
      return {
        tono: 'alerta',
        titulo: 'Las reservas están pausadas por un rato',
        texto: motivoPausa?.trim()
          || 'Estamos haciendo ajustes. Mientras tanto podés mirar canchas, horarios y partidos.',
      };
    case 'no_habilitada':
      return {
        tono: 'info',
        titulo: 'Tu cuenta todavía no está habilitada para reservar',
        texto: 'Estamos en una prueba piloto con un grupo chico de jugadores. Te avisamos apenas puedas pedir canchas y sumarte a partidos. Mientras tanto, explorá todo lo que quieras.',
      };
    case 'sin_sesion':
      return {
        tono: 'info',
        titulo: 'Ingresá para reservar',
        texto: 'Con tu cuenta podés pedir canchas, organizar partidos y sumarte a los de otros.',
      };
  }
}
