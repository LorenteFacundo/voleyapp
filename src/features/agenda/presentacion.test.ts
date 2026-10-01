import { describe, expect, it } from 'vitest';
import {
  aparienciaDe, cuentaRegresiva, debe, descripcionOcupacion, informoPago, montoCorto, nombreDeOcupacion,
  requiereAvisoManual, saldoDe, subtituloDeOcupacion, unirConY,
} from './presentacion';
import { crearOcupacion } from './fixtures';

const ANTES = Date.parse('2026-10-01T12:00:00.000Z');
const DESPUES = Date.parse('2026-10-02T01:00:00.000Z');

describe('apariencia', () => {
  it('distingue pedidos, app, carga manual, fijos, bloqueos y canceladas', () => {
    expect(aparienciaDe(crearOcupacion({ estado: 'pendiente', origen: 'app' }))).toBe('pendiente');
    expect(aparienciaDe(crearOcupacion({ origen: 'app' }))).toBe('app');
    expect(aparienciaDe(crearOcupacion({ origen: 'whatsapp' }))).toBe('manual');
    expect(aparienciaDe(crearOcupacion({ origen: 'mostrador' }))).toBe('manual');
    expect(aparienciaDe(crearOcupacion({ origen: 'fijo' }))).toBe('fijo');
    expect(aparienciaDe(crearOcupacion({ origen: 'telefono', serie_id: 3 }))).toBe('fijo');
    expect(aparienciaDe(crearOcupacion({ tipo: 'bloqueo', origen: 'otro', cliente: null }))).toBe('bloqueo');
    expect(aparienciaDe(crearOcupacion({ estado: 'cancelada' }))).toBe('cancelada');
    expect(aparienciaDe(crearOcupacion({ estado: 'vencida', origen: 'app' }))).toBe('cancelada');
  });
});

describe('nombres', () => {
  it('prioriza cliente, jugador y título', () => {
    expect(nombreDeOcupacion(crearOcupacion())).toBe('Juan Pérez');
    expect(nombreDeOcupacion(crearOcupacion({ cliente: null, jugador: { nombre: 'Ana', email: 'a@b.c', telefono: null } }))).toBe('Ana');
    expect(nombreDeOcupacion(crearOcupacion({ cliente: null, titulo: 'Clase de menores' }))).toBe('Clase de menores');
    expect(nombreDeOcupacion(crearOcupacion({ cliente: null }))).toBe('Reserva sin nombre');
    expect(nombreDeOcupacion(crearOcupacion({ tipo: 'bloqueo', cliente: null, titulo: 'Lluvia' }))).toBe('Lluvia');
  });

  it('muestra el título como subtítulo solo si hay otro nombre', () => {
    expect(subtituloDeOcupacion(crearOcupacion({ titulo: 'Clase' }))).toBe('Clase');
    expect(subtituloDeOcupacion(crearOcupacion({ cliente: null, titulo: 'Clase' }))).toBeNull();
  });
});

describe('pagos', () => {
  it('calcula el saldo', () => {
    expect(saldoDe({ precio: 30000, pagado: 10000 })).toBe(20000);
    expect(saldoDe({ precio: 30000, pagado: 35000 })).toBe(0);
  });

  it('marca deuda solo en reservas confirmadas que ya empezaron', () => {
    const reserva = crearOcupacion({ pagado: 10000 });
    expect(debe(reserva, ANTES)).toBe(false);
    expect(debe(reserva, DESPUES)).toBe(true);
    expect(debe(crearOcupacion({ pagado: 30000 }), DESPUES)).toBe(false);
    expect(debe(crearOcupacion({ estado: 'pendiente' }), DESPUES)).toBe(false);
    expect(debe(crearOcupacion({ tipo: 'bloqueo', precio: 0 }), DESPUES)).toBe(false);
  });

  it('detecta pagos informados sin registrar', () => {
    expect(informoPago(crearOcupacion({ pago_informado_at: '2026-10-01T10:00:00.000Z' }))).toBe(true);
    expect(informoPago(crearOcupacion({ pago_informado_at: '2026-10-01T10:00:00.000Z', pagado: 30000 }))).toBe(false);
    expect(informoPago(crearOcupacion({ pago_informado_at: '2026-10-01T10:00:00.000Z', estado: 'cancelada' }))).toBe(false);
    expect(informoPago(crearOcupacion())).toBe(false);
  });

  it('formatea montos cortos', () => {
    expect(montoCorto(30000)).toBe('$30.000');
    expect(montoCorto(-500)).toBe('-$500');
  });
});

