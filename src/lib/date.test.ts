import { describe, expect, it } from 'vitest';
import {
  addDaysToISODate, diaSemana, diferenciaEnDias, fechaArgentina, formatDiaRelativo, formatDuracion, formatFechaCorta,
  formatRangoHorario, horaArgentina, inicioDeSemana, instanteArgentina, minutosAHora, todayArgentinaISO,
} from './date';

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

  it('convierte fecha y hora de pared a un instante y vuelve', () => {
    const instante = instanteArgentina('2026-10-05', '22:00');
    expect(instante).toBe('2026-10-06T01:00:00.000Z');
    expect(fechaArgentina(instante)).toBe('2026-10-05');
    expect(horaArgentina(instante)).toBe('22:00');
  });

  it('calcula día de semana, lunes de la semana y diferencias', () => {
    expect(diaSemana('2026-10-04')).toBe(0);
    expect(inicioDeSemana('2026-10-04')).toBe('2026-09-28');
    expect(inicioDeSemana('2026-09-28')).toBe('2026-09-28');
    expect(diferenciaEnDias('2026-09-28', '2026-10-04')).toBe(6);
  });

  it('formatea para mostrar', () => {
    expect(formatRangoHorario('2026-10-06T01:00:00.000Z', '2026-10-06T03:00:00.000Z')).toBe('22:00–00:00');
    expect(formatFechaCorta('2026-10-05')).toMatch(/lun.*5.*oct/);
    expect(formatDiaRelativo('2026-10-06', '2026-10-05')).toBe('Mañana');
    expect(formatDuracion(90)).toBe('1 h 30 min');
    expect(minutosAHora(1440 + 30)).toBe('00:30');
  });
});
