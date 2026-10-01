import { describe, expect, it } from 'vitest';
import { FORM_NUEVO_CLUB_VACIO, validarNuevoClub } from './nuevoClub';

describe('alta de clubes', () => {
  it('convierte el formulario', () => {
    const { datos, errores } = validarNuevoClub({
      ...FORM_NUEVO_CLUB_VACIO,
      nombre: '  Club   Sur ',
      zona: 'Lanús',
      latitud: '-34,7',
      longitud: '-58.39123456',
      whatsapp: '11 2233-4455',
    });
    expect(errores).toEqual({});
    expect(datos).toEqual({
      nombre: 'Club Sur', zona: 'Lanús', direccion: null, latitud: -34.7, longitud: -58.391235, telefono: null, whatsapp: '5491122334455',
    });
  });

  it('valida nombre, coordenadas y teléfonos', () => {
    const { datos, errores } = validarNuevoClub({
      ...FORM_NUEVO_CLUB_VACIO, nombre: 'A', latitud: '-34.6', whatsapp: '123', telefono: '12',
    });
    expect(datos).toBeNull();
    expect(Object.keys(errores).sort()).toEqual(['longitud', 'nombre', 'telefono', 'whatsapp']);
    expect(validarNuevoClub({ ...FORM_NUEVO_CLUB_VACIO, nombre: 'Club', latitud: '95', longitud: '0' }).errores.latitud).toMatch(/-90 y 90/);
  });
});
