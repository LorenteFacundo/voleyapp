import { describe, expect, it } from 'vitest';
import {
  altoDelRango, armarGrilla, asignarCarriles, bloquesLibres, diaDe, duracionHabitual, filasDelRango, horarioEnDia,
  horariosDelDia, intervaloDeHorario, textoDeTramo, libresVigentes, minutoEnDia, minutoInicialDeScroll, ocupacionesPorDia, posicion, rangoDelDia,
  recortar, restarIntervalos, tramoEnDia,
} from './layout';
import { crearCancha, crearHorario, crearOcupacion } from './fixtures';

describe('bloques publicados', () => {
  it('pasa horarios a minutos y extiende los que cruzan la medianoche', () => {
    expect(intervaloDeHorario({ hora_inicio: '19:00', hora_fin: '21:00' })).toEqual({ inicio: 1140, fin: 1260 });
    expect(intervaloDeHorario({ hora_inicio: '22:00', hora_fin: '00:00' })).toEqual({ inicio: 1320, fin: 1440 });
    expect(intervaloDeHorario({ hora_inicio: '23:00', hora_fin: '01:00' })).toEqual({ inicio: 1380, fin: 1500 });
    expect(intervaloDeHorario({ hora_inicio: '08:30:00', hora_fin: '10:00:00' })).toEqual({ inicio: 510, fin: 600 });
  });

  it('filtra los bloques activos del día y de las canchas visibles', () => {
    const horarios = [
      crearHorario({ id: 1, dia_semana: 4, cancha_id: 1 }),
      crearHorario({ id: 2, dia_semana: 5, cancha_id: 1 }),
      crearHorario({ id: 3, dia_semana: 4, cancha_id: 2, activo: false }),
      crearHorario({ id: 4, dia_semana: 4, cancha_id: 3 }),
    ];
    expect(horariosDelDia(horarios, 4, new Set([1, 2])).map((h) => h.id)).toEqual([1]);
  });

  it('recorta intervalos al día', () => {
    expect(recortar({ inicio: 1380, fin: 1500 })).toEqual({ inicio: 1380, fin: 1440 });
    expect(recortar({ inicio: 1500, fin: 1560 })).toBeNull();
  });
});

describe('ocupaciones dentro del día', () => {
  const lunes = diaDe('2026-10-05');

  it('calcula el inicio del día en Buenos Aires', () => {
    expect(lunes.origen).toBe(Date.parse('2026-10-05T03:00:00.000Z'));
    expect(lunes.largo).toBe(1440);
  });

  it('ubica una reserva en minutos desde las 00:00', () => {
    expect(tramoEnDia('2026-10-05T22:00:00.000Z', '2026-10-06T00:00:00.000Z', lunes))
      .toEqual({ inicio: 1140, fin: 1260, desdeAntes: false, sigueDespues: false });
    // Formato con desfase, como lo devuelve Postgres.
    expect(tramoEnDia('2026-10-05T22:00:00+00:00', '2026-10-06T00:00:00+00:00', lunes)?.inicio).toBe(1140);
  });

  it('recorta una reserva que cruza la medianoche en los dos días', () => {
    const inicio = '2026-10-06T02:00:00.000Z'; // lunes 23:00
    const fin = '2026-10-06T04:00:00.000Z'; // martes 01:00
    expect(tramoEnDia(inicio, fin, lunes)).toEqual({ inicio: 1380, fin: 1440, desdeAntes: false, sigueDespues: true });
    expect(tramoEnDia(inicio, fin, diaDe('2026-10-06'))).toEqual({ inicio: 0, fin: 60, desdeAntes: true, sigueDespues: false });
    expect(tramoEnDia(inicio, fin, diaDe('2026-10-07'))).toBeNull();
  });

  it('un bloqueo de varios días ocupa el día entero', () => {
    expect(tramoEnDia('2026-10-04T03:00:00.000Z', '2026-10-08T03:00:00.000Z', lunes))
      .toEqual({ inicio: 0, fin: 1440, desdeAntes: true, sigueDespues: true });
  });

  it('ubica la hora actual solo si cae en el día', () => {
    expect(minutoEnDia(Date.parse('2026-10-05T22:30:00.000Z'), lunes)).toBe(1170);
    expect(minutoEnDia(Date.parse('2026-10-06T03:00:00.000Z'), lunes)).toBeNull();
    expect(minutoEnDia(Date.parse('2026-10-05T02:59:00.000Z'), lunes)).toBeNull();
  });
});

