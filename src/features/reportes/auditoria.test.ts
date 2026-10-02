import { describe, expect, it } from 'vitest';
import { describirEvento } from './auditoria';

describe('describirEvento', () => {
  it('describe pagos y devoluciones', () => {
    expect(describirEvento({ accion: 'pago.registrar', detalle: { monto: 12000, medio: 'transferencia' } })).toEqual({
      titulo: 'Registró un pago', detalle: '$ 12.000 · Transferencia',
    });
    expect(describirEvento({ accion: 'pago.registrar', detalle: { monto: -3000, medio: 'efectivo' } })).toEqual({
      titulo: 'Registró una devolución', detalle: '$ 3.000 · Efectivo',
    });
    expect(describirEvento({ accion: 'pago.anular', detalle: { monto: 500, medio: 'mercadopago' } }).detalle).toBe('$ 500 · Mercado Pago');
  });

  it('describe reservas, bloqueos y fijos', () => {
    expect(describirEvento({
      accion: 'reserva.crear', detalle: { origen: 'whatsapp', inicio: '2026-10-06T22:00:00+00:00', cancha_id: 1 },
    })).toEqual({ titulo: 'Cargó una reserva', detalle: 'mar 6 oct · 19:00 · por WhatsApp' });
    expect(describirEvento({
      accion: 'agenda.bloquear', detalle: { motivo: 'Lluvia', inicio: '2026-10-06T22:00:00+00:00', reservas_canceladas: 2 },
    }).detalle).toBe('Lluvia · mar 6 oct · 19:00 · canceló 2 reservas');
    expect(describirEvento({ accion: 'fijo.crear', detalle: { creadas: 12, conflictos: ['2026-10-13'] } }).detalle)
      .toBe('12 fechas generadas · 1 fecha omitida');
    expect(describirEvento({ accion: 'fijo.finalizar', detalle: { desde: '2026-10-06', canceladas: 3 } }).detalle)
      .toBe('Desde el mar 6 oct · 3 fechas liberadas');
    expect(describirEvento({ accion: 'reserva.editar', detalle: { asistencia: 'no_vinieron' } }).detalle).toBe('Marcó que no vinieron');
    expect(describirEvento({ accion: 'reserva.solicitar', detalle: { estado: 'pendiente' } }).detalle).toBe('Quedó pendiente de confirmar');
  });

  it('nombra la configuración y el equipo', () => {
    expect(describirEvento({ accion: 'club.configurar', detalle: { publicado: true } })).toEqual({
      titulo: 'Cambió la configuración del club', detalle: null,
    });
    expect(describirEvento({ accion: 'equipo.invitar', detalle: { email: 'ana@mail.com', rol: 'encargado' } }).detalle)
      .toBe('ana@mail.com · como encargado');
    expect(describirEvento({ accion: 'horarios.guardar', detalle: { bloques: 1 } }).detalle).toBe('1 bloque');
  });

  it('tolera acciones desconocidas y detalles vacíos o con tipos inesperados', () => {
    expect(describirEvento({ accion: 'algo.nuevo', detalle: {} })).toEqual({ titulo: 'Hizo un cambio', detalle: null });
    expect(describirEvento({ accion: 'pago.registrar', detalle: { monto: 'x' } })).toEqual({ titulo: 'Registró un pago', detalle: null });
    expect(describirEvento({ accion: 'reserva.mover', detalle: { despues: 'nada' } }).detalle).toBeNull();
  });
});
