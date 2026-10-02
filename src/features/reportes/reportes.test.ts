import { describe, expect, it } from 'vitest';
import {
  agruparValles, armarMapaCalor, distribucionOrigen, horasValle, nivelCalor, ordenarHoras, ratioOcupacion,
  resumenCancelaciones, textoHoras, textoPorcentaje,
} from './reportes';

describe('ocupación', () => {
  it('calcula la proporción y la muestra como porcentaje', () => {
    expect(ratioOcupacion(45, 60)).toBe(0.75);
    expect(ratioOcupacion(10, 0)).toBeNull();
    expect(textoPorcentaje(0.625)).toBe('63%');
    expect(textoPorcentaje(1.12)).toBe('112%');
    expect(textoPorcentaje(null)).toBe('—');
    expect(textoHoras(7440)).toBe('124 h');
    expect(textoHoras(750)).toBe('12,5 h');
  });

  it('clasifica la ocupación en cinco niveles más "sin horario"', () => {
    expect([null, 0, 0.1, 0.25, 0.49, 0.5, 0.74, 0.75, 1.3].map(nivelCalor)).toEqual([-1, 0, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('mapa de calor', () => {
  it('ordena las horas y deja la madrugada al final si el club abre de noche', () => {
    expect(ordenarHoras([20, 9, 0, 23, 9, 1])).toEqual([9, 20, 23, 0, 1]);
    expect(ordenarHoras([3, 1, 2])).toEqual([1, 2, 3]);
  });

  it('arma filas de lunes a domingo solo con horas que tienen horario', () => {
    const mapa = armarMapaCalor([
      { dia: 1, hora: 19, ocupados: 60, disponibles: 120 },
      { dia: 0, hora: 10, ocupados: 0, disponibles: 60 },
      // Reserva fuera del horario publicado: no agrega columna.
      { dia: 3, hora: 7, ocupados: 60, disponibles: 0 },
    ]);
    expect(mapa.horas).toEqual([10, 19]);
    expect(mapa.filas.map((fila) => fila.dia)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(mapa.filas[0].celdas[1]).toEqual({ dia: 1, hora: 19, ocupados: 60, disponibles: 120, ratio: 0.5, nivel: 3 });
    expect(mapa.filas[0].celdas[0].nivel).toBe(-1);
    expect(mapa.filas[6].celdas[0].nivel).toBe(0);
  });
});

describe('horas valle', () => {
  const calor = [
    { dia: 2, hora: 15, ocupados: 0, disponibles: 240 },
    { dia: 2, hora: 16, ocupados: 0, disponibles: 240 },
    { dia: 2, hora: 17, ocupados: 60, disponibles: 240 },
    { dia: 4, hora: 15, ocupados: 0, disponibles: 120 },
    { dia: 5, hora: 21, ocupados: 240, disponibles: 240 },
    { dia: 6, hora: 9, ocupados: 0, disponibles: 30 },
    { dia: 1, hora: 18, ocupados: 110, disponibles: 240 },
  ];

  it('elige las franjas menos ocupadas con disponibilidad real', () => {
    const valles = horasValle(calor);
    expect(valles.map((c) => `${c.dia}-${c.hora}`)).toEqual(['2-15', '2-16', '4-15', '2-17', '1-18']);
    expect(horasValle(calor, { maximo: 3 })).toHaveLength(3);
    expect(horasValle([{ dia: 5, hora: 21, ocupados: 200, disponibles: 240 }])).toEqual([]);
  });

  it('junta horas seguidas del mismo día', () => {
    expect(agruparValles(horasValle(calor))).toEqual([
      { dia: 1, desde: 18, hasta: 19, ratio: 110 / 240 },
      { dia: 2, desde: 15, hasta: 18, ratio: 60 / 720 },
      { dia: 4, desde: 15, hasta: 16, ratio: 0 },
    ]);
  });
});

describe('origen y cancelaciones', () => {
  it('reparte las reservas por origen en un orden fijo', () => {
    const distribucion = distribucionOrigen({ whatsapp: 6, app: 2, fijo: 12 });
    expect(distribucion.map((item) => item.origen)).toEqual(['app', 'whatsapp', 'telefono', 'mostrador', 'fijo', 'otro']);
    expect(distribucion[4]).toEqual({ origen: 'fijo', cantidad: 12, proporcion: 0.6 });
    expect(distribucionOrigen({}).every((item) => item.proporcion === 0)).toBe(true);
  });

  it('resume las cancelaciones por quién canceló', () => {
    expect(resumenCancelaciones({ jugador: 3, sistema: 1, otro: 0 })).toEqual({
      total: 4,
      detalle: [
        { clave: 'jugador', etiqueta: 'Por jugadores', cantidad: 3 },
        { clave: 'sistema', etiqueta: 'Vencidas sin respuesta', cantidad: 1 },
      ],
    });
  });
});
