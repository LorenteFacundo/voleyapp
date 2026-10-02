// Formulario de canchas y reglas de las fotos (las mismas que el bucket
// canchas-fotos: JPG, PNG o WEBP de hasta 5 MB, como mucho 8 por cancha).

import type { DatosCancha } from '@/api/club';
import type { CanchaGestion, Superficie } from '@/api/tipos';
import { errorMonto, limpiarLinea, parsearMonto, textoMonto, type ErroresFormulario } from './club';

export const SUPERFICIES: { valor: Superficie; etiqueta: string }[] = [
  { valor: 'parquet', etiqueta: 'Parquet' },
  { valor: 'sintetico', etiqueta: 'Sintético' },
  { valor: 'cemento', etiqueta: 'Cemento' },
  { valor: 'arena', etiqueta: 'Arena' },
  { valor: 'otro', etiqueta: 'Otra' },
];

export function etiquetaSuperficie(superficie: Superficie | null): string | null {
  return SUPERFICIES.find((opcion) => opcion.valor === superficie)?.etiqueta ?? null;
}

export const MAXIMO_FOTOS = 8;
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;

/** Error para mostrar si el archivo no se puede subir, o null. */
export function errorArchivoFoto(archivo: { name: string; type: string; size: number }): string | null {
  if (!(TIPOS_FOTO as readonly string[]).includes(archivo.type)) {
    return `"${archivo.name}" no es una foto JPG, PNG o WEBP.`;
  }
  if (archivo.size > TAMANO_MAXIMO_FOTO) return `"${archivo.name}" pesa más de 5 MB.`;
  return null;
}

/** Mueve una foto un lugar a la izquierda (-1) o a la derecha (1). */
export function moverFoto(fotos: readonly string[], indice: number, paso: -1 | 1): string[] {
  const destino = indice + paso;
  if (indice < 0 || indice >= fotos.length || destino < 0 || destino >= fotos.length) return [...fotos];
  const resultado = [...fotos];
  [resultado[indice], resultado[destino]] = [resultado[destino], resultado[indice]];
  return resultado;
}

export type FormCancha = {
  titulo: string;
  descripcion: string;
  precio: string;
  sena: string;
  techada: boolean;
  superficie: Superficie | '';
  activa: boolean;
  orden: string;
};

export function siguienteOrden(canchas: readonly CanchaGestion[]): number {
  return canchas.reduce((mayor, cancha) => Math.max(mayor, cancha.orden), 0) + 1;
}

export function formCanchaDesde(cancha: CanchaGestion | null, ordenNueva: number): FormCancha {
  return {
    titulo: cancha?.titulo ?? '',
    descripcion: cancha?.descripcion ?? '',
    precio: cancha ? textoMonto(cancha.precio_total) : '',
    sena: cancha ? textoMonto(cancha.precio_sena) : '',
    techada: cancha?.techada ?? true,
    superficie: cancha?.superficie ?? '',
    activa: cancha?.activa ?? true,
    orden: String(cancha?.orden ?? ordenNueva),
  };
}

type DatosFormCancha = Omit<DatosCancha, 'clubId' | 'id' | 'fotos'>;

export function validarCancha(form: FormCancha): { errores: ErroresFormulario<FormCancha>; datos: DatosFormCancha | null } {
  const errores: ErroresFormulario<FormCancha> = {};
  const titulo = limpiarLinea(form.titulo);
  if (titulo.length < 2 || titulo.length > 80) errores.titulo = 'El nombre debe tener entre 2 y 80 caracteres.';
  const descripcion = form.descripcion.trim();
  if (descripcion.length > 1000) errores.descripcion = 'La descripción no puede superar 1000 caracteres.';

  const errorPrecio = errorMonto(form.precio);
  const errorSena = errorMonto(form.sena, false);
  if (errorPrecio) errores.precio = errorPrecio;
  if (errorSena) errores.sena = errorSena;
  const precio = parsearMonto(form.precio) ?? 0;
  const sena = parsearMonto(form.sena) ?? 0;
  if (!errorPrecio && !errorSena && sena > precio) errores.sena = 'La seña no puede superar el precio.';

  const orden = Number(form.orden);
  if (!form.orden.trim() || !Number.isInteger(orden) || orden < 0 || orden > 999) {
    errores.orden = 'Usá un número entero entre 0 y 999.';
  }

  if (Object.keys(errores).length) return { errores, datos: null };
  return {
    errores,
    datos: {
      titulo,
      descripcion: descripcion || null,
      precioTotal: precio,
      precioSena: sena,
      techada: form.techada,
      superficie: form.superficie || null,
      activa: form.activa,
      orden,
    },
  };
}
