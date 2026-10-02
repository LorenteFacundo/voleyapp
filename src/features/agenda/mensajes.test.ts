import { describe, expect, it } from 'vitest';
import {
  cuandoParaMensaje, diaParaMensaje, mensajeCancelacion, mensajeCobro, mensajeConfirmacion, mensajePartido,
  mensajeRecordatorio,
} from './mensajes';

const HOY = '2026-10-01';
const turno = {
  club: 'Club Vóley Palermo',
  nombre: 'Juan Pérez',
  cancha: 'Cancha 1',
  inicio: '2026-10-01T22:00:00.000Z',
  fin: '2026-10-02T00:00:00.000Z',
  hoy: HOY,
};

describe('fechas en los mensajes', () => {
  it('usa hoy, mañana o la fecha completa', () => {
    expect(diaParaMensaje('2026-10-01', HOY)).toBe('hoy');
    expect(diaParaMensaje('2026-10-02', HOY)).toBe('mañana');
    expect(diaParaMensaje('2026-10-10', HOY)).toBe('el sábado 10 de octubre');
    expect(cuandoParaMensaje(turno.inicio, turno.fin, HOY)).toBe('hoy de 19:00 a 21:00');
  });
});

describe('mensajes al cliente', () => {
  it('confirma y recuerda la reserva saludando por el nombre', () => {
    expect(mensajeConfirmacion(turno)).toBe(
      '¡Hola Juan! Te confirmamos la reserva en Club Vóley Palermo: Cancha 1, hoy de 19:00 a 21:00. ¡Te esperamos! 🏐',
    );
    expect(mensajeRecordatorio({ ...turno, nombre: null })).toMatch(/^¡Hola! Te recordamos tu reserva/);
  });

  it('cobra el saldo con el alias del club', () => {
    expect(mensajeCobro({ ...turno, restante: 20000, alias: 'voley.palermo', titular: 'Club Vóley Palermo' })).toBe(
      '¡Hola Juan! Te escribimos de Club Vóley Palermo por la reserva de Cancha 1, hoy de 19:00 a 21:00. '
        + 'Quedan $20.000 por abonar. Podés transferir al alias voley.palermo (a nombre de Club Vóley Palermo). ¡Gracias!',
    );
    expect(mensajeCobro({ ...turno, restante: 20000, alias: null, titular: null })).not.toContain('alias');
  });

  it('avisa una cancelación con motivo y devolución', () => {
    const texto = mensajeCancelacion({ ...turno, motivo: 'Lluvia.', pagado: 10000 });
    expect(texto).toContain('tuvimos que cancelar tu reserva de Cancha 1, hoy de 19:00 a 21:00.');
    expect(texto).toContain('Motivo: Lluvia. Coordinemos la devolución de los $10.000 que abonaste.');
    expect(mensajeCancelacion({ ...turno, motivo: null, pagado: 0 })).not.toContain('Motivo');
  });

  it('comparte un partido abierto', () => {
    expect(mensajePartido({
      club: 'Club Vóley Palermo',
      cancha: 'Cancha 2',
      inicio: '2026-10-02T22:00:00.000Z',
      fin: '2026-10-03T00:00:00.000Z',
      hoy: HOY,
      nivel: 'Intermedio',
      precioPorJugador: 2500,
      cupoMaximo: 14,
      enlace: 'https://voley.app/partido/5',
    })).toBe([
      '🏐 Partido abierto en Club Vóley Palermo',
      'Mañana de 19:00 a 21:00 · Cancha 2',
      'Nivel intermedio · $2.500 por jugador · hasta 14 jugadores',
      '',
      'Anotate acá: https://voley.app/partido/5',
    ].join('\n'));
  });
});
