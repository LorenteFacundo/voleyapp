// Piezas comunes para importar planillas: lectura del archivo (UTF-8 o el
// "CSV" de Excel en Windows, que usa windows-1252), mapeo de columnas por
// encabezado y procesamiento fila por fila.

import { normalizarClave } from './validacion';

/** Máximo de filas por archivo: más que eso conviene dividirlo. */
export const MAX_FILAS_IMPORTACION = 1000;

export function decodificarCsv(bytes: ArrayBuffer | Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder('windows-1252').decode(bytes);
  }
  // Excel a veces agrega "sep=;" como primera línea.
  return texto.replace(/^\ufeff/, '').replace(/^sep=.\r?\n/i, '');
}

export async function leerArchivoCsv(archivo: Blob): Promise<string> {
  return decodificarCsv(await archivo.arrayBuffer());
}

/** "Teléfono (celular)" → "telefonocelular". */
export function normalizarEncabezado(texto: string): string {
  return normalizarClave(texto).replace(/[^a-z0-9]/g, '');
}

/**
 * Busca cada columna por sus nombres posibles. Devuelve null si la primera
 * fila no parece un encabezado (ninguna celda coincide).
 */
export function mapearEncabezado<C extends string>(
  fila: string[], alias: Record<C, string[]>,
): Partial<Record<C, number>> | null {
  const normalizada = fila.map(normalizarEncabezado);
  const mapa: Partial<Record<C, number>> = {};
  let encontradas = 0;
  for (const columna of Object.keys(alias) as C[]) {
    const indice = normalizada.findIndex((celda) => alias[columna].includes(celda));
    if (indice >= 0) {
      mapa[columna] = indice;
      encontradas += 1;
    }
  }
  return encontradas > 0 ? mapa : null;
}

/** Columnas en el orden de la plantilla, para archivos sin encabezado. */
export function mapaPosicional<C extends string>(columnas: readonly C[]): Partial<Record<C, number>> {
  return Object.fromEntries(columnas.map((columna, indice) => [columna, indice])) as Partial<Record<C, number>>;
}

export function lectorDeFila<C extends string>(fila: string[], mapa: Partial<Record<C, number>>) {
  return (columna: C): string => {
    const indice = mapa[columna];
    return indice === undefined ? '' : (fila[indice] ?? '').trim();
  };
}

export type ResultadoTarea<T, R> =
  | { item: T; estado: 'ok'; valor: R }
  | { item: T; estado: 'error'; error: string }
  | { item: T; estado: 'detenido' };

/**
 * Procesa los elementos de a uno (sin saturar el servidor ni mezclar
 * errores) y sigue aunque alguno falle. Se puede detener entre filas.
 */
export async function procesarEnSerie<T, R>(
  items: readonly T[],
  tarea: (item: T, indice: number) => Promise<R>,
  opciones: {
    describirError: (error: unknown) => string;
    alAvanzar?: (hechos: number) => void;
    detener?: () => boolean;
  },
): Promise<ResultadoTarea<T, R>[]> {
  const resultados: ResultadoTarea<T, R>[] = [];
  for (let indice = 0; indice < items.length; indice += 1) {
    const item = items[indice];
    if (opciones.detener?.()) {
      resultados.push({ item, estado: 'detenido' });
      continue;
    }
    try {
      resultados.push({ item, estado: 'ok', valor: await tarea(item, indice) });
    } catch (error) {
      resultados.push({ item, estado: 'error', error: opciones.describirError(error) });
    }
    opciones.alAvanzar?.(indice + 1);
  }
  return resultados;
}
