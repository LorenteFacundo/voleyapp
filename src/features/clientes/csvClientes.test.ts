import { describe, expect, it } from 'vitest';
import type { ClienteListado } from '@/api/tipos';
import { generarCsv, parsearCsv } from '@/lib/archivos';
import {
  COLUMNAS_EXPORTACION, COLUMNAS_PLANTILLA_CLIENTES, analizarCsvClientes, filasExportacionClientes, telefonoParaPlanilla,
} from './csvClientes';

const cliente = (cambios: Partial<ClienteListado>): ClienteListado => ({
  id: 1,
  nombre: 'Ana Pérez',
  telefono: '5491122334455',
  email: 'ana@mail.com',
  es_usuario_app: false,
  notas: null,
  archivado: false,
  created_at: '2026-09-01T12:00:00.000Z',
  saldo: -12000,
  reservas: 8,
  ultima: '2026-09-29T22:00:00.000Z',
  proxima: null,
  fijos: 1,
  ...cambios,
});

describe('exportar clientes', () => {
  it('genera una fila por cliente con saldo numérico y fechas legibles', () => {
    expect(filasExportacionClientes([cliente({})])).toEqual([
      ['Ana Pérez', '54 9 11 2233-4455', 'ana@mail.com', -12000, 8, '2026-09-29 19:00', ''],
    ]);
    const csv = generarCsv(COLUMNAS_EXPORTACION, filasExportacionClientes([cliente({})]));
    expect(csv).toContain('Ana Pérez;54 9 11 2233-4455;ana@mail.com;-12000;8;2026-09-29 19:00;');
  });

  it('escribe el teléfono de forma que se pueda volver a importar', () => {
    const analisis = analizarCsvClientes(`nombre;telefono\nAna;${telefonoParaPlanilla('5491122334455')}`, []);
    expect(analisis.filas[0].datos?.telefono).toBe('5491122334455');
    expect(telefonoParaPlanilla(null)).toBe('');
  });
});

describe('importar clientes', () => {
  it('lee la plantilla y valida cada fila', () => {
    const texto = generarCsv([...COLUMNAS_PLANTILLA_CLIENTES], [
      ['Ana Pérez', '11 2233-4455', 'ANA@mail.com', 'Juega los martes'],
      ['B', '', '', ''],
      ['Carlos', '123', 'carlos@', ''],
    ]);
    const { filas, error } = analizarCsvClientes(texto, []);
    expect(error).toBeNull();
    expect(filas[0]).toMatchObject({
      fila: 2,
      estado: 'valida',
      datos: { nombre: 'Ana Pérez', telefono: '5491122334455', email: 'ana@mail.com', notas: 'Juega los martes' },
    });
    expect(filas[1]).toMatchObject({ fila: 3, estado: 'error' });
    expect(filas[2].errores).toHaveLength(2);
  });

  it('acepta columnas en otro orden y con otros nombres', () => {
    const { filas } = analizarCsvClientes('Celular,Apellido y nombre\n1122334455,Ana', []);
    expect(filas[0].datos).toMatchObject({ nombre: 'Ana', telefono: '5491122334455' });
  });

  it('sin encabezado usa el orden de la plantilla', () => {
    const { filas } = analizarCsvClientes('Ana;1122334455;ana@mail.com\nBeto;;', []);
    expect(filas.map((f) => [f.fila, f.datos?.nombre])).toEqual([[1, 'Ana'], [2, 'Beto']]);
  });

  it('omite repetidos dentro del archivo y clientes que ya existen', () => {
    const texto = 'nombre;telefono\nAna;11 2233 4455\nAnita;+54 9 11 2233-4455\nBeto;\nbeto;\nCarla;11 5555 6666';
    const existentes = [{ id: 9, nombre: 'Carla Gómez', telefono: '5491155556666', archivado: true }];
    const { filas } = analizarCsvClientes(texto, existentes);
    expect(filas.map((f) => f.estado)).toEqual(['valida', 'repetida', 'valida', 'repetida', 'repetida']);
    expect(filas[1].motivo).toBe('Repetido en la fila 2.');
    expect(filas[3].motivo).toBe('Repetido en la fila 4.');
    expect(filas[4].motivo).toBe('Ya está en tus clientes como «Carla Gómez» (archivado).');
  });

  it('informa archivos vacíos o sin la columna de nombre', () => {
    expect(analizarCsvClientes('', []).error).toMatch(/vacío/);
    expect(analizarCsvClientes('telefono;email\n1122334455;a@b.com', []).error).toMatch(/nombre/);
    expect(analizarCsvClientes('nombre;telefono\n', []).error).toMatch(/no tiene clientes/);
  });

  it('lee lo que exporta parsearCsv sin perder datos', () => {
    expect(parsearCsv('nombre\n"Pérez; Ana"')[1]).toEqual(['Pérez; Ana']);
  });
});
