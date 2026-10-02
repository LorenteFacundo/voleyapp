import { describe, expect, it } from 'vitest';
import type { HorarioPublicado } from '@/api/tipos';
import { generarCsv } from '@/lib/archivos';
import {
  COLUMNAS_PLANTILLA_FIJOS, analizarCsvFijos, buscarCancha, interpretarDia, interpretarDuracion, interpretarFecha,
  interpretarHora, seSuperponen, type ContextoImportacionFijos,
} from './csvFijos';

const canchas = [
  { id: 1, titulo: 'Cancha 1', activa: true },
  { id: 2, titulo: 'Cancha 2 (techada)', activa: true },
  { id: 3, titulo: 'Arena', activa: false },
];

const horarios: HorarioPublicado[] = [
  { id: 1, cancha_id: 1, dia_semana: 2, hora_inicio: '19:00', hora_fin: '20:30', precio_total: 36000, precio_sena: 0, activo: true },
];

const contexto = (cambios: Partial<ContextoImportacionFijos> = {}): ContextoImportacionFijos => ({
  canchas, horarios, hoy: '2026-10-01', clientes: [], series: [], ...cambios,
});

const planilla = (...filas: string[][]) => generarCsv([...COLUMNAS_PLANTILLA_FIJOS], filas);

describe('interpretar celdas', () => {
  it.each([
    ['lun', 1], ['Lunes', 1], ['1', 1], ['MIÉRCOLES', 3], ['Sáb.', 6], ['7', 0], ['0', 0], ['domingo', 0], ['feriado', null], ['8', null],
  ])('día %s', (texto, esperado) => {
    expect(interpretarDia(texto)).toBe(esperado);
  });

  it.each([
    ['19', '19:00'], ['19:30', '19:30'], ['7.30', '07:30'], ['19hs', '19:00'], ['19 h', '19:00'], ['19h30', '19:30'],
    ['19:30:00', '19:30'], ['24:00', null], ['19:75', null], ['tarde', null],
  ])('hora %s', (texto, esperado) => {
    expect(interpretarHora(texto)).toBe(esperado);
  });

  it('duraciones en minutos o en horas', () => {
    expect(interpretarDuracion('90')).toBe(90);
    expect(interpretarDuracion('90 min')).toBe(90);
    expect(interpretarDuracion('1:30')).toBe(90);
    expect(interpretarDuracion('una hora')).toBeNull();
  });

  it('fechas en los formatos habituales', () => {
    expect(interpretarFecha('2026-10-06', '2026-10-01')).toBe('2026-10-06');
    expect(interpretarFecha('6/10/2026', '2026-10-01')).toBe('2026-10-06');
    expect(interpretarFecha('06-10-26', '2026-10-01')).toBe('2026-10-06');
    expect(interpretarFecha('6/10', '2026-10-01')).toBe('2026-10-06');
    expect(interpretarFecha('31/3', '2026-10-01', true)).toBe('2027-03-31');
    expect(interpretarFecha('31/02/2026', '2026-10-01')).toBeNull();
    expect(interpretarFecha('mañana', '2026-10-01')).toBeNull();
  });

  it('busca la cancha por nombre o número', () => {
    expect(buscarCancha('cancha 1', canchas).cancha?.id).toBe(1);
    expect(buscarCancha('2', canchas).cancha?.id).toBe(2);
    expect(buscarCancha('arena', canchas).error).toMatch(/desactivada/);
    expect(buscarCancha('Central', canchas).error).toBe('No encontramos la cancha «Central». Tus canchas: Cancha 1, Cancha 2 (techada).');
    expect(buscarCancha('', canchas).error).toBe('Falta la cancha.');
  });

  it('detecta superposiciones de horario y vigencia', () => {
    const base = { canchaId: 1, dia: 2, hora: '19:00', duracion: 90, desde: '2026-10-01', hasta: null };
    expect(seSuperponen(base, { ...base, hora: '20:00' })).toBe(true);
    expect(seSuperponen(base, { ...base, hora: '20:30' })).toBe(false);
    expect(seSuperponen(base, { ...base, dia: 3 })).toBe(false);
    expect(seSuperponen({ ...base, hasta: '2026-10-31' }, { ...base, desde: '2026-11-01' })).toBe(false);
  });
});

