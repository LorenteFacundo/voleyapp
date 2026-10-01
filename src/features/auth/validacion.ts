import { normalizarTelefono } from '@/lib/telefono';
import { rutaInternaSegura } from '@/lib/navigation';

// Validaciones del lado del cliente para dar feedback rápido. El servidor
// vuelve a validar todo (nombre, teléfono y nivel en actualizar_mi_perfil).

export const MIN_CLAVE = 8;
export const MIN_NOMBRE = 2;
export const MAX_NOMBRE = 80;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validarNombre(nombre: string): string | null {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (!limpio) return 'Escribí tu nombre.';
  if (limpio.length < MIN_NOMBRE) return `El nombre debe tener al menos ${MIN_NOMBRE} letras.`;
  if (limpio.length > MAX_NOMBRE) return `El nombre no puede superar ${MAX_NOMBRE} caracteres.`;
  return null;
}

export function validarEmail(email: string): string | null {
  const limpio = email.trim();
  if (!limpio) return 'Escribí tu email.';
  if (!EMAIL.test(limpio) || limpio.length > 254) return 'Revisá el email: parece que tiene un error.';
  return null;
}

export function validarClave(clave: string): string | null {
  if (!clave) return 'Escribí una contraseña.';
  if (clave.length < MIN_CLAVE) return `La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`;
  return null;
}

export function validarRepeticion(clave: string, repetida: string): string | null {
  if (!repetida) return 'Repetí la contraseña.';
  return clave === repetida ? null : 'Las contraseñas no coinciden.';
}

/**
 * Teléfono opcional: vacío es válido (null); si se escribió algo, tiene que
 * poder normalizarse para WhatsApp.
 */
export function validarTelefonoOpcional(telefono: string): { valor: string | null; error: string | null } {
  if (!telefono.trim()) return { valor: null, error: null };
  const normalizado = normalizarTelefono(telefono);
  return normalizado
    ? { valor: normalizado, error: null }
    : { valor: null, error: 'Revisá el número. Escribilo con característica, por ejemplo 11 2233-4455.' };
}

/** Nombre prolijo para enviar: sin espacios de más. */
export function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

/**
 * Adónde ir después de iniciar sesión: la ruta pedida en ?siguiente=, la que
 * se recordó antes de ir a ingresar, o el inicio. Nunca vuelve a /ingresar.
 */
export function destinoTrasIngreso(siguiente: string | null, recordada: () => string | null): string {
  const pedida = rutaInternaSegura(siguiente);
  if (pedida && !pedida.startsWith('/ingresar')) return pedida;
  const guardada = rutaInternaSegura(recordada());
  if (guardada && !guardada.startsWith('/ingresar')) return guardada;
  return '/app';
}
