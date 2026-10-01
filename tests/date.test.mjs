import assert from 'node:assert/strict';
import test from 'node:test';
import { addDaysToISODate, todayArgentinaISO } from '../src/lib/date.ts';

test('calcula hoy según Buenos Aires, no según UTC', () => {
  assert.equal(todayArgentinaISO(new Date('2026-09-29T02:30:00.000Z')), '2026-09-28');
});

test('suma días de calendario atravesando año nuevo', () => {
  assert.equal(addDaysToISODate('2026-12-30', 3), '2027-01-02');
});

test('rechaza fechas inexistentes y cantidades fraccionarias', () => {
  assert.throws(() => addDaysToISODate('2026-02-31', 1), /Fecha inválida/);
  assert.throws(() => addDaysToISODate('2026-09-29', 1.5), /Fecha inválida/);
});
