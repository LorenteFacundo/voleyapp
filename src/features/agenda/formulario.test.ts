import { describe, expect, it } from 'vitest';
import {
  duracionEntre, errorDeDuracion, errorDeHora, horaDeFin, proximaMediaHora, terminaAlDiaSiguiente, textoDuracion,
} from './formulario';

describe('horas de los formularios', () => {
  it('valida horas en múltiplos de 5 minutos', () => {
    expect(errorDeHora('19:05')).toBeNull();
    expect(errorDeHora('19:07')).toMatch(/múltiplos de 5/);
    expect(errorDeHora('')).toMatch(/Elegí una hora/);
    expect(errorDeHora('25:00')).toMatch(/Elegí una hora/);
  });

  it('valida duraciones como el servidor', () => {
    expect(errorDeDuracion(60)).toBeNull();
    expect(errorDeDuracion(10)).toMatch(/al menos 15/);
    expect(errorDeDuracion(13 * 60)).toMatch(/más de 12 horas/);
    expect(errorDeDuracion(8 * 24 * 60, 7 * 24)).toMatch(/más de 168 horas/);
    expect(errorDeDuracion(62)).toMatch(/múltiplos de 5/);
  });

  it('calcula duraciones y fines que cruzan la medianoche', () => {
    expect(duracionEntre('19:00', '21:00')).toBe(120);
    expect(duracionEntre('23:00', '01:00')).toBe(120);
    expect(duracionEntre('20:00', '20:00')).toBe(1440);
    expect(horaDeFin('23:00', 120)).toBe('01:00');
    expect(terminaAlDiaSiguiente('23:00', 120)).toBe(true);
    expect(terminaAlDiaSiguiente('22:00', 120)).toBe(false);
  });

  it('propone la próxima media hora', () => {
    expect(proximaMediaHora(19 * 60 + 42)).toBe('20:00');
    expect(proximaMediaHora(19 * 60)).toBe('19:00');
    expect(proximaMediaHora(23 * 60 + 50)).toBe('23:30');
  });

  it('muestra duraciones', () => {
    expect(textoDuracion(90)).toBe('1 h 30 min');
    expect(textoDuracion(45)).toBe('45 min');
    expect(textoDuracion(120)).toBe('2 h');
  });
});
