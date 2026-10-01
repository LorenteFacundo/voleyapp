import { describe, expect, it } from 'vitest';
import type { ClubPublico, EstadoOperacion, MiReserva } from '@/api/tipos';
import { mensajeSituacion, situacionReserva } from './operacion';
import { primerNombre, saludoSegunHora } from './inicio/saludo';
import {
  etiquetaPago, mensajeWhatsAppTurno, montoATransferir, presentarEstadoReserva, proximaReserva, puedeInformarPago,
  tiempoRestante,
} from './reservas';
import { coincideBusqueda, filtrarClubes, normalizarTexto, ordenarClubes, precioDesde } from './catalogo';

const operacion = (cambios: Partial<EstadoOperacion> = {}): EstadoOperacion => ({
  reservas_pausadas: false,
  motivo_pausa: null,
  requiere_lista_acceso: true,
  cuenta_habilitada: true,
  puede_reservar: true,
  ...cambios,
});

describe('situación para reservar durante el piloto', () => {
  it('distingue lista, pausada, no habilitada y sin sesión', () => {
    expect(situacionReserva(undefined, true)).toBeNull();
    expect(situacionReserva(operacion(), true)).toBe('lista');
    expect(situacionReserva(operacion({ reservas_pausadas: true, puede_reservar: false }), true)).toBe('pausada');
    expect(situacionReserva(operacion({ cuenta_habilitada: false, puede_reservar: false }), true)).toBe('no_habilitada');
    expect(situacionReserva(operacion({ cuenta_habilitada: false, puede_reservar: false }), false)).toBe('sin_sesion');
    expect(situacionReserva(operacion({ reservas_pausadas: true, puede_reservar: false }), false)).toBe('pausada');
  });

  it('usa el motivo de la pausa si lo hay', () => {
    expect(mensajeSituacion('pausada', 'Volvemos el lunes').texto).toBe('Volvemos el lunes');
    expect(mensajeSituacion('pausada', '  ').texto).toMatch(/ajustes/);
    expect(mensajeSituacion('no_habilitada').titulo).toMatch(/no está habilitada/);
  });
});

describe('saludo de inicio', () => {
  it('saluda según la hora', () => {
    expect(saludoSegunHora(8)).toBe('Buen día');
    expect(saludoSegunHora(15)).toBe('Buenas tardes');
    expect(saludoSegunHora(22)).toBe('Buenas noches');
    expect(saludoSegunHora(2)).toBe('Buenas noches');
  });

  it('toma el primer nombre y tolera nombres vacíos', () => {
    expect(primerNombre('  Ana María Pérez ')).toBe('Ana');
    expect(primerNombre('')).toBeNull();
    expect(primerNombre(null)).toBeNull();
    expect(primerNombre('J')).toBeNull();
  });
});

function reserva(cambios: Partial<MiReserva> = {}): MiReserva {
  return {
    id: 1,
    inicio: '2026-10-06T23:00:00.000Z',
    fin: '2026-10-07T01:00:00.000Z',
    estado: 'confirmada',
    origen: 'app',
    precio: 30000,
    sena: 10000,
    pagado: 0,
    estado_pago: 'pendiente',
    vence_at: null,
    pago_informado_at: null,
    motivo_cancelacion: null,
    cancelada_por: null,
    es_fijo: false,
    puede_cancelar: true,
    cancelacion_horas: 24,
    club: {
      id: 1, nombre: 'Club Sur', slug: 'club-sur', direccion: null, telefono: null, whatsapp: '5491122334455',
      alias_pago: 'club.sur', titular_pago: 'Club Sur SA',
    },
    cancha: { id: 3, titulo: 'Cancha 1' },
    partido: null,
    ...cambios,
  };
}

