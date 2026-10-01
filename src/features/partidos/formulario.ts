import type { ConfigPartido, Superficie } from '@/api/tipos';
import type { NivelPartido } from '@/lib/nivel';
import { precioSugerido } from './cupo';

// Formulario para organizar o editar un partido. Las reglas replican las del
// servidor (solicitar_reserva y partido_actualizar) para avisar antes.

export const CUPO_MINIMO = 2;
export const CUPO_MAXIMO = 22;
export const MAX_DESCRIPCION = 500;

export type FormularioPartido = {
  cupoMinimo: number;
  cupoMaximo: number;
  invitados: number;
  nivel: NivelPartido;
  visibilidad: 'publico' | 'enlace';
  requiereAprobacion: boolean;
  descripcion: string;
  /** Texto del precio por jugador; null mientras se use el sugerido. */
  precio: string | null;
};

export type ErroresPartido = Partial<Record<'cupo' | 'invitados' | 'descripcion' | 'precio', string>>;

/** Valores iniciales: 5 vs 5 a 6 vs 6 en cancha; 2 vs 2 a 4 vs 4 en arena. */
export function formularioPartidoInicial(superficie?: Superficie | null): FormularioPartido {
  const arena = superficie === 'arena';
  return {
    cupoMinimo: arena ? 4 : 10,
    cupoMaximo: arena ? 8 : 12,
    invitados: 0,
    nivel: 'recreativo',
    visibilidad: 'publico',
    requiereAprobacion: false,
    descripcion: '',
    precio: null,
  };
}

export function formularioDesdePartido(partido: {
  cupo_minimo: number; cupo_maximo: number; invitados: number; nivel_requerido: NivelPartido;
  visibilidad: 'publico' | 'enlace' | 'privado'; requiere_aprobacion: boolean; descripcion: string | null;
  precio_por_jugador: number | null;
}): FormularioPartido {
  return {
    cupoMinimo: partido.cupo_minimo,
    cupoMaximo: partido.cupo_maximo,
    invitados: partido.invitados,
    nivel: partido.nivel_requerido,
    visibilidad: partido.visibilidad === 'publico' ? 'publico' : 'enlace',
    requiereAprobacion: partido.requiere_aprobacion,
    descripcion: partido.descripcion ?? '',
    precio: partido.precio_por_jugador != null ? String(Number(partido.precio_por_jugador)) : null,
  };
}

/** Lo que se muestra en el campo de precio: lo escrito o la sugerencia. */
export function textoPrecio(formulario: FormularioPartido, precioTotal: number): string {
  return formulario.precio ?? String(precioSugerido(precioTotal, formulario.cupoMaximo));
}

const MONTO = /^\d{1,9}(?:[.,]\d{1,2})?$/;

/** "1.800" o "1800,5" → número; '' → null; inválido → NaN. */
export function leerMonto(texto: string): number | null {
  const limpio = texto.trim().replace(/\$/g, '').replace(/\s/g, '');
  if (!limpio) return null;
  // Separador de miles con punto: "1.800" o "12.500".
  const sinMiles = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(limpio) ? limpio.replace(/\./g, '') : limpio;
  return MONTO.test(sinMiles) ? Number(sinMiles.replace(',', '.')) : Number.NaN;
}

/**
 * Valida y arma la configuración que espera la API.
 * `anotados`: personas con cuenta ya anotadas (al crear, solo quien organiza).
 */
export function validarFormularioPartido(
  formulario: FormularioPartido,
  opciones: { precioTotal: number; anotados?: number },
): { errores: ErroresPartido; config: ConfigPartido | null } {
  const errores: ErroresPartido = {};
  const { cupoMinimo, cupoMaximo, invitados } = formulario;
  const anotados = opciones.anotados ?? 1;

  if (![cupoMinimo, cupoMaximo, invitados].every(Number.isInteger)
    || cupoMinimo < CUPO_MINIMO || cupoMaximo > CUPO_MAXIMO || cupoMaximo < cupoMinimo) {
    errores.cupo = 'El cupo debe ser de 2 a 22 jugadores y el máximo no puede ser menor al mínimo.';
  } else if (invitados < 0 || invitados >= cupoMaximo) {
    errores.invitados = 'Los invitados deben ser menos que el cupo máximo.';
  } else if (anotados + invitados > cupoMaximo) {
    errores.cupo = `Ya hay ${anotados + invitados} lugares ocupados: el cupo máximo no puede ser menor.`;
  }

  const descripcion = formulario.descripcion.trim();
  if (descripcion.length > MAX_DESCRIPCION) {
    errores.descripcion = `La descripción no puede superar ${MAX_DESCRIPCION} caracteres.`;
  }

  const precio = leerMonto(textoPrecio(formulario, opciones.precioTotal));
  if (precio != null && (Number.isNaN(precio) || precio < 0)) {
    errores.precio = 'Escribí el precio solo con números, por ejemplo 2500.';
  }

  if (Object.keys(errores).length) return { errores, config: null };
  return {
    errores,
    config: {
      cupo_minimo: cupoMinimo,
      cupo_maximo: cupoMaximo,
      invitados,
      nivel_requerido: formulario.nivel,
      visibilidad: formulario.visibilidad,
      requiere_aprobacion: formulario.requiereAprobacion,
      descripcion: descripcion || null,
      precio_por_jugador: precio,
    },
  };
}
