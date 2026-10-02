import type { ClubPublico, Superficie } from '@/api/tipos';
import { formatDuracion } from '@/lib/date';
import { pluralizar } from '@/lib/format';

const ETIQUETAS_SUPERFICIE: Record<Superficie, string> = {
  parquet: 'Parquet',
  sintetico: 'Sintético',
  cemento: 'Cemento',
  arena: 'Arena',
  otro: 'Otra superficie',
};

export function etiquetaSuperficie(superficie: Superficie | null | undefined): string | null {
  return superficie ? ETIQUETAS_SUPERFICIE[superficie] ?? null : null;
}

type ReglasClub = Pick<ClubPublico,
  'confirmacion_automatica' | 'respuesta_horas' | 'cancelacion_horas' | 'anticipacion_minima_min' | 'ventana_reserva_dias'>;

/** Reglas del club en frases cortas para la ficha. */
export function politicasClub(club: ReglasClub): string[] {
  const reglas: string[] = [];
  reglas.push(club.confirmacion_automatica
    ? 'Confirmación inmediata: tu reserva queda confirmada al pedirla.'
    : `El club responde tu pedido en hasta ${pluralizar(club.respuesta_horas, 'hora')}.`);
  reglas.push(club.cancelacion_horas > 0
    ? `Podés cancelar desde la app hasta ${pluralizar(club.cancelacion_horas, 'hora')} antes del turno.`
    : 'Podés cancelar desde la app hasta que empiece el turno.');
  if (club.anticipacion_minima_min > 0) {
    reglas.push(`Los pedidos se hacen con al menos ${formatDuracion(club.anticipacion_minima_min)} de anticipación.`);
  }
  reglas.push(club.ventana_reserva_dias > 0
    ? `Recibe pedidos con hasta ${pluralizar(club.ventana_reserva_dias, 'día')} de anticipación.`
    : 'Recibe pedidos solo para el día.');
  return reglas;
}

const USUARIO_INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;

/** Usuario de Instagram ("@club") a partir de lo que cargó el club (usuario o enlace). */
export function usuarioInstagram(valor: string | null | undefined): string | null {
  let texto = (valor ?? '').trim();
  if (!texto) return null;
  const enlace = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i.exec(texto);
  if (enlace) texto = enlace[1];
  else if (/^https?:\/\//i.test(texto)) return null;
  texto = texto.replace(/^@/, '').replace(/\/$/, '');
  return USUARIO_INSTAGRAM.test(texto) ? texto : null;
}

export function enlaceInstagram(valor: string | null | undefined): string | null {
  const usuario = usuarioInstagram(valor);
  return usuario ? `https://www.instagram.com/${usuario}/` : null;
}

/** Enlace tel: para llamar (los números guardados en formato internacional llevan +). */
export function enlaceTelefono(numero: string | null | undefined): string | null {
  const digitos = (numero ?? '').replace(/\D/g, '');
  if (digitos.length < 6) return null;
  return digitos.startsWith('54') && digitos.length >= 12 ? `tel:+${digitos}` : `tel:${digitos}`;
}