describe('mis reservas', () => {
  it('explica quién canceló y por qué', () => {
    expect(presentarEstadoReserva(reserva({ estado: 'cancelada', cancelada_por: 'club', motivo_cancelacion: 'Lluvia' })))
      .toEqual({ etiqueta: 'Cancelada', detalle: 'La canceló el club. Motivo: Lluvia' });
    expect(presentarEstadoReserva(reserva({ estado: 'cancelada', cancelada_por: 'jugador' })).detalle).toBe('La cancelaste vos.');
    expect(presentarEstadoReserva(reserva({ estado: 'rechazada', cancelada_por: 'club' })).detalle).toBe('El club no pudo confirmarla.');
    expect(presentarEstadoReserva(reserva({ estado: 'vencida' })).etiqueta).toBe('Vencida');
    expect(presentarEstadoReserva(reserva({ estado: 'pendiente' })).etiqueta).toBe('Esperando al club');
  });

  it('calcula qué transferir y cuándo ofrecer "Ya transferí"', () => {
    expect(montoATransferir(reserva())).toEqual({ concepto: 'seña', monto: 10000 });
    expect(montoATransferir(reserva({ pagado: 4000 }))).toEqual({ concepto: 'seña', monto: 6000 });
    expect(montoATransferir(reserva({ sena: 0 }))).toEqual({ concepto: 'saldo', monto: 30000 });
    expect(montoATransferir(reserva({ pagado: 30000 }))).toBeNull();
    expect(puedeInformarPago(reserva())).toBe(true);
    expect(puedeInformarPago(reserva({ pago_informado_at: '2026-10-01T12:00:00Z' }))).toBe(false);
    expect(puedeInformarPago(reserva({ estado: 'cancelada' }))).toBe(false);
    expect(puedeInformarPago(reserva({ estado_pago: 'pagado', pagado: 30000 }))).toBe(false);
    expect(etiquetaPago(reserva({ estado_pago: 'parcial', pagado: 10000 }))).toBe('Seña pagada');
    expect(etiquetaPago(reserva({ estado_pago: 'parcial', pagado: 5000 }))).toBe('Pago parcial');
  });

  it('muestra cuánto falta en una cuenta regresiva', () => {
    const ahora = new Date('2026-10-01T12:00:00.000Z');
    expect(tiempoRestante('2026-10-01T12:00:30.000Z', ahora)).toBe('menos de 1 min');
    expect(tiempoRestante('2026-10-01T12:45:00.000Z', ahora)).toBe('45 min');
    expect(tiempoRestante('2026-10-01T15:00:00.000Z', ahora)).toBe('3 h');
    expect(tiempoRestante('2026-10-01T15:20:00.000Z', ahora)).toBe('3 h 20 min');
    expect(tiempoRestante('2026-10-02T13:00:00.000Z', ahora)).toBe('1 día 1 h');
    expect(tiempoRestante('2026-10-04T12:00:00.000Z', ahora)).toBe('3 días');
    expect(tiempoRestante('2026-10-01T11:59:00.000Z', ahora)).toBeNull();
  });

  it('elige la próxima reserva activa', () => {
    const ahora = new Date('2026-10-01T12:00:00.000Z');
    const lista = [
      reserva({ id: 1, inicio: '2026-10-08T23:00:00.000Z', fin: '2026-10-09T01:00:00.000Z' }),
      reserva({ id: 2, inicio: '2026-10-02T23:00:00.000Z', fin: '2026-10-03T01:00:00.000Z', estado: 'cancelada' }),
      reserva({ id: 3, inicio: '2026-10-03T23:00:00.000Z', fin: '2026-10-04T01:00:00.000Z', estado: 'pendiente' }),
    ];
    expect(proximaReserva(lista, ahora)?.id).toBe(3);
    expect(proximaReserva([], ahora)).toBeNull();
  });

  it('arma mensajes de WhatsApp con el turno en hora de Buenos Aires', () => {
    const mensaje = mensajeWhatsAppTurno({
      motivo: 'cancelar', nombre: 'Ana', cancha: 'Cancha 1', inicio: '2026-10-06T23:00:00.000Z', fin: '2026-10-07T01:00:00.000Z',
    });
    expect(mensaje).toBe('Hola, soy Ana. Necesito cancelar mi reserva de VoleyApp: Cancha 1, martes 6 de octubre de 20:00 a 22:00.');
    expect(mensajeWhatsAppTurno({ motivo: 'pedido', cancha: 'C', inicio: '2026-10-06T23:00:00.000Z', fin: '2026-10-07T01:00:00.000Z' }))
      .toMatch(/^Hola\. Te escribo por el pedido/);
  });
});

function club(cambios: Partial<ClubPublico> = {}): ClubPublico {
  return {
    id: 1, nombre: 'Club Núñez', slug: 'club-nunez', direccion: 'Av. del Libertador 7000', zona: 'Núñez', telefono: null,
    whatsapp: null, instagram: null, descripcion: null, latitud: null, longitud: null, politicas: null,
    confirmacion_automatica: false, anticipacion_minima_min: 60, ventana_reserva_dias: 14, cancelacion_horas: 24, respuesta_horas: 12,
    canchas: [],
    ...cambios,
  };
}

const cancha = (id: number, cambios: Partial<ClubPublico['canchas'][number]> = {}) => ({
  id, club_id: 1, titulo: `Cancha ${id}`, descripcion: null, fotos: [], precio_total: 20000, precio_sena: 5000,
  techada: false, superficie: null, orden: id, ...cambios,
});

describe('catálogo de clubes', () => {
  it('busca sin importar acentos ni mayúsculas, por nombre, zona, dirección o cancha', () => {
    expect(normalizarTexto('  NÚÑEZ ')).toBe('nunez');
    const nunez = club({ canchas: [cancha(1, { titulo: 'Arena central' })] });
    expect(coincideBusqueda(nunez, 'nunez')).toBe(true);
    expect(coincideBusqueda(nunez, 'libertador club')).toBe(true);
    expect(coincideBusqueda(nunez, 'arena')).toBe(true);
    expect(coincideBusqueda(nunez, 'palermo')).toBe(false);
    expect(coincideBusqueda(nunez, '   ')).toBe(true);
  });

  it('filtra por techada y arena', () => {
    const techado = club({ id: 1, canchas: [cancha(1, { techada: true })] });
    const playa = club({ id: 2, canchas: [cancha(2, { superficie: 'arena' })] });
    expect(filtrarClubes([techado, playa], { busqueda: '', techada: true, arena: false }).map((c) => c.id)).toEqual([1]);
    expect(filtrarClubes([techado, playa], { busqueda: '', techada: false, arena: true }).map((c) => c.id)).toEqual([2]);
  });

  it('calcula el precio desde, ignorando canchas sin precio', () => {
    expect(precioDesde([{ precio_total: 25000 }, { precio_total: 18000 }, { precio_total: 0 }])).toBe(18000);
    expect(precioDesde([])).toBeNull();
  });

  it('ordena por cercanía con los clubes sin ubicación al final', () => {
    const lejos = club({ id: 1, nombre: 'Lejos', latitud: -34.9, longitud: -57.95 });
    const cerca = club({ id: 2, nombre: 'Cerca', latitud: -34.61, longitud: -58.38 });
    const sinUbicacion = club({ id: 3, nombre: 'Antes alfabéticamente' });
    const orden = ordenarClubes([lejos, sinUbicacion, cerca], { latitud: -34.6037, longitud: -58.3816 });
    expect(orden.map((item) => item.club.id)).toEqual([2, 1, 3]);
    expect(orden[0].distanciaKm).toBeLessThan(1);
    expect(ordenarClubes([lejos, cerca], null).map((item) => item.club.nombre)).toEqual(['Cerca', 'Lejos']);
  });
});