describe('analizarCsvFijos', () => {
  it('arma cada fijo con sus datos', () => {
    const { filas, error } = analizarCsvFijos(planilla(
      ['Martes vóley', 'Ana Pérez', '11 2233-4455', 'Cancha 1', 'martes', '19', '90', '$ 36.000', '6/10/2026', '31/12/2026'],
    ), contexto());
    expect(error).toBeNull();
    expect(filas[0].errores).toEqual([]);
    expect(filas[0].datos).toEqual({
      titulo: 'Martes vóley', clienteNombre: 'Ana Pérez', clienteTelefono: '5491122334455', canchaId: 1, canchaTitulo: 'Cancha 1',
      dia: 2, hora: '19:00', duracion: 90, precio: 36000, desde: '2026-10-06', hasta: '2026-12-31',
    });
  });

  it('completa duración, precio y fecha de inicio cuando faltan', () => {
    const { filas } = analizarCsvFijos(planilla(
      ['', 'Beto', '', 'Cancha 1', 'mar', '19:00', '', '', '', ''],
      ['', 'Carla', '', 'Cancha 2 (techada)', 'jue', '21:00', '', '30000', '1/9/2026', ''],
    ), contexto());
    expect(filas[0].datos).toMatchObject({ duracion: 90, precio: 36000, desde: '2026-10-01', titulo: null });
    expect(filas[0].avisos).toHaveLength(2);
    expect(filas[1].datos).toMatchObject({ duracion: 60, precio: 30000, desde: '2026-10-01' });
    expect(filas[1].avisos.join(' ')).toMatch(/ya pasó/);
  });

  it('informa todos los errores de una fila', () => {
    const { filas } = analizarCsvFijos(planilla(['', '', '123', 'Central', 'feriado', '19:32', '100', 'gratis', '', '1/1/2020']), contexto());
    expect(filas[0].datos).toBeNull();
    expect(filas[0].errores).toEqual([
      'Teléfono inválido: «123».',
      'Indicá el título del fijo o el nombre del cliente.',
      'No encontramos la cancha «Central». Tus canchas: Cancha 1, Cancha 2 (techada).',
      'Día inválido: «feriado». Usá lunes, martes… o un número del 1 (lunes) al 7 (domingo).',
      'Usá minutos múltiplos de 5 (por ejemplo 19:00 o 19:30).',
      'La duración debe ser de 30 a 720 minutos, en tramos de 15.',
      'Precio inválido: «gratis».',
      'La fecha de fin ya pasó.',
    ]);
  });

  it('asigna clientes existentes por teléfono o por nombre único', () => {
    const clientes = [
      { id: 5, nombre: 'Ana Pérez', telefono: '5491122334455' },
      { id: 6, nombre: 'Beto', telefono: null },
      { id: 7, nombre: 'Juan', telefono: null },
      { id: 8, nombre: 'juan', telefono: '5491100000000' },
    ];
    const { filas } = analizarCsvFijos(planilla(
      ['', 'Anita', '+54 9 11 2233-4455', '1', 'lun', '18', '60', '1000', '', ''],
      ['', 'BETO', '', '1', 'mar', '18', '60', '1000', '', ''],
      ['', 'Juan', '', '1', 'mie', '18', '60', '1000', '', ''],
    ), contexto({ clientes }));
    expect(filas[0].clienteExistente).toEqual({ id: 5, nombre: 'Ana Pérez' });
    expect(filas[1].clienteExistente).toEqual({ id: 6, nombre: 'Beto' });
    expect(filas[2].clienteExistente).toBeNull();
    expect(filas[2].avisos[0]).toMatch(/Hay 2 clientes/);
  });

  it('rechaza filas que chocan entre sí o con fijos cargados', () => {
    const series = [{
      titulo: 'Los jueves', cancha: { id: 1, titulo: 'Cancha 1' }, dia_semana: 4, hora_inicio: '20:00', duracion_min: 120,
      desde: '2026-01-01', hasta: null,
    }];
    const { filas } = analizarCsvFijos(planilla(
      ['Grupo A', '', '', '1', 'mar', '19', '90', '1000', '', ''],
      ['Grupo B', '', '', '1', 'mar', '20', '60', '1000', '', ''],
      ['Grupo C', '', '', '1', 'jue', '21', '60', '1000', '', ''],
      ['Grupo D', '', '', '2', 'mar', '20', '60', '1000', '', ''],
    ), contexto({ series }));
    expect(filas.map((fila) => !!fila.datos)).toEqual([true, false, false, true]);
    expect(filas[1].errores).toEqual(['Se superpone con la fila 2 (misma cancha, día y horario).']);
    expect(filas[2].errores[0]).toMatch(/^Choca con el fijo «Los jueves» \(Jueves 20:00–22:00, Cancha 1\)/);
  });

  it('acepta archivos sin encabezado y exige las columnas clave', () => {
    const sinEncabezado = analizarCsvFijos('Grupo A;;;1;mar;19;90;1000;;', contexto());
    expect(sinEncabezado.filas[0].fila).toBe(1);
    expect(sinEncabezado.filas[0].datos?.canchaId).toBe(1);
    expect(analizarCsvFijos('titulo;cancha\nA;1', contexto()).error).toBe(
      'Faltan columnas obligatorias: dia, hora. Usá la plantilla como guía.',
    );
    expect(analizarCsvFijos('', contexto()).error).toMatch(/vacío/);
  });
});