describe('avisos por WhatsApp', () => {
  it('pide aviso manual a quien no usa la app o tiene un turno fijo', () => {
    expect(requiereAvisoManual(crearOcupacion())).toBe(true);
    const deApp = { id: 9, nombre: 'Ana', telefono: '5491122334455', email: null, es_usuario_app: true };
    expect(requiereAvisoManual(crearOcupacion({ cliente: deApp }))).toBe(false);
    expect(requiereAvisoManual(crearOcupacion({ cliente: deApp, serie_id: 4, origen: 'fijo' }))).toBe(true);
    expect(requiereAvisoManual(crearOcupacion({ cliente: { ...deApp, telefono: null, es_usuario_app: false } }))).toBe(false);
    expect(requiereAvisoManual(crearOcupacion({ tipo: 'bloqueo', cliente: null }))).toBe(false);
  });
});

describe('cuenta regresiva', () => {
  const ahora = Date.parse('2026-10-01T12:00:00.000Z');
  const en = (minutos: number) => new Date(ahora + minutos * 60_000).toISOString();

  it('muestra minutos, horas o días', () => {
    expect(cuentaRegresiva(new Date(ahora + 30_000).toISOString(), ahora)).toMatchObject({ texto: 'Vence en 1 min', urgente: true });
    expect(cuentaRegresiva(en(90), ahora)).toMatchObject({ texto: 'Vence en 1 h 30 min', corto: '1 h', urgente: true });
    expect(cuentaRegresiva(en(180), ahora)).toMatchObject({ texto: 'Vence en 3 h', urgente: false });
    expect(cuentaRegresiva(en(60 * 50), ahora)).toMatchObject({ texto: 'Vence en 2 días', corto: '2 d' });
  });

  it('indica cuando ya venció', () => {
    expect(cuentaRegresiva(en(-1), ahora)).toMatchObject({ vencida: true, corto: 'Vencido' });
  });
});

describe('textos accesibles y listas', () => {
  it('describe un bloque con horario, cancha, nombre y estado', () => {
    const texto = descripcionOcupacion(crearOcupacion({ pagado: 0 }), 'Cancha 1', DESPUES);
    expect(texto).toBe('de 19:00 a 21:00, Cancha 1, Juan Pérez, cargada por el club, por WhatsApp, debe $30.000');
  });

  it('describe pedidos y bloqueos', () => {
    const pedido = crearOcupacion({ estado: 'pendiente', origen: 'app', vence_at: '2026-10-01T13:00:00.000Z' });
    expect(descripcionOcupacion(pedido, 'Cancha 2', ANTES)).toContain('pedido pendiente, vence en 1 h');
    const bloqueo = crearOcupacion({ tipo: 'bloqueo', cliente: null, titulo: 'Lluvia' });
    expect(descripcionOcupacion(bloqueo, 'Cancha 1', ANTES)).toBe('Bloqueo: Lluvia, de 19:00 a 21:00, Cancha 1');
    const finde = { ...bloqueo, inicio: '2026-10-03T03:00:00.000Z', fin: '2026-10-05T03:00:00.000Z' };
    expect(descripcionOcupacion(finde, 'Cancha 1', ANTES)).toMatch(/^Bloqueo: Lluvia, desde el sáb 3 oct · 00:00 hasta el lun 5 oct · 00:00, Cancha 1$/);
  });

  it('une con "y"', () => {
    expect(unirConY(['A'])).toBe('A');
    expect(unirConY(['A', 'B'])).toBe('A y B');
    expect(unirConY(['A', 'B', 'C'])).toBe('A, B y C');
  });
});
