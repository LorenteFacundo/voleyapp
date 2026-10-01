import { describe, expect, it } from 'vitest';
import { precioPorJugador, precioSugerido, progresoCupo, textoCupo } from './cupo';
import { esPartidoNoEncontrado, evaluarInscripcion, partidoTerminado, presentarEstadoPartido } from './estado';
import { enlaceInvitacion, textoInvitacion } from './compartir';
import {
  formularioDesdePartido, formularioPartidoInicial, leerMonto, textoPrecio, validarFormularioPartido,
} from './formulario';

describe('cupo del partido', () => {
  it('calcula progreso, faltantes y lugares libres', () => {
    expect(progresoCupo(6, 10, 12)).toEqual({
      porcentaje: 50, porcentajeMinimo: (10 / 12) * 100, faltanParaMinimo: 4, libres: 6, completo: false, seJuega: false,
    });
    expect(progresoCupo(12, 10, 12).completo).toBe(true);
    expect(progresoCupo(14, 10, 12).porcentaje).toBe(100);
    expect(progresoCupo(0, 2, 0).porcentaje).toBe(0);
  });

  it('resume el cupo en una frase', () => {
    expect(textoCupo(progresoCupo(6, 10, 12))).toBe('Faltan 4 para jugar');
    expect(textoCupo(progresoCupo(11, 10, 12))).toBe('Queda 1 lugar');
    expect(textoCupo(progresoCupo(10, 10, 12))).toBe('Quedan 2 lugares');
    expect(textoCupo(progresoCupo(12, 10, 12))).toBe('Completo');
  });

  it('usa el precio fijado o estima total sobre cupo', () => {
    expect(precioPorJugador({ precio_por_jugador: 2500, precio_total: 30000, cupo_maximo: 12 })).toEqual({ monto: 2500, estimado: false });
    expect(precioPorJugador({ precio_por_jugador: 0, precio_total: 30000, cupo_maximo: 12 })).toEqual({ monto: 0, estimado: false });
    expect(precioPorJugador({ precio_por_jugador: null, precio_total: 25000, cupo_maximo: 12 })).toEqual({ monto: 2084, estimado: true });
    expect(precioPorJugador({ precio_por_jugador: null, precio_total: 0, cupo_maximo: 12 })).toBeNull();
  });

  it('sugiere un precio redondeado hacia arriba', () => {
    expect(precioSugerido(30000, 12)).toBe(2500);
    expect(precioSugerido(25000, 14)).toBe(1800);
    expect(precioSugerido(5000, 8)).toBe(630);
    expect(precioSugerido(0, 12)).toBe(0);
    expect(precioSugerido(30000, 0)).toBe(0);
  });
});

describe('estado del partido', () => {
  const ahora = new Date('2026-10-01T12:00:00.000Z');
  const abierto = {
    estado_partido: 'abierto' as const, estado_reserva: 'confirmada' as const,
    inicio: '2026-10-02T23:00:00.000Z', ocupados: 5, cupo_maximo: 12,
  };

  it('explica cada estado', () => {
    expect(presentarEstadoPartido('borrador').descripcion).toMatch(/club confirme la cancha/);
    expect(presentarEstadoPartido('cancelado').etiqueta).toBe('Cancelado');
  });

  it('decide si alguien puede sumarse y por qué no', () => {
    expect(evaluarInscripcion(abierto, ahora)).toEqual({ puede: true, motivo: null });
    expect(evaluarInscripcion({ ...abierto, ocupados: 12 }, ahora).motivo).toMatch(/completo/);
    expect(evaluarInscripcion({ ...abierto, estado_partido: 'borrador', estado_reserva: 'pendiente' }, ahora).motivo)
      .toMatch(/confirmar la cancha/);
    expect(evaluarInscripcion({ ...abierto, inicio: '2026-10-01T11:00:00.000Z' }, ahora).motivo).toMatch(/ya empezó/);
    expect(evaluarInscripcion({ ...abierto, estado_partido: 'cancelado' }, ahora).motivo).toMatch(/canceló/);
  });

  it('reconoce el error de partido inexistente o privado', () => {
    expect(esPartidoNoEncontrado({ code: 'P0002', message: 'Partido no encontrado' })).toBe(true);
    expect(esPartidoNoEncontrado(new Error('Partido no encontrado'))).toBe(true);
    expect(esPartidoNoEncontrado({ code: 'red', message: 'No hay conexión' })).toBe(false);
    expect(esPartidoNoEncontrado(null)).toBe(false);
  });

  it('reconoce partidos terminados', () => {
    expect(partidoTerminado({ fin: '2026-10-01T11:00:00.000Z', estado_partido: 'abierto' }, ahora)).toBe(true);
    expect(partidoTerminado({ fin: '2026-10-03T11:00:00.000Z', estado_partido: 'finalizado' }, ahora)).toBe(true);
    expect(partidoTerminado({ fin: '2026-10-03T11:00:00.000Z', estado_partido: 'abierto' }, ahora)).toBe(false);
  });
});

