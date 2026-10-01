import { describe, expect, it, vi } from 'vitest';
import {
  destinoTrasIngreso, limpiarNombre, validarClave, validarEmail, validarNombre, validarRepeticion, validarTelefonoOpcional,
} from './validacion';

describe('validaciones de cuenta', () => {
  it('exige un nombre de al menos dos letras, sin contar espacios', () => {
    expect(validarNombre('')).toMatch(/Escribí tu nombre/);
    expect(validarNombre('    ')).toMatch(/Escribí tu nombre/);
    expect(validarNombre(' a ')).toMatch(/al menos 2/);
    expect(validarNombre('Al')).toBeNull();
    expect(validarNombre('x'.repeat(81))).toMatch(/80/);
    expect(limpiarNombre('  Ana   María  ')).toBe('Ana María');
  });

  it('valida el email', () => {
    expect(validarEmail('')).toMatch(/Escribí tu email/);
    expect(validarEmail('ana@')).toMatch(/Revisá el email/);
    expect(validarEmail('ana @mail.com')).toMatch(/Revisá el email/);
    expect(validarEmail(' ana@mail.com ')).toBeNull();
  });

  it('pide contraseñas de 8 caracteres o más y que coincidan', () => {
    expect(validarClave('')).toMatch(/Escribí una contraseña/);
    expect(validarClave('1234567')).toMatch(/al menos 8/);
    expect(validarClave('12345678')).toBeNull();
    expect(validarRepeticion('12345678', '')).toMatch(/Repetí/);
    expect(validarRepeticion('12345678', '12345679')).toMatch(/no coinciden/);
    expect(validarRepeticion('12345678', '12345678')).toBeNull();
  });

  it('acepta el teléfono vacío y normaliza el que se escribe', () => {
    expect(validarTelefonoOpcional('  ')).toEqual({ valor: null, error: null });
    expect(validarTelefonoOpcional('11 2233-4455')).toEqual({ valor: '5491122334455', error: null });
    expect(validarTelefonoOpcional('123').error).toMatch(/característica/);
  });
});

describe('destino después de ingresar', () => {
  it('prioriza la ruta pedida si es interna', () => {
    const recordada = vi.fn(() => '/partido/9');
    expect(destinoTrasIngreso('/club/sur?fecha=2026-10-02', recordada)).toBe('/club/sur?fecha=2026-10-02');
    expect(recordada).not.toHaveBeenCalled();
  });

  it('usa la ruta recordada cuando la pedida no sirve', () => {
    expect(destinoTrasIngreso('https://malicioso.com', () => '/partido/9')).toBe('/partido/9');
    expect(destinoTrasIngreso(null, () => '/mis-reservas')).toBe('/mis-reservas');
  });

  it('nunca vuelve a la pantalla de ingreso', () => {
    expect(destinoTrasIngreso('/ingresar?siguiente=/app', () => '/ingresar')).toBe('/app');
    expect(destinoTrasIngreso(null, () => null)).toBe('/app');
  });
});
