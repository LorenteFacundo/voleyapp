import type { adminApi } from '@/api/admin';
import { normalizarTelefono } from '@/lib/telefono';
import { limpiarLinea, parsearCoordenada, redondearCoordenada, whatsappValido, type ErroresFormulario } from '@/features/ajustes/club';

export type FormNuevoClub = {
  nombre: string;
  zona: string;
  direccion: string;
  latitud: string;
  longitud: string;
  telefono: string;
  whatsapp: string;
};

export type DatosNuevoClub = Parameters<typeof adminApi.crearClub>[0];

export const FORM_NUEVO_CLUB_VACIO: FormNuevoClub = {
  nombre: '', zona: '', direccion: '', latitud: '', longitud: '', telefono: '', whatsapp: '',
};

/** Valida el alta de un club y lo convierte a lo que espera admin_crear_club. */
export function validarNuevoClub(form: FormNuevoClub): { errores: ErroresFormulario<FormNuevoClub>; datos: DatosNuevoClub | null } {
  const errores: ErroresFormulario<FormNuevoClub> = {};
  const nombre = limpiarLinea(form.nombre);
  if (nombre.length < 2 || nombre.length > 120) errores.nombre = 'El nombre debe tener entre 2 y 120 caracteres.';
  const zona = limpiarLinea(form.zona);
  if (zona.length > 80) errores.zona = 'La zona no puede superar 80 caracteres.';
  const direccion = limpiarLinea(form.direccion);
  if (direccion.length > 200) errores.direccion = 'La dirección no puede superar 200 caracteres.';

  const latitud = parsearCoordenada(form.latitud);
  const longitud = parsearCoordenada(form.longitud);
  if ((latitud === null) !== (longitud === null)) {
    errores[latitud === null ? 'latitud' : 'longitud'] = 'Completá latitud y longitud, o dejá las dos vacías.';
  } else if (latitud !== null && (Number.isNaN(latitud) || latitud < -90 || latitud > 90)) {
    errores.latitud = 'La latitud es un número entre -90 y 90.';
  } else if (longitud !== null && (Number.isNaN(longitud) || longitud < -180 || longitud > 180)) {
    errores.longitud = 'La longitud es un número entre -180 y 180.';
  }

  const telefono = form.telefono.trim() ? normalizarTelefono(form.telefono) : null;
  if (form.telefono.trim() && !telefono) errores.telefono = 'Revisá el teléfono: escribilo con código de área.';
  const whatsapp = form.whatsapp.trim() ? whatsappValido(form.whatsapp) : null;
  if (form.whatsapp.trim() && !whatsapp) errores.whatsapp = 'Escribí el WhatsApp con código de área, por ejemplo 11 2233-4455.';

  if (Object.keys(errores).length) return { errores, datos: null };
  return {
    errores,
    datos: {
      nombre,
      zona: zona || null,
      direccion: direccion || null,
      latitud: latitud === null ? null : redondearCoordenada(latitud),
      longitud: longitud === null ? null : redondearCoordenada(longitud),
      telefono,
      whatsapp,
    },
  };
}
