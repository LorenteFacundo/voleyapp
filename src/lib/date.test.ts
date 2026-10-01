import { describe, expect, it } from 'vitest';
import { addDaysToISODate, todayArgentinaISO } from './date';

describe('fechas en hora de Argentina', () => {
  it('calcula hoy según Buenos Aires, no según UTC', () => {
    expect(todayArgentinaISO(new Date('2026-09-29T02:30:00.000Z'))).toBe('2026-09-28');
  });

  it('suma días de calendario atravesando año nuevo', () => {
    expect(addDaysToISODate('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('rechaza fechas inexistentes y cantidades fraccionarias', () => {
    expect(() => addDaysToISODate('2026-02-31', 1)).toThrow(/Fecha inválida/);
    expect(() => addDaysToISODate('2026-09-29', 1.5)).toThrow(/Fecha inválida/);
  });
});
