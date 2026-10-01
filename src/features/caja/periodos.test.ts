import { describe, expect, it } from 'vitest';
import {
  LIMITE_CAJA, LIMITE_REPORTE, describirRango, primerDiaDelMes, rangoCaja, rangoReporte, ultimoDiaDelMes, validarRango,
} from './periodos';

describe('períodos de caja', () => {
  // Jueves 1 de octubre de 2026.
  const hoy = '2026-10-01';

  it('calcula los rangos rápidos', () => {
    expect(rangoCaja('hoy', hoy)).toEqual({ desde: hoy, hasta: hoy });
    expect(rangoCaja('ayer', hoy)).toEqual({ desde: '2026-09-30', hasta: '2026-09-30' });
    expect(rangoCaja('semana', hoy)).toEqual({ desde: '2026-09-28', hasta: hoy });
    expect(rangoCaja('mes', '2026-10-15')).toEqual({ desde: '2026-10-01', hasta: '2026-10-15' });
  });

  it('respeta el límite del servidor de 3 meses', () => {
    expect(validarRango({ desde: '2026-07-01', hasta: '2026-10-02' }, LIMITE_CAJA)).toBeNull();
    expect(validarRango({ desde: '2026-07-01', hasta: '2026-10-03' }, LIMITE_CAJA)).toMatch(/3 meses/);
    expect(validarRango({ desde: '2026-10-02', hasta: '2026-10-01' }, LIMITE_CAJA)).toMatch(/anterior/);
    expect(validarRango({ desde: '', hasta: '2026-10-01' }, LIMITE_CAJA)).toMatch(/Elegí/);
  });
});

describe('períodos de reportes', () => {
  it('calcula las últimas 4 semanas, este mes y el mes pasado', () => {
    expect(rangoReporte('ultimas4', '2026-10-01')).toEqual({ desde: '2026-09-04', hasta: '2026-10-01' });
    expect(rangoReporte('mes', '2026-10-20')).toEqual({ desde: '2026-10-01', hasta: '2026-10-20' });
    expect(rangoReporte('mesPasado', '2026-10-20')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(rangoReporte('mesPasado', '2027-01-05')).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' });
  });

  it('permite hasta 6 meses', () => {
    expect(validarRango({ desde: '2026-04-01', hasta: '2026-10-01' }, LIMITE_REPORTE)).toBeNull();
    expect(validarRango({ desde: '2026-03-01', hasta: '2026-10-01' }, LIMITE_REPORTE)).toMatch(/6 meses/);
  });

  it('conoce el largo de cada mes', () => {
    expect(primerDiaDelMes('2026-02-17')).toBe('2026-02-01');
    expect(ultimoDiaDelMes('2026-02-17')).toBe('2026-02-28');
    expect(ultimoDiaDelMes('2028-02-03')).toBe('2028-02-29');
    expect(ultimoDiaDelMes('2026-12-09')).toBe('2026-12-31');
  });
});

describe('describirRango', () => {
  it('nombra días sueltos y rangos', () => {
    expect(describirRango({ desde: '2026-10-01', hasta: '2026-10-01' }, '2026-10-01')).toBe('Hoy');
    expect(describirRango({ desde: '2026-09-30', hasta: '2026-09-30' }, '2026-10-01')).toBe('Ayer');
    expect(describirRango({ desde: '2026-09-28', hasta: '2026-10-01' }, '2026-10-01')).toMatch(/^Del 28 sept?\.? al 1 oct/);
    expect(describirRango({ desde: '2025-12-20', hasta: '2026-01-10' }, '2026-01-10')).toMatch(/2025.*2026/);
  });
});
