import { describe, expect, it } from 'vitest';
import {
  decodificarCsv, lectorDeFila, mapaPosicional, mapearEncabezado, normalizarEncabezado, procesarEnSerie,
} from './importacion';

describe('lectura de archivos', () => {
  it('lee UTF-8 con BOM', () => {
    const bytes = new TextEncoder().encode('\ufeffnombre;teléfono\nMaría;11 2233 4455\n');
    expect(decodificarCsv(bytes)).toBe('nombre;teléfono\nMaría;11 2233 4455\n');
  });

  it('lee el CSV de Excel en Windows (windows-1252)', () => {
    // "Ñandú;Pérez" en windows-1252: Ñ = 0xD1, ú = 0xFA, é = 0xE9.
    const bytes = new Uint8Array([0xd1, 0x61, 0x6e, 0x64, 0xfa, 0x3b, 0x50, 0xe9, 0x72, 0x65, 0x7a]);
    expect(decodificarCsv(bytes)).toBe('Ñandú;Pérez');
  });

  it('descarta la línea "sep=;" que agrega Excel', () => {
    expect(decodificarCsv(new TextEncoder().encode('sep=;\r\nnombre\nAna'))).toBe('nombre\nAna');
  });
});

describe('encabezados', () => {
  const alias = { nombre: ['nombre', 'cliente'], telefono: ['telefono', 'celular'], email: ['email', 'mail'] };

  it('normaliza acentos, mayúsculas y símbolos', () => {
    expect(normalizarEncabezado('  Teléfono (Celular) ')).toBe('telefonocelular');
  });

  it('encuentra las columnas en cualquier orden', () => {
    expect(mapearEncabezado(['Mail', 'Celular', 'Cliente'], alias)).toEqual({ email: 0, telefono: 1, nombre: 2 });
    expect(mapearEncabezado(['Ana', '1122334455'], alias)).toBeNull();
  });

  it('lee celdas por nombre de columna', () => {
    const leer = lectorDeFila(['Ana ', ' 11'], mapaPosicional(['nombre', 'telefono', 'email'] as const));
    expect(leer('nombre')).toBe('Ana');
    expect(leer('telefono')).toBe('11');
    expect(leer('email')).toBe('');
  });
});

describe('procesarEnSerie', () => {
  it('procesa en orden, sigue ante errores e informa el avance', async () => {
    const orden: number[] = [];
    const avances: number[] = [];
    const resultados = await procesarEnSerie([1, 2, 3], async (n) => {
      orden.push(n);
      if (n === 2) throw new Error('falló el 2');
      return n * 10;
    }, { describirError: (error) => (error as Error).message, alAvanzar: (hechos) => avances.push(hechos) });
    expect(orden).toEqual([1, 2, 3]);
    expect(avances).toEqual([1, 2, 3]);
    expect(resultados).toEqual([
      { item: 1, estado: 'ok', valor: 10 },
      { item: 2, estado: 'error', error: 'falló el 2' },
      { item: 3, estado: 'ok', valor: 30 },
    ]);
  });

  it('se detiene entre filas cuando se lo piden', async () => {
    let detener = false;
    const resultados = await procesarEnSerie(['a', 'b', 'c'], async (letra) => {
      if (letra === 'a') detener = true;
      return letra;
    }, { describirError: String, detener: () => detener });
    expect(resultados.map((r) => r.estado)).toEqual(['ok', 'detenido', 'detenido']);
  });
});
