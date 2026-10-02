// Números de teléfono argentinos en formato internacional para WhatsApp
// (54 9 + código de área + número, sin el 0 ni el 15).

const SOLO_DIGITOS = /\D/g;

/** Quita el "15" de celulares escritos al estilo local (011 15 1234-5678). */
function quitarQuince(digitos: string): string {
  if (digitos.length !== 12) return digitos;
  for (const largoArea of [2, 3, 4]) {
    if (digitos.slice(largoArea, largoArea + 2) === '15') {
      return digitos.slice(0, largoArea) + digitos.slice(largoArea + 2);
    }
  }
  return digitos;
}

/**
 * Normaliza lo que la gente escribe ("11 2233-4455", "011 15 2233 4455",
 * "+54 9 11 2233 4455") a dígitos internacionales. Devuelve null si no se
 * puede interpretar.
 */
export function normalizarTelefono(entrada: string | null | undefined): string | null {
  let digitos = (entrada ?? '').replace(SOLO_DIGITOS, '');
  if (!digitos) return null;
  const internacional = (entrada ?? '').trim().startsWith('+') || digitos.startsWith('54');

  if (internacional && digitos.startsWith('54')) {
    let resto = digitos.slice(2);
    if (resto.startsWith('9')) resto = resto.slice(1);
    if (resto.startsWith('0')) resto = resto.slice(1);
    resto = quitarQuince(resto);
    return resto.length === 10 ? `549${resto}` : digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
  }
  if (internacional) return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;

  if (digitos.startsWith('0')) digitos = digitos.slice(1);
  digitos = quitarQuince(digitos);
  if (digitos.length === 10) return `549${digitos}`;
  // Número local de AMBA sin característica (8 dígitos): se asume 11.
  if (digitos.length === 8) return `54911${digitos}`;
  return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
}

/** "+54 9 11 2233-4455" para mostrar. */
export function formatTelefono(numero: string | null | undefined): string {
  if (!numero) return '';
  if (/^549\d{10}$/.test(numero)) {
    const area = numero.slice(3, 5) === '11' ? numero.slice(3, 5) : numero.slice(3, 6);
    const resto = numero.slice(3 + area.length);
    const corte = resto.length - 4;
    return `+54 9 ${area} ${resto.slice(0, corte)}-${resto.slice(corte)}`;
  }
  return `+${numero}`;
}

export function enlaceWhatsApp(numero: string, mensaje?: string): string {
  const base = `https://wa.me/${numero.replace(SOLO_DIGITOS, '')}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

/** Enlace para compartir un texto por WhatsApp sin destinatario fijo. */
export function enlaceCompartirWhatsApp(mensaje: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}
