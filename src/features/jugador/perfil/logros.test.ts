import { describe, expect, it } from 'vitest';
import { Award, Flame, Volleyball } from 'lucide-react';
import { iconoLogro, resumenLogros } from './logros';

describe('logros', () => {
  it('traduce el nombre del ícono guardado y usa uno genérico si no lo conoce', () => {
    expect(iconoLogro('Flame')).toBe(Flame);
    expect(iconoLogro('Volleyball')).toBe(Volleyball);
    expect(iconoLogro('Desconocido')).toBe(Award);
    expect(iconoLogro(null)).toBe(Award);
  });

  it('cuenta los logros obtenidos', () => {
    expect(resumenLogros([{ otorgado_at: '2026-10-01T12:00:00Z' }, { otorgado_at: null }])).toEqual({ obtenidos: 1, total: 2 });
    expect(resumenLogros(undefined)).toEqual({ obtenidos: 0, total: 0 });
  });
});
