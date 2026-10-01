// Validación de los formularios de alta y modificación de un fijo, con las
// reglas del servidor (club_crear_serie / club_modificar_serie).

import { esFechaISO, horaArgentina } from '@/lib/date';
import { normalizarTelefono } from '@/lib/telefono';
import { parsearMonto } from '@/features/caja/montos';
import { limpiarTexto } from '@/features/clientes/validacion';
import { validarHorario, type Horario } from './fijos';

export type Errores = Partial<Record<string, string>>;

/** Hora actual en Buenos Aires ('HH:MM'), para no proponer fechas que ya pasaron. */
export function horaActualArgentina(): string {
  return horaArgentina(new Date());
}

function validarTitulo(titulo: string, obligatorio: boolean): { valor: string; error?: string } {
  const valor = limpiarTexto(titulo);
  if (!valor) return { valor, error: obligatorio ? 'Ingresá el nombre del fijo.' : undefined };
  if (valor.length < 2 || valor.length > 120) return { valor, error: 'El nombre del fijo debe tener entre 2 y 120 caracteres.' };
  return { valor };
}

function validarPrecio(precio: string): { valor: number | null; error?: string } {
  const valor = parsearMonto(precio);
  if (valor === null || valor < 0) return { valor: null, error: 'Ingresá el precio de cada turno (puede ser 0).' };
  return { valor };
}

function validarFin(hasta: string, desde: string): { valor: string | null; error?: string } {
  if (!hasta) return { valor: null };
  if (!esFechaISO(hasta)) return { valor: null, error: 'Elegí una fecha válida o dejala vacía.' };
  if (hasta < desde) return { valor: null, error: 'La fecha de fin no puede ser anterior a la de inicio.' };
  return { valor: hasta };
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export type FormularioNuevoFijo = {
  cliente: { modo: 'existente'; id: number | null } | { modo: 'nuevo'; nombre: string; telefono: string };
  titulo: string;
  horario: Horario;
  precio: string;
  desde: string;
  hasta: string;
  notas: string;
};

export type NuevoFijoValido = {
  clienteId: number | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  titulo: string;
  canchaId: number;
  dia: number;
  hora: string;
  duracion: number;
  precio: number;
  desde: string;
  hasta: string | null;
  notas: string | null;
};

export function validarNuevoFijo(formulario: FormularioNuevoFijo, hoy: string): { datos: NuevoFijoValido | null; errores: Errores } {
  const errores: Errores = {};
  let clienteId: number | null = null;
  let clienteNombre: string | null = null;
  let clienteTelefono: string | null = null;

  if (formulario.cliente.modo === 'existente') {
    if (!formulario.cliente.id) errores.cliente = 'Elegí un cliente o cargá uno nuevo.';
    clienteId = formulario.cliente.id;
  } else {
    clienteNombre = limpiarTexto(formulario.cliente.nombre);
    if (clienteNombre.length < 2) errores.clienteNombre = 'Ingresá el nombre del cliente (al menos 2 letras).';
    else if (clienteNombre.length > 120) errores.clienteNombre = 'El nombre no puede superar los 120 caracteres.';
    const telefono = formulario.cliente.telefono.trim();
    clienteTelefono = telefono ? normalizarTelefono(telefono) : null;
    if (telefono && !clienteTelefono) errores.clienteTelefono = 'Revisá el teléfono: escribilo con la característica, por ejemplo 11 2233-4455.';
  }

  const titulo = validarTitulo(formulario.titulo, false);
  if (titulo.error) errores.titulo = titulo.error;
  Object.assign(errores, validarHorario(formulario.horario));
  const precio = validarPrecio(formulario.precio);
  if (precio.error) errores.precio = precio.error;
  const desdeValido = esFechaISO(formulario.desde) && formulario.desde >= hoy;
  if (!desdeValido) errores.desde = 'Elegí una fecha de inicio desde hoy.';
  const hasta = validarFin(formulario.hasta, formulario.desde);
  if (hasta.error) errores.hasta = hasta.error;
  const notas = formulario.notas.trim();
  if (notas.length > 500) errores.notas = 'Las notas no pueden superar los 500 caracteres.';

  const { canchaId } = formulario.horario;
  if (Object.keys(errores).length || !canchaId || precio.valor === null) return { datos: null, errores };
  return {
    errores,
    datos: {
      clienteId,
      clienteNombre,
      clienteTelefono,
      titulo: titulo.valor,
      canchaId,
      dia: formulario.horario.dia,
      hora: formulario.horario.hora,
      duracion: formulario.horario.duracion,
      precio: precio.valor,
      desde: formulario.desde,
      hasta: hasta.valor,
      notas: notas || null,
    },
  };
}

// ---------------------------------------------------------------------------
// Modificación
// ---------------------------------------------------------------------------

export type FormularioCambiosFijo = {
  desdeFecha: string;
  horario: Horario;
  precio: string;
  titulo: string;
  hasta: string;
};

export type CambiosFijoValidos = {
  desdeFecha: string;
  canchaId: number;
  dia: number;
  hora: string;
  duracion: number;
  precio: number;
  titulo: string;
  hasta: string | null;
};

export function validarCambiosFijo(formulario: FormularioCambiosFijo, hoy: string): { datos: CambiosFijoValidos | null; errores: Errores } {
  const errores: Errores = {};
  if (!esFechaISO(formulario.desdeFecha) || formulario.desdeFecha < hoy) {
    errores.desdeFecha = 'Los cambios aplican desde hoy en adelante.';
  }
  Object.assign(errores, validarHorario(formulario.horario));
  const precio = validarPrecio(formulario.precio);
  if (precio.error) errores.precio = precio.error;
  const titulo = validarTitulo(formulario.titulo, true);
  if (titulo.error) errores.titulo = titulo.error;
  const hasta = validarFin(formulario.hasta, formulario.desdeFecha);
  if (hasta.error) errores.hasta = hasta.error;

  const { canchaId } = formulario.horario;
  if (Object.keys(errores).length || !canchaId || precio.valor === null) return { datos: null, errores };
  return {
    errores,
    datos: {
      desdeFecha: formulario.desdeFecha,
      canchaId,
      dia: formulario.horario.dia,
      hora: formulario.horario.hora,
      duracion: formulario.horario.duracion,
      precio: precio.valor,
      titulo: titulo.valor,
      hasta: hasta.valor,
    },
  };
}
