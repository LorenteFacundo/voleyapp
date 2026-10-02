// Formularios de los datos del club y de sus políticas de reserva. Los campos
// se editan como texto y se convierten al formato de club_actualizar, que solo
// recibe los campos que cambiaron.

import type { CanchaGestion, ClubConfig, HorarioPublicado } from '@/api/tipos';
import { formatTelefono, normalizarTelefono } from '@/lib/telefono';

// ---------------------------------------------------------------------------
// Utilidades de texto y números
// ---------------------------------------------------------------------------

const ACENTOS: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ñ: 'n', ç: 'c',
};

/** Igual que private.slugificar: "Club Atlético Sur" → "club-atletico-sur". */
export function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[áàâäãéèêëíìîïóòôöõúùûüñç]/g, (letra) => ACENTOS[letra] ?? letra)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Recorta y colapsa espacios (como private.texto para textos de una línea). */
export function limpiarLinea(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

const formatoMonto = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/** 30000 → "30.000" (para mostrar en un campo editable). */
export function textoMonto(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '' : formatoMonto.format(Number(valor));
}

/**
 * "30.000", "$ 30000" o "30.000,50" → número. null si está vacío y NaN si no
 * se entiende (por ejemplo "30.5": en Argentina el punto separa miles).
 */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.replace(/\s/g, '').replace(/^\$/, '');
  if (!limpio) return null;
  const partes = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(limpio);
  if (!partes) return Number.NaN;
  const entero = partes[1].replace(/\./g, '');
  if (entero.length > 12) return Number.NaN;
  return Number(partes[2] ? `${entero}.${partes[2]}` : entero);
}

/** Mensaje de error de un campo de monto, o null si está bien. */
export function errorMonto(texto: string, obligatorio = true): string | null {
  const valor = parsearMonto(texto);
  if (valor === null) return obligatorio ? 'Completá el monto (0 si no corresponde).' : null;
  if (Number.isNaN(valor)) return 'Escribí solo números, por ejemplo 30.000.';
  return null;
}

// ---------------------------------------------------------------------------
// Coordenadas
// ---------------------------------------------------------------------------

/** Acepta coma o punto decimal. null si está vacío, NaN si no es un número. */
export function parsearCoordenada(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!limpio) return null;
  return /^-?\d{1,3}(\.\d+)?$/.test(limpio) ? Number(limpio) : Number.NaN;
}

/** Hasta 6 decimales (unos 10 cm): el servidor acepta como mucho 10. */
export function redondearCoordenada(valor: number): number {
  return Math.round(valor * 1e6) / 1e6;
}

/** Separa lo que se copia de Google Maps ("-34.6037, -58.3816") en latitud y longitud. */
export function separarCoordenadas(texto: string): [string, string] | null {
  const partes = /^\s*\(?\s*(-?\d{1,3}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)\s*\)?\s*$/.exec(texto);
  return partes ? [partes[1], partes[2]] : null;
}

export function enlaceGoogleMaps(latitud: number, longitud: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
}

// ---------------------------------------------------------------------------
// Datos públicos del club
// ---------------------------------------------------------------------------

export type FormClub = {
  nombre: string;
  slug: string;
  descripcion: string;
  direccion: string;
  zona: string;
  telefono: string;
  whatsapp: string;
  instagram: string;
  latitud: string;
  longitud: string;
  alias_pago: string;
  titular_pago: string;
};

export type ErroresFormulario<T> = Partial<Record<keyof T, string>>;

export function formClubDesde(club: ClubConfig): FormClub {
  return {
    nombre: club.nombre,
    slug: club.slug,
    descripcion: club.descripcion ?? '',
    direccion: club.direccion ?? '',
    zona: club.zona ?? '',
    telefono: formatTelefono(club.telefono),
    whatsapp: formatTelefono(club.whatsapp),
    instagram: club.instagram ?? '',
    latitud: club.latitud === null ? '' : String(club.latitud),
    longitud: club.longitud === null ? '' : String(club.longitud),
    alias_pago: club.alias_pago ?? '',
    titular_pago: club.titular_pago ?? '',
  };
}

/** "@club.voley", "instagram.com/club.voley/" o "club.voley" → "club.voley". */
export function normalizarInstagram(texto: string): string {
  const limpio = texto.trim();
  const desdeUrl = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i.exec(limpio);
  return (desdeUrl ? desdeUrl[1] : limpio).replace(/^@/, '');
}

/** WhatsApp normalizado, o null si no tiene código de país y área. */
export function whatsappValido(texto: string): string | null {
  const numero = normalizarTelefono(texto);
  return numero && numero.length >= 10 && numero.length <= 15 ? numero : null;
}

type ResultadoPayload<T> = { datos: Partial<ClubConfig>; errores: ErroresFormulario<T> };

function textoOpcional(valor: string): string | null {
  return limpiarLinea(valor) || null;
}

/**
 * Convierte los campos editados en lo que espera club_actualizar. Solo incluye
 * lo que realmente cambió respecto del club guardado.
 */
