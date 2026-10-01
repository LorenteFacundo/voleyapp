// Validación de los datos de un cliente, con las mismas reglas que aplica
// el servidor (club_guardar_cliente), para avisar antes de enviar.

import { normalizarTelefono } from '@/lib/telefono';

export type CampoCliente = 'nombre' | 'telefono' | 'email' | 'notas';
export type ErroresCliente = Partial<Record<CampoCliente, string>>;

export type DatosCliente = {
  nombre: string;
  telefono: string | null;
  email: string | null;
  notas: string | null;
};

export const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Recorta y colapsa espacios, como private.texto() en el servidor. */
export function limpiarTexto(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\s+/g, ' ').trim();
}

/** Clave para comparar nombres: sin acentos, minúsculas y espacios simples. */
export function normalizarClave(texto: string | null | undefined): string {
  return limpiarTexto(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function validarDatosCliente(entrada: {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  notas?: string | null;
}): { datos: DatosCliente | null; errores: ErroresCliente } {
  const errores: ErroresCliente = {};

  const nombre = limpiarTexto(entrada.nombre);
  if (!nombre) errores.nombre = 'Ingresá el nombre.';
  else if (nombre.length < 2) errores.nombre = 'El nombre debe tener al menos 2 caracteres.';
  else if (nombre.length > 120) errores.nombre = 'El nombre no puede superar los 120 caracteres.';

  const telefonoEscrito = (entrada.telefono ?? '').trim();
  const telefono = telefonoEscrito ? normalizarTelefono(telefonoEscrito) : null;
  if (telefonoEscrito && !telefono) {
    errores.telefono = 'Revisá el teléfono: escribilo con la característica, por ejemplo 11 2233-4455.';
  }

  const email = (entrada.email ?? '').trim().toLowerCase();
  if (email && (!EMAIL_VALIDO.test(email) || email.length > 254)) errores.email = 'El email no es válido.';

  const notas = (entrada.notas ?? '').trim();
  if (notas.length > 1000) errores.notas = 'Las notas no pueden superar los 1000 caracteres.';

  const valido = Object.keys(errores).length === 0;
  return {
    errores,
    datos: valido ? { nombre, telefono, email: email || null, notas: notas || null } : null,
  };
}
