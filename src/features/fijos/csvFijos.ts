// Importación de alquileres fijos desde una planilla (CSV de Excel).
// Cada fila se valida antes de enviar nada al servidor.

import type { CanchaGestion, Cliente, HorarioPublicado, Serie } from '@/api/tipos';
import { parsearCsv } from '@/lib/archivos';
import { esFechaISO, horaAMinutos } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { normalizarTelefono } from '@/lib/telefono';
import { parsearMonto } from '@/features/caja/montos';
import {
  MAX_FILAS_IMPORTACION, lectorDeFila, mapaPosicional, mapearEncabezado,
} from '@/features/clientes/importacion';
import { limpiarTexto, normalizarClave } from '@/features/clientes/validacion';
import {
  DURACION_MAXIMA, DURACION_MINIMA, describirHorario, duracionDeBloque, precioSugerido, textoDuracion,
} from './fijos';

export const COLUMNAS_PLANTILLA_FIJOS = [
  'titulo', 'cliente', 'telefono', 'cancha', 'dia', 'hora', 'duracion_min', 'precio', 'desde', 'hasta',
] as const;
type Columna = (typeof COLUMNAS_PLANTILLA_FIJOS)[number];

const ALIAS: Record<Columna, string[]> = {
  titulo: ['titulo', 'fijo', 'nombredelfijo', 'grupo', 'equipo'],
  cliente: ['cliente', 'nombre', 'nombredelcliente', 'responsable', 'contacto'],
  telefono: ['telefono', 'tel', 'celular', 'cel', 'whatsapp', 'movil'],
  cancha: ['cancha'],
  dia: ['dia', 'diadelasemana'],
  hora: ['hora', 'horario', 'horainicio', 'horadeinicio'],
  duracion_min: ['duracionmin', 'duracion', 'duracionminutos', 'duracionenminutos', 'minutos'],
  precio: ['precio', 'monto', 'valor', 'importe'],
  desde: ['desde', 'fechadesde', 'fechainicio', 'fechadeinicio'],
  hasta: ['hasta', 'fechahasta', 'fechafin', 'fechadefin', 'vence'],
};

const DIAS: Record<string, number> = {
  domingo: 0, dom: 0, do: 0,
  lunes: 1, lun: 1, lu: 1,
  martes: 2, mar: 2, ma: 2,
  miercoles: 3, mie: 3, mi: 3,
  jueves: 4, jue: 4, ju: 4,
  viernes: 5, vie: 5, vi: 5,
  sabado: 6, sab: 6, sa: 6,
};

/** "lun", "Lunes", "1" → 1. Del 1 (lunes) al 7 (domingo); 0 también es domingo. */
export function interpretarDia(texto: string): number | null {
  const clave = normalizarClave(texto).replace(/[^a-z0-9]/g, '');
  if (/^[0-7]$/.test(clave)) return Number(clave) % 7;
  return DIAS[clave] ?? null;
}