describe('franja visible', () => {
  it('usa 08:00–24:00 cuando no hay horarios ni reservas', () => {
    expect(rangoDelDia([], [])).toEqual({ inicio: 480, fin: 1440 });
  });

  it('va del primer al último bloque publicado', () => {
    expect(rangoDelDia([{ inicio: 1080, fin: 1200 }, { inicio: 1200, fin: 1320 }], [])).toEqual({ inicio: 1080, fin: 1320 });
    expect(rangoDelDia([{ inicio: 1320, fin: 1440 }], [])).toEqual({ inicio: 1320, fin: 1440 });
  });

  it('recorta a la medianoche los bloques que la cruzan', () => {
    expect(rangoDelDia([{ inicio: 1200, fin: 1260 }, { inicio: 1380, fin: 1500 }], [])).toEqual({ inicio: 1200, fin: 1440 });
  });

  it('se amplía para mostrar reservas fuera de horario y se alinea a medias horas', () => {
    expect(rangoDelDia([{ inicio: 1080, fin: 1320 }], [{ inicio: 975, fin: 1020 }])).toEqual({ inicio: 960, fin: 1320 });
    expect(rangoDelDia([{ inicio: 1080, fin: 1320 }], [{ inicio: 1390, fin: 1430 }])).toEqual({ inicio: 1080, fin: 1440 });
    expect(rangoDelDia([], [{ inicio: 300, fin: 390 }])).toEqual({ inicio: 300, fin: 1440 });
  });

  it('siempre muestra al menos una hora', () => {
    expect(rangoDelDia([{ inicio: 600, fin: 630 }], [])).toEqual({ inicio: 600, fin: 660 });
    expect(rangoDelDia([{ inicio: 1410, fin: 1440 }], [])).toEqual({ inicio: 1380, fin: 1440 });
  });

  it('arma las filas y el alto de la grilla', () => {
    expect(filasDelRango({ inicio: 1080, fin: 1200 })).toEqual([1080, 1110, 1140, 1170]);
    expect(altoDelRango({ inicio: 1080, fin: 1200 })).toBe(180);
  });
});

describe('posiciones', () => {
  const rango = { inicio: 1080, fin: 1320 };

  it('calcula top y alto en píxeles', () => {
    expect(posicion({ inicio: 1140, fin: 1260 }, rango)).toEqual({ top: 90, height: 180 });
  });

  it('recorta al rango visible y respeta un alto mínimo', () => {
    expect(posicion({ inicio: 1000, fin: 1100 }, rango)).toEqual({ top: 0, height: 30 });
    expect(posicion({ inicio: 1080, fin: 1085 }, rango)).toEqual({ top: 0, height: 20 });
    expect(posicion({ inicio: 1300, fin: 1400 }, rango)).toEqual({ top: 330, height: 30 });
  });

  it('reparte en carriles lo que se superpone', () => {
    const resultado = asignarCarriles([
      { inicio: 60, fin: 120, id: 'c' },
      { inicio: 0, fin: 60, id: 'a' },
      { inicio: 30, fin: 90, id: 'b' },
      { inicio: 200, fin: 260, id: 'd' },
    ]);
    const porId = Object.fromEntries(resultado.map((item) => [item.id, [item.carril, item.carriles]]));
    expect(porId).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });
});

describe('bloques libres', () => {
  const horarios = [
    crearHorario({ id: 1, cancha_id: 1, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 30000 }),
    crearHorario({ id: 2, cancha_id: 1, hora_inicio: '20:00', hora_fin: '22:00', precio_total: 32000 }),
    crearHorario({ id: 3, cancha_id: 2, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 25000 }),
  ];

  it('resta intervalos ocupados', () => {
    expect(restarIntervalos({ inicio: 1080, fin: 1200 }, [{ inicio: 1110, fin: 1140 }]))
      .toEqual([{ inicio: 1080, fin: 1110 }, { inicio: 1140, fin: 1200 }]);
    expect(restarIntervalos({ inicio: 1080, fin: 1200 }, [{ inicio: 1150, fin: 1300 }, { inicio: 1000, fin: 1090 }]))
      .toEqual([{ inicio: 1090, fin: 1150 }]);
    expect(restarIntervalos({ inicio: 1080, fin: 1200 }, [{ inicio: 1000, fin: 1300 }])).toEqual([]);
  });

  it('oculta los bloques ocupados y ordena por hora y cancha', () => {
    const libres = bloquesLibres(horarios, [{ canchaId: 1, inicio: 1080, fin: 1200 }]);
    expect(libres.map((libre) => [libre.canchaId, libre.inicio, libre.fin, libre.precio, libre.completo])).toEqual([
      [2, 1080, 1200, 25000, true],
      [1, 1200, 1320, 32000, true],
    ]);
  });

  it('muestra lo que queda libre de un bloque ocupado en parte', () => {
    const libres = bloquesLibres(horarios.slice(0, 1), [{ canchaId: 1, inicio: 1140, fin: 1200 }]);
    expect(libres).toHaveLength(1);
    expect(libres[0]).toMatchObject({ inicio: 1080, fin: 1140, completo: false, bloque: { inicio: 1080, fin: 1200 } });
  });

  it('descarta restos demasiado cortos', () => {
    expect(bloquesLibres(horarios.slice(0, 1), [{ canchaId: 1, inicio: 1095, fin: 1200 }])).toEqual([]);
  });

  it('no mezcla canchas', () => {
    expect(bloquesLibres(horarios.slice(2), [{ canchaId: 1, inicio: 1080, fin: 1200 }])).toHaveLength(1);
  });

  it('un bloque que cruza la medianoche se ofrece completo con su horario real', () => {
    const [libre] = bloquesLibres([crearHorario({ hora_inicio: '23:00', hora_fin: '01:00' })], []);
    expect(libre).toMatchObject({ inicio: 1380, fin: 1440, completo: true, bloque: { inicio: 1380, fin: 1500 } });
  });
});

