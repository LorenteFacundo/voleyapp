import { describe, expect, it } from 'vitest';
import type { BloqueDisponible } from '@/api/tipos';
import { encabezadoDeDia, libresCalculados, libresDeDisponibilidad, textoTurnosLibres } from './compartir';
import { crearHorario, crearOcupacion } from './fixtures';

const HOY = '2026-10-01'; // jueves
const canchas = [{ id: 1, titulo: 'Cancha 1' }, { id: 2, titulo: 'Cancha 2' }, { id: 3, titulo: 'Central' }];

function bloque(parcial: Partial<BloqueDisponible>): BloqueDisponible {
  return {
    horario_id: 1,
    cancha_id: 1,
    fecha: HOY,
    hora_inicio: '19:00',
    hora_fin: '21:00',
    inicio: '2026-10-01T22:00:00+00:00',
    fin: '2026-10-02T00:00:00+00:00',
    precio: 30000,
    sena: 10000,
    estado: 'libre',
    ocupacion_id: null,
    ...parcial,
  };
}

describe('encabezados de día', () => {
  it('nombra hoy, mañana y el resto', () => {
    expect(encabezadoDeDia('2026-10-01', HOY)).toBe('Hoy jueves 1');
    expect(encabezadoDeDia('2026-10-02', HOY)).toBe('Mañana viernes 2');
    expect(encabezadoDeDia('2026-10-03', HOY)).toBe('Sábado 3');
  });
});

describe('texto de turnos libres', () => {
  it('agrupa por día y junta canchas con el mismo horario y precio', () => {
    const libres = libresDeDisponibilidad([
      bloque({ cancha_id: 2, hora_inicio: '21:00', hora_fin: '23:00' }),
      bloque({ cancha_id: 1 }),
      bloque({ cancha_id: 1, hora_inicio: '21:00:00', hora_fin: '23:00:00' }),
      bloque({ cancha_id: 3, hora_inicio: '21:00', hora_fin: '23:00', precio: 35000 }),
      bloque({ cancha_id: 2, fecha: '2026-10-02', hora_inicio: '18:00', hora_fin: '20:00', precio: 0 }),
      bloque({ cancha_id: 2, estado: 'ocupado' }),
      bloque({ cancha_id: 3, estado: 'no_disponible' }),
    ]);
    const texto = textoTurnosLibres({
      club: 'Club Vóley Palermo',
      libres,
      canchas,
      hoy: HOY,
      cierre: 'Reservá acá: https://voley.app/club/voley-palermo',
    });
    expect(texto).toBe([
      '🏐 Turnos libres en Club Vóley Palermo',
      '',
      '*Hoy jueves 1*',
      '• 19:00–21:00 Cancha 1 ($30.000)',
      '• 21:00–23:00 Cancha 1 y Cancha 2 ($30.000)',
      '• 21:00–23:00 Central ($35.000)',
      '',
      '*Mañana viernes 2*',
      '• 18:00–20:00 Cancha 2',
      '',
      'Reservá acá: https://voley.app/club/voley-palermo',
    ].join('\n'));
  });

  it('no arma texto si no hay turnos y permite omitir el cierre', () => {
    expect(textoTurnosLibres({ club: 'X', libres: [], canchas, hoy: HOY, cierre: null })).toBeNull();
    const texto = textoTurnosLibres({ club: 'X', libres: libresDeDisponibilidad([bloque({})]), canchas, hoy: HOY, cierre: null });
    expect(texto?.endsWith('• 19:00–21:00 Cancha 1 ($30.000)')).toBe(true);
  });
});

describe('turnos libres calculados con la agenda', () => {
  const horarios = [
    crearHorario({ id: 1, cancha_id: 1, dia_semana: 4, hora_inicio: '19:00', hora_fin: '21:00' }),
    crearHorario({ id: 2, cancha_id: 2, dia_semana: 4, hora_inicio: '19:00', hora_fin: '21:00' }),
    crearHorario({ id: 3, cancha_id: 1, dia_semana: 4, hora_inicio: '23:00', hora_fin: '01:00' }),
    crearHorario({ id: 4, cancha_id: 1, dia_semana: 5, hora_inicio: '10:00', hora_fin: '12:00' }),
    crearHorario({ id: 5, cancha_id: 9, dia_semana: 4, hora_inicio: '19:00', hora_fin: '21:00' }),
  ];

  it('descarta bloques ocupados, pasados y de canchas inactivas', () => {
    const libres = libresCalculados({
      horarios,
      canchas: new Set([1, 2]),
      ocupaciones: [
        crearOcupacion({ cancha_id: 1 }),
        crearOcupacion({ cancha_id: 2, estado: 'cancelada' }),
        // El bloque de las 23 cruza la medianoche: lo pisa una reserva del viernes 00:30.
        crearOcupacion({ cancha_id: 1, inicio: '2026-10-02T03:30:00.000Z', fin: '2026-10-02T04:30:00.000Z' }),
      ],
      desde: HOY,
      hasta: '2026-10-02',
      ahora: Date.parse('2026-10-01T15:00:00.000Z'),
    });
    expect(libres).toEqual([
      { fecha: HOY, horaInicio: '19:00', horaFin: '21:00', canchaId: 2, precio: 30000 },
      { fecha: '2026-10-02', horaInicio: '10:00', horaFin: '12:00', canchaId: 1, precio: 30000 },
    ]);
  });

  it('no ofrece bloques que ya empezaron', () => {
    const calcular = (ahora: string) => libresCalculados({
      horarios: horarios.slice(1, 2),
      canchas: new Set([2]),
      ocupaciones: [],
      desde: HOY,
      hasta: HOY,
      ahora: Date.parse(ahora),
    });
    expect(calcular('2026-10-01T21:59:00.000Z')).toHaveLength(1);
    expect(calcular('2026-10-01T22:10:00.000Z')).toEqual([]);
  });
});
