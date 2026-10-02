import { describe, expect, it } from 'vitest';
import { mensajeCobro, mensajeDevolucion, mensajeSaludo, textoSaldo } from './mensajes';
import { normalizarClave, validarDatosCliente } from './validacion';

const club = { nombre: 'Club Norte', alias_pago: 'club.norte.mp', titular_pago: 'Club Norte SRL' };

describe('mensajes de WhatsApp', () => {
  it('saluda en nombre del club', () => {
    expect(mensajeSaludo('  Ana  Pérez ', 'Club Norte')).toBe('¡Hola, Ana Pérez! Te escribimos de Club Norte.');
  });

  it('arma el cobro con el monto y el alias', () => {
    const texto = mensajeCobro({ cliente: 'Ana', monto: -12000, club });
    expect(texto).toBe(
      '¡Hola, Ana! Te escribimos de Club Norte. Tenés un saldo pendiente de $ 12.000. '
      + 'Podés transferir al alias club.norte.mp (a nombre de Club Norte SRL) y avisarnos por acá. ¡Gracias!',
    );
  });

  it('incluye el motivo y se adapta si el club no tiene alias', () => {
    const texto = mensajeCobro({
      cliente: 'Los del martes', monto: 8000, club: { ...club, alias_pago: null }, motivo: 'el fijo de los martes 19:00',
    });
    expect(texto).toContain('Te escribimos de Club Norte por el fijo de los martes 19:00.');
    expect(texto).toContain('Podés abonarlo en el club');
    expect(texto).not.toContain('alias');
  });

  it('avisa de una devolución', () => {
    expect(mensajeDevolucion({ cliente: 'Ana', monto: 5000, club: 'Club Norte', reserva: 'lun 6 oct · 19:00' }))
      .toBe('¡Hola, Ana! Te escribimos de Club Norte por la reserva del lun 6 oct · 19:00, que se canceló. '
        + 'Te queremos devolver $ 5.000. ¿Nos pasás tu alias o CBU para transferirte?');
  });
});

describe('saldo', () => {
  it('distingue deuda, saldo a favor y al día', () => {
    expect(textoSaldo(-12000)).toEqual({ texto: 'Debe $ 12.000', tono: 'debe' });
    expect(textoSaldo(3000)).toEqual({ texto: 'A favor $ 3.000', tono: 'favor' });
    expect(textoSaldo(0)).toEqual({ texto: 'Al día', tono: 'neutro' });
  });
});

describe('validarDatosCliente', () => {
  it('normaliza teléfono, email y espacios', () => {
    expect(validarDatosCliente({ nombre: ' Ana   Pérez ', telefono: '11 2233-4455', email: ' ANA@Mail.com ', notas: ' ' })).toEqual({
      errores: {},
      datos: { nombre: 'Ana Pérez', telefono: '5491122334455', email: 'ana@mail.com', notas: null },
    });
  });

  it('marca cada campo inválido', () => {
    const { datos, errores } = validarDatosCliente({ nombre: 'A', telefono: '123', email: 'ana@', notas: 'x'.repeat(1001) });
    expect(datos).toBeNull();
    expect(Object.keys(errores).sort()).toEqual(['email', 'nombre', 'notas', 'telefono']);
    expect(validarDatosCliente({ nombre: '' }).errores.nombre).toBe('Ingresá el nombre.');
  });

  it('compara nombres sin acentos ni mayúsculas', () => {
    expect(normalizarClave('  José   MARÍA ')).toBe('jose maria');
  });
});