describe('duración habitual', () => {
  it('elige la duración más repetida de la cancha', () => {
    const horarios = [
      crearHorario({ id: 1, hora_inicio: '18:00', hora_fin: '20:00' }),
      crearHorario({ id: 2, hora_inicio: '20:00', hora_fin: '22:00' }),
      crearHorario({ id: 3, hora_inicio: '22:00', hora_fin: '23:30' }),
      crearHorario({ id: 4, cancha_id: 2, hora_inicio: '10:00', hora_fin: '11:00' }),
    ];
    expect(duracionHabitual(horarios, 1)).toBe(120);
    expect(duracionHabitual(horarios, 2)).toBe(60);
    expect(duracionHabitual(horarios, 3)).toBe(60);
    expect(duracionHabitual(horarios, 3, 90)).toBe(90);
  });
});

describe('armado de la grilla', () => {
  const canchas = [
    crearCancha({ id: 1 }),
    crearCancha({ id: 2, titulo: 'Cancha 2' }),
    crearCancha({ id: 3, titulo: 'Vieja', activa: false }),
  ];
  const horarios = [
    crearHorario({ id: 1, cancha_id: 1, dia_semana: 4, hora_inicio: '18:00', hora_fin: '20:00' }),
    crearHorario({ id: 2, cancha_id: 2, dia_semana: 4, hora_inicio: '19:00', hora_fin: '23:00' }),
    crearHorario({ id: 3, cancha_id: 3, dia_semana: 4, hora_inicio: '08:00', hora_fin: '10:00' }),
  ];

  it('arma columnas, franja, tramos y libres del día', () => {
    const grilla = armarGrilla({
      fecha: '2026-10-01',
      canchas,
      horarios,
      ocupaciones: [
        crearOcupacion({ id: 1, cancha_id: 1 }),
        crearOcupacion({
          id: 2, cancha_id: 2, tipo: 'bloqueo', cliente: null, titulo: 'Lluvia',
          inicio: '2026-10-01T03:00:00.000Z', fin: '2026-10-02T03:00:00.000Z',
        }),
        crearOcupacion({ id: 3, cancha_id: 1, inicio: '2026-10-02T22:00:00.000Z', fin: '2026-10-03T00:00:00.000Z' }),
      ],
    });
    expect(grilla.columnas.map((columna) => columna.cancha.id)).toEqual([1, 2]);
    // El bloqueo de todo el día no estira la franja de 18 a 23.
    expect(grilla.rango).toEqual({ inicio: 1080, fin: 1380 });
    expect(grilla.tramos.map((item) => item.ocupacion.id)).toEqual([1, 2]);
    expect(grilla.libres.map((libre) => [libre.canchaId, libre.inicio, libre.fin, libre.completo])).toEqual([[1, 1080, 1140, false]]);
    expect(grilla.hayHorarios).toBe(true);
  });

  it('un bloqueo fuera de la franja la amplía; uno de todo el día no', () => {
    const corto = crearOcupacion({
      id: 5, cancha_id: 1, tipo: 'bloqueo', cliente: null, titulo: 'Mantenimiento',
      inicio: '2026-10-01T12:00:00.000Z', fin: '2026-10-01T15:00:00.000Z',
    });
    expect(armarGrilla({ fecha: '2026-10-01', canchas, horarios, ocupaciones: [corto] }).rango).toEqual({ inicio: 540, fin: 1380 });
    const parcial = { ...corto, inicio: '2026-10-01T15:00:00.000Z', fin: '2026-10-01T23:00:00.000Z' };
    expect(armarGrilla({ fecha: '2026-10-01', canchas, horarios, ocupaciones: [parcial] }).rango).toEqual({ inicio: 1080, fin: 1380 });
  });

  it('ordena las columnas como en el club', () => {
    const desordenadas = [crearCancha({ id: 8, titulo: 'B', orden: 2 }), crearCancha({ id: 9, titulo: 'A', orden: 2 }), crearCancha({ id: 7, orden: 1 })];
    expect(armarGrilla({ fecha: '2026-10-01', canchas: desordenadas, horarios: [], ocupaciones: [] }).columnas.map((c) => c.cancha.id))
      .toEqual([7, 9, 8]);
  });

  it('agrega las canchas inactivas que tienen algo ese día', () => {
    const grilla = armarGrilla({ fecha: '2026-10-01', canchas, horarios: [], ocupaciones: [crearOcupacion({ cancha_id: 3 })] });
    expect(grilla.columnas.map((columna) => [columna.cancha.id, columna.inactiva])).toEqual([[1, false], [2, false], [3, true]]);
    expect(grilla.rango).toEqual({ inicio: 480, fin: 1440 });
    expect(grilla.hayHorarios).toBe(false);
  });

  it('solo ofrece libres que no pasaron', () => {
    const libres = bloquesLibres([
      crearHorario({ id: 1, hora_inicio: '18:00', hora_fin: '20:00' }),
      crearHorario({ id: 2, hora_inicio: '20:00', hora_fin: '22:00' }),
    ], []);
    expect(libresVigentes(libres, '2026-09-30', '2026-10-01', null)).toEqual([]);
    expect(libresVigentes(libres, '2026-10-02', '2026-10-01', null)).toHaveLength(2);
    expect(libresVigentes(libres, '2026-10-01', '2026-10-01', 1210).map((libre) => libre.inicio)).toEqual([1200]);
  });

  it('elige dónde arranca el desplazamiento', () => {
    const rango = { inicio: 480, fin: 1440 };
    expect(minutoInicialDeScroll({ rango, minutoAhora: 1170, primeros: [] })).toBe(1110);
    expect(minutoInicialDeScroll({ rango, minutoAhora: null, primeros: [1140, 1080] })).toBe(1050);
    expect(minutoInicialDeScroll({ rango: { inicio: 1080, fin: 1440 }, minutoAhora: 600, primeros: [] })).toBe(1080);
    expect(minutoInicialDeScroll({ rango, minutoAhora: null, primeros: [] })).toBe(480);
  });
});