export function payloadClub(valores: FormClub, editados: readonly (keyof FormClub)[], club: ClubConfig): ResultadoPayload<FormClub> {
  const datos: Partial<ClubConfig> = {};
  const errores: ErroresFormulario<FormClub> = {};
  const set = <K extends keyof ClubConfig>(campo: K, valor: ClubConfig[K]) => {
    if (valor !== club[campo]) datos[campo] = valor;
  };

  for (const campo of editados) {
    const valor = valores[campo];
    switch (campo) {
      case 'nombre': {
        const nombre = limpiarLinea(valor);
        if (nombre.length < 2 || nombre.length > 120) errores.nombre = 'El nombre debe tener entre 2 y 120 caracteres.';
        else set('nombre', nombre);
        break;
      }
      case 'slug': {
        const slug = slugificar(valor);
        if (slug.length < 3 || slug.length > 60) errores.slug = 'Usá entre 3 y 60 letras o números.';
        else set('slug', slug);
        break;
      }
      case 'descripcion': {
        const descripcion = valor.trim();
        if (descripcion.length > 1000) errores.descripcion = 'La descripción no puede superar 1000 caracteres.';
        else set('descripcion', descripcion || null);
        break;
      }
      case 'direccion': {
        const direccion = textoOpcional(valor);
        if (direccion && direccion.length > 200) errores.direccion = 'La dirección no puede superar 200 caracteres.';
        else set('direccion', direccion);
        break;
      }
      case 'zona': {
        const zona = textoOpcional(valor);
        if (zona && zona.length > 80) errores.zona = 'La zona no puede superar 80 caracteres.';
        else set('zona', zona);
        break;
      }
      case 'telefono': {
        if (!valor.trim()) { set('telefono', null); break; }
        const telefono = normalizarTelefono(valor);
        if (!telefono) errores.telefono = 'Revisá el teléfono: escribilo con código de área.';
        else set('telefono', telefono);
        break;
      }
      case 'whatsapp': {
        if (!valor.trim()) { set('whatsapp', null); break; }
        const whatsapp = whatsappValido(valor);
        if (!whatsapp) errores.whatsapp = 'Escribí el WhatsApp con código de área, por ejemplo 11 2233-4455.';
        else set('whatsapp', whatsapp);
        break;
      }
      case 'instagram': {
        const usuario = normalizarInstagram(valor);
        if (usuario && !/^[A-Za-z0-9._]{1,30}$/.test(usuario)) {
          errores.instagram = 'Usá solo el usuario: letras, números, puntos y guiones bajos.';
        } else set('instagram', usuario || null);
        break;
      }
      case 'alias_pago': {
        const alias = textoOpcional(valor);
        if (alias && alias.length > 60) errores.alias_pago = 'El alias no puede superar 60 caracteres.';
        else set('alias_pago', alias);
        break;
      }
      case 'titular_pago': {
        const titular = textoOpcional(valor);
        if (titular && titular.length > 100) errores.titular_pago = 'El titular no puede superar 100 caracteres.';
        else set('titular_pago', titular);
        break;
      }
      default:
        break;
    }
  }

  // Latitud y longitud viajan siempre juntas.
  if (editados.includes('latitud') || editados.includes('longitud')) {
    const latitud = parsearCoordenada(valores.latitud);
    const longitud = parsearCoordenada(valores.longitud);
    if (latitud === null && longitud === null) {
      if (club.latitud !== null || club.longitud !== null) Object.assign(datos, { latitud: null, longitud: null });
    } else if (latitud === null || longitud === null) {
      errores[latitud === null ? 'latitud' : 'longitud'] = 'Completá latitud y longitud, o dejá las dos vacías.';
    } else if (Number.isNaN(latitud) || latitud < -90 || latitud > 90) {
      errores.latitud = 'La latitud es un número entre -90 y 90 (en Buenos Aires, alrededor de -34,6).';
    } else if (Number.isNaN(longitud) || longitud < -180 || longitud > 180) {
      errores.longitud = 'La longitud es un número entre -180 y 180 (en Buenos Aires, alrededor de -58,4).';
    } else {
      const nuevas = { latitud: redondearCoordenada(latitud), longitud: redondearCoordenada(longitud) };
      if (nuevas.latitud !== club.latitud || nuevas.longitud !== club.longitud) Object.assign(datos, nuevas);
    }
  }
  return { datos, errores };
}

/** Campo al que corresponde un error de validación de club_actualizar (para marcarlo en el formulario). */
export function campoDelError(mensaje: string): keyof FormClub | null {
  if (/direcci[oó]n p[uú]blica/i.test(mensaje)) return 'slug';
  if (/whatsapp/i.test(mensaje)) return 'whatsapp';
  if (/instagram/i.test(mensaje)) return 'instagram';
  if (/coordenadas/i.test(mensaje)) return 'latitud';
  if (/^el nombre/i.test(mensaje)) return 'nombre';
  if (/^la descripci[oó]n/i.test(mensaje)) return 'descripcion';
  if (/^la direcci[oó]n/i.test(mensaje)) return 'direccion';
  if (/^la zona/i.test(mensaje)) return 'zona';
  if (/^el alias/i.test(mensaje)) return 'alias_pago';
  if (/^el titular/i.test(mensaje)) return 'titular_pago';
  return null;
}

