// Exportar e importar clientes en planillas (CSV compatible con Excel).

import type { Cliente, ClienteListado } from '@/api/tipos';
import { parsearCsv } from '@/lib/archivos';
import { formatTelefono } from '@/lib/telefono';
import { instanteParaPlanilla } from '@/lib/archivos';
import {
  MAX_FILAS_IMPORTACION, lectorDeFila, mapaPosicional, mapearEncabezado,
} from './importacion';
import { normalizarClave, validarDatosCliente, type DatosCliente } from './validacion';

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

export const COLUMNAS_EXPORTACION = ['nombre', 'telefono', 'email', 'saldo', 'reservas', 'ultima', 'proxima'];

/** "54 9 11 2233-4455": texto para Excel (no lo convierte en número) y se vuelve a importar bien. */
export function telefonoParaPlanilla(telefono: string | null | undefined): string {
  return formatTelefono(telefono).replace(/^\+/, '');
}

export function filasExportacionClientes(clientes: ClienteListado[]): unknown[][] {
  return clientes.map((cliente) => [
    cliente.nombre,
    telefonoParaPlanilla(cliente.telefono),
    cliente.email ?? '',
    Number(cliente.saldo),
    Number(cliente.reservas),
    instanteParaPlanilla(cliente.ultima),
    instanteParaPlanilla(cliente.proxima),
  ]);
}

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

export const COLUMNAS_PLANTILLA_CLIENTES = ['nombre', 'telefono', 'email', 'notas'] as const;
type Columna = (typeof COLUMNAS_PLANTILLA_CLIENTES)[number];

const ALIAS: Record<Columna, string[]> = {
  nombre: ['nombre', 'cliente', 'name', 'nombreyapellido', 'apellidoynombre', 'nombrecompleto'],
  telefono: ['telefono', 'tel', 'celular', 'cel', 'whatsapp', 'movil', 'phone'],
  email: ['email', 'mail', 'correo', 'correoelectronico'],
  notas: ['notas', 'nota', 'observaciones', 'obs', 'comentarios'],
};

export type ClienteExistente = Pick<Cliente, 'id' | 'nombre' | 'telefono' | 'archivado'>;

export type FilaCliente = {
  /** Número de fila en la planilla (la 1 es el encabezado, si lo hay). */
  fila: number;
  original: { nombre: string; telefono: string; email: string };
  datos: DatosCliente | null;
  estado: 'valida' | 'error' | 'repetida';
  errores: string[];
  /** Por qué se omite una fila repetida. */
  motivo: string | null;
};

export type AnalisisClientes = { filas: FilaCliente[]; error: string | null };

/** Clave para detectar repetidos: el teléfono o, si no hay, el nombre. */
export function claveCliente(datos: Pick<DatosCliente, 'nombre' | 'telefono'>): string {
  return datos.telefono ? `t:${datos.telefono}` : `n:${normalizarClave(datos.nombre)}`;
}

/** Busca un cliente ya cargado con el mismo teléfono (o el mismo nombre si la fila no trae teléfono). */
export function buscarExistente(
  datos: Pick<DatosCliente, 'nombre' | 'telefono'>, existentes: ClienteExistente[],
): ClienteExistente | null {
  if (datos.telefono) return existentes.find((cliente) => cliente.telefono === datos.telefono) ?? null;
  const clave = normalizarClave(datos.nombre);
  return existentes.find((cliente) => normalizarClave(cliente.nombre) === clave) ?? null;
}

export function analizarCsvClientes(texto: string, existentes: ClienteExistente[]): AnalisisClientes {
  const filas = parsearCsv(texto);
  if (!filas.length) return { filas: [], error: 'El archivo está vacío.' };

  const encabezado = mapearEncabezado(filas[0], ALIAS);
  if (encabezado && encabezado.nombre === undefined) {
    return { filas: [], error: 'No encontramos la columna «nombre». Usá la plantilla como guía.' };
  }
  const mapa = encabezado ?? mapaPosicional(COLUMNAS_PLANTILLA_CLIENTES);
  const datos = encabezado ? filas.slice(1) : filas;
  const primeraFila = encabezado ? 2 : 1;
  if (!datos.length) return { filas: [], error: 'La planilla no tiene clientes debajo del encabezado.' };
  if (datos.length > MAX_FILAS_IMPORTACION) {
    return { filas: [], error: `La planilla tiene más de ${MAX_FILAS_IMPORTACION} filas. Dividila en partes más chicas.` };
  }

  const vistas = new Map<string, number>();
  return {
    error: null,
    filas: datos.map((celdas, indice): FilaCliente => {
      const leer = lectorDeFila(celdas, mapa);
      const fila = primeraFila + indice;
      const original = { nombre: leer('nombre'), telefono: leer('telefono'), email: leer('email') };
      const { datos: validos, errores } = validarDatosCliente({ ...original, notas: leer('notas') });
      if (!validos) {
        return { fila, original, datos: null, estado: 'error', errores: Object.values(errores), motivo: null };
      }
      const clave = claveCliente(validos);
      const previa = vistas.get(clave);
      if (previa !== undefined) {
        return { fila, original, datos: validos, estado: 'repetida', errores: [], motivo: `Repetido en la fila ${previa}.` };
      }
      vistas.set(clave, fila);
      const existente = buscarExistente(validos, existentes);
      if (existente) {
        const motivo = `Ya está en tus clientes como «${existente.nombre}»${existente.archivado ? ' (archivado)' : ''}.`;
        return { fila, original, datos: validos, estado: 'repetida', errores: [], motivo };
      }
      return { fila, original, datos: validos, estado: 'valida', errores: [], motivo: null };
    }),
  };
}