describe('compartir un partido', () => {
  it('arma el enlace de invitación', () => {
    expect(enlaceInvitacion('https://voleyapp.com.ar/', 'abc123')).toBe('https://voleyapp.com.ar/partido/invitar/abc123');
  });

  it('arma el texto para WhatsApp', () => {
    const texto = textoInvitacion({
      clubNombre: 'Club Sur', zona: 'Lanús', canchaTitulo: 'Cancha 1',
      inicio: '2026-10-06T23:00:00.000Z', fin: '2026-10-07T01:00:00.000Z', nivel: 'intermedio',
      faltanParaMinimo: 3, libres: 5, precio: { monto: 2500, estimado: false }, enlace: 'https://x.com/partido/invitar/abc',
    });
    expect(texto.split('\n')).toEqual([
      '¡Sumate a jugar vóley! 🏐',
      'Martes 6 de octubre, de 20:00 a 22:00.',
      'Club Sur (Lanús) · Cancha 1.',
      'Nivel intermedio.',
      'Faltan 3 jugadores para armarlo.',
      '$ 2.500 por persona.',
      'Anotate acá: https://x.com/partido/invitar/abc',
    ]);
    const completo = textoInvitacion({
      clubNombre: 'Club Sur', canchaTitulo: 'Cancha 1', inicio: '2026-10-06T23:00:00.000Z', fin: '2026-10-07T01:00:00.000Z',
      nivel: 'recreativo', faltanParaMinimo: 0, libres: 1, precio: null, enlace: 'https://x',
    });
    expect(completo).toContain('Queda 1 lugar.');
    expect(completo).not.toContain('por persona');
  });
});

describe('formulario del partido', () => {
  it('propone cupos según la superficie', () => {
    expect(formularioPartidoInicial().cupoMaximo).toBe(12);
    expect(formularioPartidoInicial('arena')).toMatchObject({ cupoMinimo: 4, cupoMaximo: 8 });
  });

  it('usa el precio sugerido hasta que se escribe otro', () => {
    const formulario = formularioPartidoInicial();
    expect(textoPrecio(formulario, 30000)).toBe('2500');
    expect(textoPrecio({ ...formulario, precio: '3000' }, 30000)).toBe('3000');
    expect(textoPrecio({ ...formulario, precio: '' }, 30000)).toBe('');
  });

  it('lee montos con separador de miles o decimales', () => {
    expect(leerMonto('1.800')).toBe(1800);
    expect(leerMonto('$ 12.500,50')).toBe(12500.5);
    expect(leerMonto('2500')).toBe(2500);
    expect(leerMonto('')).toBeNull();
    expect(Number.isNaN(leerMonto('dos mil'))).toBe(true);
  });

  it('valida igual que el servidor y arma la configuración', () => {
    const formulario = { ...formularioPartidoInicial(), descripcion: '  Traigan pelota  ' };
    expect(validarFormularioPartido(formulario, { precioTotal: 30000 })).toEqual({
      errores: {},
      config: {
        cupo_minimo: 10, cupo_maximo: 12, invitados: 0, nivel_requerido: 'recreativo', visibilidad: 'publico',
        requiere_aprobacion: false, descripcion: 'Traigan pelota', precio_por_jugador: 2500,
      },
    });
    expect(validarFormularioPartido({ ...formulario, cupoMinimo: 14 }, { precioTotal: 30000 }).errores.cupo).toMatch(/2 a 22/);
    expect(validarFormularioPartido({ ...formulario, invitados: 12 }, { precioTotal: 30000 }).errores.invitados).toMatch(/menos que el cupo/);
    expect(validarFormularioPartido({ ...formulario, invitados: 3 }, { precioTotal: 30000, anotados: 10 }).errores.cupo)
      .toMatch(/Ya hay 13/);
    expect(validarFormularioPartido({ ...formulario, precio: 'abc' }, { precioTotal: 30000 }).errores.precio).toMatch(/solo con números/);
    expect(validarFormularioPartido({ ...formulario, precio: '' }, { precioTotal: 30000 }).config?.precio_por_jugador).toBeNull();
    expect(validarFormularioPartido({ ...formulario, descripcion: 'x'.repeat(501) }, { precioTotal: 0 }).errores.descripcion).toMatch(/500/);
  });

  it('carga los datos de un partido existente', () => {
    expect(formularioDesdePartido({
      cupo_minimo: 8, cupo_maximo: 10, invitados: 2, nivel_requerido: 'competitivo', visibilidad: 'privado',
      requiere_aprobacion: true, descripcion: null, precio_por_jugador: 1800.5,
    })).toEqual({
      cupoMinimo: 8, cupoMaximo: 10, invitados: 2, nivel: 'competitivo', visibilidad: 'enlace', requiereAprobacion: true,
      descripcion: '', precio: '1800.5',
    });
  });
});
