import { describe, expect, it } from 'vitest';
import type { PagoCaja } from '@/api/tipos';
import { generarCsv, nombreArchivo, numeroCsv, parsearCsv } from '@/lib/archivos';
import { ENCABEZADOS_PAGOS, filasPagos } from './csv';
import { etiquetaEstadoPago, etiquetaEstadoReserva, etiquetaMedio, motivoBaja, yaEmpezo } from './etiquetas';

const pago = (cambios: Partial<PagoCaja>): PagoCaja => ({
  id: 1,
  fecha: '2026-10-01',
  monto: 12000,
  medio: 'transferencia',
  nota: null,
  anulado: false,
  created_at: '2026-10-01T15:00:00.000Z',
  cliente: { id: 7, nombre: 'Ana Pérez' },
  ocupacion: { id: 3, inicio: '2026-10-01T22:00:00.000Z', cancha: 'Cancha 1', titulo: null },
  registrado_por: 'Facu',
  ...cambios,
});

describe('CSV para Excel', () => {
  it('escribe números con coma decimal y sin protegerlos como fórmula', () => {
    expect(numeroCsv(1234.5)).toBe('1234,5');
    expect(numeroCsv(-500)).toBe('-500');
    const csv = generarCsv(['texto', 'monto'], [['=HACK()', -500], ['Pérez; Ana', 1234.5]]);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain("'=HACK();-500");
    expect(csv).toContain('"Pérez; Ana";1234,5');
  });

  it('arma la planilla de pagos para el contador', () => {
    const filas = filasPagos([
      pago({}),
      pago({ id: 2, monto: -3000, medio: 'efectivo', nota: 'Devolución', ocupacion: null, anulado: true }),
    ]);
    expect(filas[0]).toEqual([
      '2026-10-01', 'Ana Pérez', 'Cancha 1 · 2026-10-01 19:00', 'Transferencia', 12000, null, '', 'Facu', 'Vigente',
    ]);
    expect(filas[1].slice(3, 9)).toEqual(['Efectivo', null, 3000, 'Devolución', 'Facu', 'Anulado']);
    const leido = parsearCsv(generarCsv(ENCABEZADOS_PAGOS, filas));
    expect(leido[0]).toEqual(ENCABEZADOS_PAGOS);
    expect(leido[2][5]).toBe('3000');
  });

  it('genera nombres de archivo seguros', () => {
    expect(nombreArchivo('caja', 'Club Náutico Norte', '2026-10-01')).toBe('caja_club-nautico-norte_2026-10-01.csv');
    expect(nombreArchivo('', '***')).toBe('export.csv');
  });
});

describe('etiquetas', () => {
  it('nombra medios y estados de reserva y de pago', () => {
    expect(etiquetaMedio('mercadopago')).toBe('Mercado Pago');
    expect(etiquetaEstadoReserva({ estado: 'confirmada', cancelada_por: null, serie_id: 4 }).texto).toBe('Fijo');
    expect(etiquetaEstadoReserva({ estado: 'confirmada', cancelada_por: null, serie_id: null }).variante).toBe('info');
    expect(etiquetaEstadoReserva({ estado: 'cancelada', cancelada_por: 'jugador', serie_id: null }).className).toBe('line-through');
    expect(motivoBaja({ estado: 'vencida', cancelada_por: 'sistema', serie_id: null })).toBe('Venció sin respuesta');
    expect(etiquetaEstadoPago('pendiente', true)?.texto).toBe('Impaga');
    expect(etiquetaEstadoPago('pendiente', false)?.texto).toBe('Sin pagar');
    expect(etiquetaEstadoPago('sin_cargo', true)).toBeNull();
  });

  it('sabe si un turno ya empezó', () => {
    const ahora = new Date('2026-10-01T22:00:00.000Z');
    expect(yaEmpezo('2026-10-01T22:00:00.000Z', ahora)).toBe(true);
    expect(yaEmpezo('2026-10-01T22:30:00.000Z', ahora)).toBe(false);
  });
});
