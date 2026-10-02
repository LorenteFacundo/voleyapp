import { describe, expect, it } from 'vitest';
import { montoParaCampo, parsearMonto } from './montos';

describe('parsearMonto', () => {
  it.each([
    ['$ 30.000', 30000],
    ['30000', 30000],
    ['30.000,50', 30000.5],
    ['1.234.567,89', 1234567.89],
    ['1,234,567.89', 1234567.89],
    ['1.500', 1500],
    ['1,500', 1500],
    ['1500.5', 1500.5],
    ['1,5', 1.5],
    [' 25 000 ', 25000],
    ['ARS 1000', 1000],
    ['-2.000', -2000],
    ['0', 0],
  ])('interpreta %s', (entrada, esperado) => {
    expect(parsearMonto(entrada)).toBe(esperado);
  });

  it.each(['', '   ', 'abc', '1.2.3', '12,34,56', '$', '--5'])('rechaza %s', (entrada) => {
    expect(parsearMonto(entrada)).toBeNull();
  });

  it('acepta números ya parseados', () => {
    expect(parsearMonto(1200.456)).toBe(1200.46);
    expect(parsearMonto(Number.NaN)).toBeNull();
    expect(parsearMonto(null)).toBeNull();
  });

  it('prepara montos para precargar un campo', () => {
    expect(montoParaCampo(12000)).toBe('12000');
    expect(montoParaCampo(-1500.5)).toBe('1500,5');
    expect(montoParaCampo(null)).toBe('');
    expect(parsearMonto(montoParaCampo(1500.5))).toBe(1500.5);
  });
});
