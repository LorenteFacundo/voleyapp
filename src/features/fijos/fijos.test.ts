import { describe, expect, it } from 'vitest';
import type { HorarioPublicado } from '@/api/tipos';
import {
  DURACIONES, agruparPorDia, cambiaHorario, describirFijoParaMensaje, describirHorario, duracionDeBloque, fechasCortas,
  horaFin, precioSugerido, proximaFecha, puedeConfirmarFechas, validarHorario,
} from './fijos';

const bloque = (cambios: Partial<HorarioPublicado>): HorarioPublicado => ({
  id: 1, cancha_id: 10, dia_semana: 2, hora_inicio: '19:00', hora_fin: '20:30', precio_total: 36000, precio_sena: 0, activo: true,
  ...cambios,
});

describe('horarios de un fijo', () => {
  it('calcula la hora de fin, incluso pasando la medianoche', () => {
    expect(horaFin('19:00', 90)).toBe('20:30');
    expect(horaFin('23:30', 90)).toBe('01:00');
    expect(describirHorario(2, '19:00', 90)).toBe('Martes 19:00–20:30');
    expect(describirFijoParaMensaje(2, '19:00')).toBe('el fijo de los martes 19:00');
    expect(describirFijoParaMensaje(6, '10:00')).toBe('el fijo de los sábados 10:00');
  });

  it('ofrece duraciones de 30 minutos a 12 horas de a 15', () => {
    expect(DURACIONES[0]).toBe(30);
    expect(DURACIONES.at(-1)).toBe(720);
    expect(DURACIONES).toHaveLength(47);
  });

  it('valida igual que el servidor', () => {
    expect(validarHorario({ canchaId: 1, dia: 2, hora: '19:30', duracion: 90 })).toEqual({});
    expect(validarHorario({ canchaId: null, dia: 7, hora: '19:32', duracion: 100 })).toEqual({
      canchaId: 'Elegí la cancha.',
      dia: 'Elegí el día.',
      hora: 'Usá minutos múltiplos de 5 (por ejemplo 19:00 o 19:30).',
      duracion: 'La duración debe ser de 30 minutos a 12 horas, en tramos de 15 minutos.',
    });
    expect(validarHorario({ canchaId: 1, dia: 0, hora: '25:00', duracion: 60 }).hora).toMatch(/Ingresá/);
  });

  it('propone la próxima fecha del día elegido', () => {
    // 2026-10-01 es jueves.
    expect(proximaFecha(4, '2026-10-01')).toBe('2026-10-01');
    expect(proximaFecha(4, '2026-10-01', '21:00', '18:00')).toBe('2026-10-01');
    expect(proximaFecha(4, '2026-10-01', '18:00', '18:00')).toBe('2026-10-08');
    expect(proximaFecha(1, '2026-10-01')).toBe('2026-10-05');
    expect(proximaFecha(3, '2026-10-01')).toBe('2026-10-07');
  });

  it('sugiere el precio del bloque publicado que coincide', () => {
    const horarios = [bloque({}), bloque({ id: 2, hora_inicio: '20:30', hora_fin: '22:00', precio_total: 40000 })];
    expect(precioSugerido(horarios, { canchaId: 10, dia: 2, hora: '19:00', duracion: 90 })).toBe(36000);
    expect(precioSugerido(horarios, { canchaId: 10, dia: 2, hora: '20:30', duracion: 90 })).toBe(40000);
    expect(precioSugerido(horarios, { canchaId: 10, dia: 2, hora: '19:00', duracion: 60 })).toBeNull();
    expect(precioSugerido([bloque({ activo: false })], { canchaId: 10, dia: 2, hora: '19:00', duracion: 90 })).toBeNull();
    expect(duracionDeBloque(horarios, 10, 2, '20:30')).toBe(90);
    expect(duracionDeBloque([bloque({ hora_inicio: '23:00', hora_fin: '01:00' })], 10, 2, '23:00')).toBe(120);
    expect(duracionDeBloque(horarios, 10, 3, '20:30')).toBeNull();
  });

  it('detecta si cambia el horario', () => {
    const base = { canchaId: 1, dia: 2, hora: '19:00', duracion: 90 };
    expect(cambiaHorario(base, { ...base })).toBe(false);
    expect(cambiaHorario(base, { ...base, duracion: 120 })).toBe(true);
    expect(cambiaHorario(base, { ...base, canchaId: 2 })).toBe(true);
  });

  it('agrupa de lunes a domingo y formatea fechas', () => {
    const grupos = agruparPorDia([{ dia_semana: 0, id: 'd' }, { dia_semana: 2, id: 'm' }, { dia_semana: 1, id: 'l' }]);
    expect(grupos.map((grupo) => grupo.dia)).toEqual([1, 2, 0]);
    expect(fechasCortas(['2026-10-12', '2026-10-19'])).toBe('12/10, 19/10');
  });

  it('solo deja guardar si no hay choques sin resolver ni un fijo vacío', () => {
    const vista = { fechas: 12, horizonte: '2026-12-24', conflictos: [] as unknown[] };
    expect(puedeConfirmarFechas(vista, false, '2026-10-06')).toBe(true);
    expect(puedeConfirmarFechas({ ...vista, conflictos: [{}] }, false, '2026-10-06')).toBe(false);
    expect(puedeConfirmarFechas({ ...vista, conflictos: [{}] }, true, '2026-10-06')).toBe(true);
    expect(puedeConfirmarFechas({ ...vista, fechas: 0 }, false, '2026-10-06')).toBe(false);
    expect(puedeConfirmarFechas({ ...vista, fechas: 0 }, false, '2027-02-01')).toBe(true);
  });
});