// ---------------------------------------------------------------------------
// Reservas y políticas
// ---------------------------------------------------------------------------

export type FormReservas = {
  confirmacion_automatica: boolean;
  anticipacion_minima_min: number;
  ventana_reserva_dias: number;
  cancelacion_horas: number;
  respuesta_horas: number;
  politicas: string;
};

export function formReservasDesde(club: ClubConfig): FormReservas {
  return {
    confirmacion_automatica: club.confirmacion_automatica,
    anticipacion_minima_min: club.anticipacion_minima_min,
    ventana_reserva_dias: club.ventana_reserva_dias,
    cancelacion_horas: club.cancelacion_horas,
    respuesta_horas: club.respuesta_horas,
    politicas: club.politicas ?? '',
  };
}

export function payloadReservas(
  valores: FormReservas, editados: readonly (keyof FormReservas)[], club: ClubConfig,
): ResultadoPayload<FormReservas> {
  const datos: Partial<ClubConfig> = {};
  const errores: ErroresFormulario<FormReservas> = {};
  for (const campo of editados) {
    if (campo === 'politicas') {
      const politicas = valores.politicas.trim();
      if (politicas.length > 1500) errores.politicas = 'Las políticas no pueden superar 1500 caracteres.';
      else if ((politicas || null) !== club.politicas) datos.politicas = politicas || null;
    } else if (valores[campo] !== club[campo]) {
      Object.assign(datos, { [campo]: valores[campo] });
    }
  }
  return { datos, errores };
}

export type Opcion = { valor: number; etiqueta: string };

function horas(cantidad: number): string {
  return cantidad === 1 ? '1 hora' : `${cantidad} horas`;
}

function minutosLegibles(minutos: number): string {
  if (minutos === 0) return 'Sin mínimo';
  if (minutos < 60) return `${minutos} minutos`;
  if (minutos % 1440 === 0 && minutos > 1440) return `${minutos / 1440} días`;
  return minutos % 60 === 0 ? horas(minutos / 60) : `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

export const OPCIONES_ANTICIPACION: Opcion[] = [0, 30, 60, 120, 180, 360, 720, 1440]
  .map((valor) => ({ valor, etiqueta: minutosLegibles(valor) }));

export const OPCIONES_VENTANA: Opcion[] = [7, 14, 21, 30, 45, 60].map((valor) => ({
  valor,
  etiqueta: valor % 7 === 0 && valor <= 21 ? `${valor} días (${valor / 7} semana${valor > 7 ? 's' : ''})` : `${valor} días`,
}));

export const OPCIONES_CANCELACION: Opcion[] = [0, 2, 6, 12, 24, 48].map((valor) => ({
  valor,
  etiqueta: valor === 0 ? 'Hasta que empieza el turno' : `Hasta ${horas(valor)} antes`,
}));

export const OPCIONES_RESPUESTA: Opcion[] = [1, 2, 4, 6, 12, 24].map((valor) => ({ valor, etiqueta: horas(valor) }));

/** Agrega el valor guardado si no está entre las opciones (por ejemplo, uno cargado antes). */
export function opcionesConActual(opciones: Opcion[], actual: number, formatear: (valor: number) => string): Opcion[] {
  if (opciones.some((opcion) => opcion.valor === actual)) return opciones;
  return [...opciones, { valor: actual, etiqueta: formatear(actual) }].sort((a, b) => a.valor - b.valor);
}

export const etiquetaAnticipacion = minutosLegibles;
export const etiquetaVentana = (dias: number) => `${dias} días`;
export const etiquetaCancelacion = (valor: number) => (valor === 0 ? 'Hasta que empieza el turno' : `Hasta ${horas(valor)} antes`);
export const etiquetaRespuesta = horas;

// ---------------------------------------------------------------------------
// Publicación
// ---------------------------------------------------------------------------

export type ItemPublicacion = {
  id: 'cancha' | 'horarios' | 'whatsapp' | 'alias';
  texto: string;
  listo: boolean;
  requerido: boolean;
};

/** Lo que conviene tener antes de mostrar el club (los dos primeros los exige el servidor). */
export function checklistPublicacion(
  club: ClubConfig, canchas: readonly CanchaGestion[], horarios: readonly HorarioPublicado[],
): ItemPublicacion[] {
  const activas = new Set(canchas.filter((cancha) => cancha.activa).map((cancha) => cancha.id));
  return [
    { id: 'cancha', texto: 'Al menos una cancha activa', listo: activas.size > 0, requerido: true },
    {
      id: 'horarios',
      texto: 'Horarios publicados en una cancha activa',
      listo: horarios.some((horario) => horario.activo && activas.has(horario.cancha_id)),
      requerido: true,
    },
    { id: 'whatsapp', texto: 'WhatsApp del club para que te escriban', listo: !!club.whatsapp, requerido: false },
    { id: 'alias', texto: 'Alias para que te paguen la seña', listo: !!club.alias_pago, requerido: false },
  ];
}
