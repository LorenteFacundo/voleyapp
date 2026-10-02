import { describe, expect, it } from 'vitest';
import { enlaceWhatsApp, formatTelefono, normalizarTelefono } from './telefono';
import { generarCsv, generarIcs, parsearCsv } from './archivos';
import { consumePostAuthRoute, preservePostAuthRoute, rutaIngreso, rutaInternaSegura } from './navigation';
import { cumpleNivel, etiquetaNivelVoley } from './nivel';
import { formatMoney, iniciales } from './format';

describe('teléfonos argentinos', () => {
  it.each([
    ['11 2233-4455', '5491122334455'],
    ['011 15 2233 4455', '5491122334455'],
    ['+54 9 11 2233 4455', '5491122334455'],
    ['+54 11 2233 4455', '5491122334455'],
    ['0221 15 456-7890', '5492214567890'],
    ['2233-4455', '5491122334455'],
    ['', null],
    ['123', null],
  ])('normaliza %s', (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });

  it('formatea y arma enlaces de WhatsApp', () => {
    expect(formatTelefono('5491122334455')).toBe('+54 9 11 2233-4455');
    expect(enlaceWhatsApp('5491122334455', 'Hola, ¿hay cancha?')).toBe('https://wa.me/5491122334455?text=Hola%2C%20%C2%BFhay%20cancha%3F');
  });
});

describe('archivos', () => {
  it('genera CSV para Excel y lo vuelve a leer', () => {
    const csv = generarCsv(['Nombre', 'Monto'], [['Pérez; Juan', 1000], ['=SUMA(A1)', 'texto "citado"']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(parsearCsv(csv)).toEqual([
      ['Nombre', 'Monto'],
      ['Pérez; Juan', '1000'],
      ["'=SUMA(A1)", 'texto "citado"'],
    ]);
  });

  it('lee CSV separados por coma', () => {
    expect(parsearCsv('a,b\n1,"2,5"\n')).toEqual([['a', 'b'], ['1', '2,5']]);
  });

  it('genera un evento de calendario válido', () => {
    const ics = generarIcs({ id: 'r1', titulo: 'Vóley, cancha 1', inicio: '2026-10-06T01:00:00.000Z', fin: '2026-10-06T03:00:00.000Z' });
    expect(ics).toContain('DTSTART:20261006T010000Z');
    expect(ics).toContain('SUMMARY:Vóley\\, cancha 1');
  });
});

describe('navegación segura', () => {
  it('solo acepta rutas internas', () => {
    expect(rutaInternaSegura('/club/abc?x=1')).toBe('/club/abc?x=1');
    expect(rutaInternaSegura('//evil.com')).toBeNull();
    expect(rutaInternaSegura('https://evil.com')).toBeNull();
    expect(rutaInternaSegura('/\\evil.com')).toBeNull();
    expect(rutaIngreso('https://evil.com')).toBe('/ingresar');
  });

  it('recuerda la ruta un único uso', () => {
    preservePostAuthRoute('/partido/1');
    expect(consumePostAuthRoute()).toBe('/partido/1');
    expect(consumePostAuthRoute()).toBeNull();
  });
});

describe('niveles y formatos', () => {
  it('usa los mismos umbrales que el servidor', () => {
    expect(cumpleNivel(3, 'intermedio')).toBe(false);
    expect(cumpleNivel(4, 'intermedio')).toBe(true);
    expect(cumpleNivel(6, 'competitivo')).toBe(false);
    expect(etiquetaNivelVoley(5)).toBe('Intermedio');
  });

  it('formatea montos e iniciales', () => {
    expect(formatMoney(30000)).toBe('$ 30.000');
    expect(iniciales('Ana María Pérez')).toBe('AM');
  });
});