/** "19", "19:30", "19.30", "19hs", "19:30:00" → "19:30". */
export function interpretarHora(texto: string): string | null {
  const limpio = normalizarClave(texto).replace(/\s+/g, '');
  const partes = /^(\d{1,2})(?:[:.h](\d{2}))?(?::\d{2})?(?:hs?|horas?)?$/.exec(limpio);
  if (!partes) return null;
  const horas = Number(partes[1]);
  const minutos = Number(partes[2] ?? 0);
  if (horas > 23 || minutos > 59) return null;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/** "90", "90 min" o "1:30" → minutos. */
export function interpretarDuracion(texto: string): number | null {
  const limpio = normalizarClave(texto).replace(/\s+/g, '');
  const minutos = /^(\d{1,3})(?:m|min|minutos)?$/.exec(limpio);
  if (minutos) return Number(minutos[1]);
  const horas = /^(\d{1,2}):(\d{2})$/.exec(limpio);
  return horas ? Number(horas[1]) * 60 + Number(horas[2]) : null;
}

/**
 * "2026-10-06", "6/10/2026", "06-10-26" o "6/10" (año actual; con
 * `siguienteSiPaso`, el próximo si esa fecha ya pasó).
 */
export function interpretarFecha(texto: string, hoy: string, siguienteSiPaso = false): string | null {
  const limpio = texto.trim();
  if (esFechaISO(limpio)) return limpio;
  const partes = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(limpio);
  if (!partes) return null;
  const dia = partes[1].padStart(2, '0');
  const mes = partes[2].padStart(2, '0');
  let anio = partes[3] ? Number(partes[3].length === 2 ? `20${partes[3]}` : partes[3]) : Number(hoy.slice(0, 4));
  let fecha = `${anio}-${mes}-${dia}`;
  if (!partes[3] && siguienteSiPaso && fecha < hoy) {
    anio += 1;
    fecha = `${anio}-${mes}-${dia}`;
  }
  return esFechaISO(fecha) ? fecha : null;
}

type CanchaBuscada = Pick<CanchaGestion, 'id' | 'titulo' | 'activa'>;

/** Busca la cancha por su nombre (sin acentos ni mayúsculas) o por su número ("2" → "Cancha 2"). */
export function buscarCancha(texto: string, canchas: CanchaBuscada[]): { cancha: CanchaBuscada | null; error: string | null } {
  const clave = normalizarClave(texto);
  if (!clave) return { cancha: null, error: 'Falta la cancha.' };
  const activas = canchas.filter((cancha) => cancha.activa);
  const exactas = activas.filter((cancha) => normalizarClave(cancha.titulo) === clave);
  if (exactas.length === 1) return { cancha: exactas[0], error: null };
  if (/^\d+$/.test(clave)) {
    const numero = new RegExp(`(^|\\D)${clave}(\\D|$)`);
    const porNumero = activas.filter((cancha) => numero.test(normalizarClave(cancha.titulo)));
    if (porNumero.length === 1) return { cancha: porNumero[0], error: null };
  }
  const inactiva = canchas.find((cancha) => !cancha.activa && normalizarClave(cancha.titulo) === clave);
  if (inactiva) return { cancha: null, error: `La cancha «${inactiva.titulo}» está desactivada.` };
  const opciones = activas.map((cancha) => cancha.titulo).join(', ');
  return {
    cancha: null,
    error: `No encontramos la cancha «${limpiarTexto(texto)}».${opciones ? ` Tus canchas: ${opciones}.` : ''}`,
  };
}

export type DatosFijoImportado = {
  titulo: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  canchaId: number;
  canchaTitulo: string;
  dia: number;
  hora: string;
  duracion: number;
  precio: number;
  desde: string;
  hasta: string | null;
};

export type FilaFijo = {
  fila: number;
  original: { titulo: string; cliente: string; cancha: string; dia: string; hora: string };
  datos: DatosFijoImportado | null;
  errores: string[];
  avisos: string[];
  /** Cliente ya cargado al que se asigna el fijo. */
  clienteExistente: { id: number; nombre: string } | null;
};

export type ContextoImportacionFijos = {
  canchas: CanchaBuscada[];
  horarios: HorarioPublicado[];
  hoy: string;
  clientes: Pick<Cliente, 'id' | 'nombre' | 'telefono'>[];
  series: Pick<Serie, 'titulo' | 'cancha' | 'dia_semana' | 'hora_inicio' | 'duracion_min' | 'desde' | 'hasta'>[];
};

type Ventana = { canchaId: number; dia: number; hora: string; duracion: number; desde: string; hasta: string | null };

/** ¿Dos fijos ocupan la misma cancha a la misma hora en algún día en común? */
export function seSuperponen(a: Ventana, b: Ventana): boolean {
  if (a.canchaId !== b.canchaId || a.dia !== b.dia) return false;
  const inicioA = horaAMinutos(a.hora);
  const inicioB = horaAMinutos(b.hora);
  const chocanHoras = inicioA < inicioB + b.duracion && inicioB < inicioA + a.duracion;
  const chocanFechas = a.desde <= (b.hasta ?? '9999-12-31') && b.desde <= (a.hasta ?? '9999-12-31');
  return chocanHoras && chocanFechas;
}

function analizarFila(leer: (columna: Columna) => string, fila: number, contexto: ContextoImportacionFijos): FilaFijo {
  const { canchas, horarios, hoy, clientes } = contexto;
  const errores: string[] = [];
  const avisos: string[] = [];
  const original = {
    titulo: limpiarTexto(leer('titulo')),
    cliente: limpiarTexto(leer('cliente')),
    cancha: leer('cancha'),
    dia: leer('dia'),
    hora: leer('hora'),
  };

  const { titulo, cliente } = original;
  if (titulo && (titulo.length < 2 || titulo.length > 120)) errores.push('El título debe tener entre 2 y 120 caracteres.');
  if (cliente && (cliente.length < 2 || cliente.length > 120)) {
    errores.push('El nombre del cliente debe tener entre 2 y 120 caracteres.');
  }
  const telefonoEscrito = leer('telefono');
  const telefono = telefonoEscrito ? normalizarTelefono(telefonoEscrito) : null;
  if (telefonoEscrito && !telefono) errores.push(`Teléfono inválido: «${telefonoEscrito}».`);
  if (telefono && !cliente) errores.push('Si cargás el teléfono, indicá también el nombre del cliente.');
  if (!titulo && !cliente) errores.push('Indicá el título del fijo o el nombre del cliente.');

  const { cancha, error: errorCancha } = buscarCancha(original.cancha, canchas);
  if (errorCancha) errores.push(errorCancha);

  const dia = original.dia ? interpretarDia(original.dia) : null;
  if (!original.dia) errores.push('Falta el día.');
  else if (dia === null) errores.push(`Día inválido: «${original.dia}». Usá lunes, martes… o un número del 1 (lunes) al 7 (domingo).`);

  const hora = original.hora ? interpretarHora(original.hora) : null;
  if (!original.hora) errores.push('Falta la hora.');
  else if (!hora) errores.push(`Hora inválida: «${original.hora}». Usá el formato 19:30.`);
  else if (Number(hora.slice(3)) % 5 !== 0) errores.push('Usá minutos múltiplos de 5 (por ejemplo 19:00 o 19:30).');

  const horarioCompleto = cancha && dia !== null && hora ? { canchaId: cancha.id, dia, hora } : null;

  let duracion: number | null = null;
  const duracionEscrita = leer('duracion_min');
  if (duracionEscrita) {
    duracion = interpretarDuracion(duracionEscrita);
    if (duracion === null) errores.push(`Duración inválida: «${duracionEscrita}». Indicá los minutos, por ejemplo 90.`);
    else if (duracion < DURACION_MINIMA || duracion > DURACION_MAXIMA || duracion % 15 !== 0) {
      errores.push('La duración debe ser de 30 a 720 minutos, en tramos de 15.');
    }
  } else if (horarioCompleto) {
    const delBloque = duracionDeBloque(horarios, horarioCompleto.canchaId, horarioCompleto.dia, horarioCompleto.hora);
    duracion = delBloque ?? 60;
    avisos.push(delBloque
      ? `Sin duración: usamos la del horario publicado (${textoDuracion(delBloque)}).`
      : 'Sin duración: usamos 1 h.');
  }

  let precio: number | null = null;
  const precioEscrito = leer('precio');
  if (precioEscrito) {
    precio = parsearMonto(precioEscrito);
    if (precio === null || precio < 0) errores.push(`Precio inválido: «${precioEscrito}».`);
  } else {
    const sugerido = horarioCompleto && duracion ? precioSugerido(horarios, { ...horarioCompleto, duracion }) : null;
    if (sugerido !== null) {
      precio = sugerido;
      avisos.push(`Sin precio: usamos el del horario publicado (${formatMoney(sugerido)}).`);
    } else {
      errores.push('Falta el precio.');
    }
  }

  let desde = hoy;
  const desdeEscrito = leer('desde');
  if (desdeEscrito) {
    const fecha = interpretarFecha(desdeEscrito, hoy);
    if (!fecha) errores.push(`Fecha de inicio inválida: «${desdeEscrito}». Usá DD/MM/AAAA.`);
    else if (fecha < hoy) avisos.push('La fecha de inicio ya pasó: el fijo empieza hoy.');
    else desde = fecha;
  }

  let hasta: string | null = null;
  const hastaEscrito = leer('hasta');
  if (hastaEscrito) {
    const fecha = interpretarFecha(hastaEscrito, hoy, true);
    if (!fecha) errores.push(`Fecha de fin inválida: «${hastaEscrito}». Usá DD/MM/AAAA.`);
    else if (fecha < hoy) errores.push('La fecha de fin ya pasó.');
    else if (fecha < desde) errores.push('La fecha de fin es anterior a la de inicio.');
    else hasta = fecha;
  }

  let clienteExistente: FilaFijo['clienteExistente'] = null;
  if (telefono) {
    const encontrado = clientes.find((c) => c.telefono === telefono);
    if (encontrado) clienteExistente = { id: encontrado.id, nombre: encontrado.nombre };
  } else if (cliente) {
    const clave = normalizarClave(cliente);
    const coincidencias = clientes.filter((c) => normalizarClave(c.nombre) === clave);
    if (coincidencias.length === 1) clienteExistente = { id: coincidencias[0].id, nombre: coincidencias[0].nombre };
    else if (coincidencias.length > 1) {
      avisos.push(`Hay ${coincidencias.length} clientes llamados «${cliente}»: vamos a crear uno nuevo. Agregá el teléfono para asignarlo a uno de ellos.`);
    }
  }
  if (clienteExistente) avisos.push(`Se asigna a ${clienteExistente.nombre}, que ya está en tus clientes.`);

  if (errores.length || !cancha || dia === null || !hora || duracion === null || precio === null) {
    return { fila, original, errores, avisos, clienteExistente, datos: null };
  }
  return {
    fila,
    original,
    errores,
    avisos,
    clienteExistente,
    datos: {
      titulo: titulo || null,
      clienteNombre: cliente || null,
      clienteTelefono: telefono,
      canchaId: cancha.id,
      canchaTitulo: cancha.titulo,
      dia,
      hora,
      duracion,
      precio,
      desde,
      hasta,
    },
  };
}

export type AnalisisFijos = { filas: FilaFijo[]; error: string | null };

export function analizarCsvFijos(texto: string, contexto: ContextoImportacionFijos): AnalisisFijos {
  const filas = parsearCsv(texto);
  if (!filas.length) return { filas: [], error: 'El archivo está vacío.' };

  const encabezado = mapearEncabezado(filas[0], ALIAS);
  if (encabezado) {
    const faltantes = (['cancha', 'dia', 'hora'] as const).filter((columna) => encabezado[columna] === undefined);
    if (faltantes.length) {
      return { filas: [], error: `Faltan columnas obligatorias: ${faltantes.join(', ')}. Usá la plantilla como guía.` };
    }
  }
  const mapa = encabezado ?? mapaPosicional(COLUMNAS_PLANTILLA_FIJOS);
  const datos = encabezado ? filas.slice(1) : filas;
  const primeraFila = encabezado ? 2 : 1;
  if (!datos.length) return { filas: [], error: 'La planilla no tiene fijos debajo del encabezado.' };
  if (datos.length > MAX_FILAS_IMPORTACION) {
    return { filas: [], error: `La planilla tiene más de ${MAX_FILAS_IMPORTACION} filas. Dividila en partes más chicas.` };
  }

  const analizadas = datos.map((celdas, indice) => analizarFila(lectorDeFila(celdas, mapa), primeraFila + indice, contexto));

  // Choques con fijos que ya existen y entre filas del mismo archivo.
  const aceptadas: FilaFijo[] = [];
  for (const fila of analizadas) {
    const datosFila = fila.datos;
    if (!datosFila) continue;
    const ventana: Ventana = { ...datosFila };
    const existente = contexto.series.find((serie) => seSuperponen(ventana, {
      canchaId: serie.cancha.id, dia: serie.dia_semana, hora: serie.hora_inicio, duracion: serie.duracion_min,
      desde: serie.desde < contexto.hoy ? contexto.hoy : serie.desde, hasta: serie.hasta,
    }));
    const previa = existente ? null : aceptadas.find((otra) => otra.datos && seSuperponen(ventana, otra.datos));
    if (existente) {
      fila.errores.push(`Choca con el fijo «${existente.titulo}» (${describirHorario(existente.dia_semana, existente.hora_inicio, existente.duracion_min)}, ${existente.cancha.titulo}) que ya está cargado.`);
      fila.datos = null;
    } else if (previa) {
      fila.errores.push(`Se superpone con la fila ${previa.fila} (misma cancha, día y horario).`);
      fila.datos = null;
    } else {
      aceptadas.push(fila);
    }
  }
  return { filas: analizadas, error: null };
}

/** "Martes 19:00–20:30 · Cancha 1" para mostrar en la vista previa y el resumen. */
export function describirFijoImportado(datos: DatosFijoImportado): string {
  return `${describirHorario(datos.dia, datos.hora, datos.duracion)} · ${datos.canchaTitulo}`;
}
