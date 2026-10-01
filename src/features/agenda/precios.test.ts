import { describe, expect, it } from 'vitest';
import { parsearMonto, redondearPrecio, sugerirPrecio } from './precios';
import { crearCancha, crearHorario } from './fixtures';

const cancha = crearCancha({ id: 1, precio_total: 28000 });
const JUEVES = 4;

describe('precio sugerido', () => {
  const horarios = [
    crearHorario({ id: 1, cancha_id: 1, dia_semana: JUEVES, hora_inicio: '19:00', hora_fin: '21:00', precio_total: 30000 }),
    crearHorario({ id: 2, cancha_id: 1, dia_semana: JUEVES, hora_inicio: '21:00', hora_fin: '23:00', precio_total: 36000 }),
    crearHorario({ id: 3, cancha_id: 1, dia_semana: 1, hora_inicio: '10:00', hora_fin: '12:00', precio_total: 20000 }),
    crearHorario({ id: 4, cancha_id: 2, dia_semana: JUEVES, hora_inicio: '19:00', hora_fin: '21:00', precio_total: 50000 }),
  ];

  it('usa el precio exacto del bloque publicado', () => {
    expect(sugerirPrecio({ horarios, cancha, dia: JUEVES, rango: { inicio: 1140, fin: 1260 } }))
      .toEqual({ precio: 30000, origen: 'bloque', detalle: 'Precio del bloque publicado.' });
  });

  it('calcula proporcional al bloque que más se superpone', () => {
    // 20:30 a 22:00: se superpone 30 min con el de 19 y 60 min con el de 21 ($300/min).
    expect(sugerirPrecio({ horarios, cancha, dia: JUEVES, rango: { inicio: 1230, fin: 1320 } }))
      .toMatchObject({ precio: 27000, origen: 'proporcional' });
    // 19:00 a 20:30: 90 minutos del bloque de $30.000 por 120.
    expect(sugerirPrecio({ horarios, cancha, dia: JUEVES, rango: { inicio: 1140, fin: 1230 } }))
      .toMatchObject({ precio: 22500, detalle: 'Proporcional al bloque de 19:00 a 21:00.' });
  });

  it('si no hay superposición usa el bloque más cercano', () => {
    expect(sugerirPrecio({ horarios, cancha, dia: JUEVES, rango: { inicio: 1020, fin: 1080 } }))
      .toMatchObject({ precio: 15000, origen: 'proporcional' });
  });

  it('si ese día no hay bloques, usa los de otros días de la cancha', () => {
    expect(sugerirPrecio({ horarios, cancha, dia: 6, rango: { inicio: 600, fin: 660 } }))
      .toMatchObject({ precio: 10000, origen: 'proporcional' });
  });

  it('respeta los bloques que terminan a la medianoche', () => {
    const nocturnos = [crearHorario({ hora_inicio: '22:00', hora_fin: '00:00', precio_total: 40000 })];
    expect(sugerirPrecio({ horarios: nocturnos, cancha, dia: JUEVES, rango: { inicio: 1320, fin: 1440 } }))
      .toMatchObject({ precio: 40000, origen: 'bloque' });
  });

  it('cae al precio base de la cancha y, si no hay, no sugiere nada', () => {
    expect(sugerirPrecio({ horarios: [], cancha, dia: JUEVES, rango: { inicio: 600, fin: 660 } }))
      .toEqual({ precio: 28000, origen: 'cancha', detalle: 'Precio base de la cancha.' });
    expect(sugerirPrecio({ horarios: [], cancha: crearCancha({ precio_total: 0 }), dia: JUEVES, rango: { inicio: 600, fin: 660 } }))
      .toBeNull();
    expect(sugerirPrecio({ horarios, cancha: undefined, dia: JUEVES, rango: { inicio: 600, fin: 660 } })).toBeNull();
  });

  it('ignora bloques inactivos o de otras canchas', () => {
    const otros = [
      crearHorario({ cancha_id: 2, precio_total: 50000 }),
      crearHorario({ cancha_id: 1, activo: false, precio_total: 99000 }),
    ];
    expect(sugerirPrecio({ horarios: otros, cancha, dia: JUEVES, rango: { inicio: 1140, fin: 1260 } }))
      .toMatchObject({ origen: 'cancha', precio: 28000 });
  });
});

describe('montos', () => {
  it('redondea a la centena', () => {
    expect(redondearPrecio(22537)).toBe(22500);
    expect(redondearPrecio(22550)).toBe(22600);
  });

  it('interpreta lo que se escribe', () => {
    expect(parsearMonto('$ 30.000')).toBe(30000);
    expect(parsearMonto('1500,5')).toBe(1500.5);
    expect(parsearMonto('')).toBeNull();
    expect(parsearMonto('abc')).toBeNull();
  });
});