describe('lista semanal', () => {
  const dias = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];

  it('pone cada reserva el día que empieza y los bloqueos en todos los días que tocan', () => {
    const jueves = crearOcupacion({ id: 1 });
    const trasnoche = crearOcupacion({ id: 2, inicio: '2026-10-02T02:00:00.000Z', fin: '2026-10-02T04:00:00.000Z' });
    const finde = crearOcupacion({
      id: 3, tipo: 'bloqueo', cliente: null, titulo: 'Torneo', inicio: '2026-10-02T03:00:00.000Z', fin: '2026-10-04T03:00:00.000Z',
    });
    const domingoAnterior = crearOcupacion({ id: 4, inicio: '2026-09-28T02:00:00.000Z', fin: '2026-09-28T04:00:00.000Z' });
    const porDia = ocupacionesPorDia([finde, trasnoche, jueves, domingoAnterior], dias);
    const ids = (fecha: string) => porDia.get(fecha)?.map((ocupacion) => ocupacion.id);
    expect(ids('2026-09-28')).toEqual([4]);
    expect(ids('2026-10-01')).toEqual([1, 2]);
    expect(ids('2026-10-02')).toEqual([3]);
    expect(ids('2026-10-03')).toEqual([3]);
    expect(ids('2026-10-04')).toEqual([]);
  });
});

describe('horario visible en un día', () => {
  it('muestra el tramo del día o todo el día', () => {
    const viernes = diaDe('2026-10-02');
    expect(horarioEnDia('2026-10-02T03:00:00.000Z', '2026-10-04T03:00:00.000Z', viernes)).toBe('Todo el día');
    expect(horarioEnDia('2026-10-02T15:00:00.000Z', '2026-10-04T03:00:00.000Z', viernes)).toBe('12:00–00:00');
    expect(horarioEnDia('2026-10-05T15:00:00.000Z', '2026-10-05T18:00:00.000Z', viernes)).toBe('');
    expect(textoDeTramo({ inicio: 1140, fin: 1260 })).toBe('19:00–21:00');
  });
});
