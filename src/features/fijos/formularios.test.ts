import { describe, expect, it } from 'vitest';
import { validarCambiosFijo, validarNuevoFijo, type FormularioNuevoFijo } from './formularios';

const hoy = '2026-10-01';

const formulario = (cambios: Partial<FormularioNuevoFijo> = {}): FormularioNuevoFijo => ({
  cliente: { modo: 'existente', id: 7 },
  titulo: '',
  horario: { canchaId: 1, dia: 2, hora: '19:00', duracion: 90 },
  precio: '36.000',
  desde: '2026-10-06',
  hasta: '',
  notas: '',
  ...cambios,
});

describe('validarNuevoFijo', () => {
  it('arma los datos para el servidor', () => {
    expect(validarNuevoFijo(formulario(), hoy)).toEqual({
      errores: {},
      datos: {
        clienteId: 7, clienteNombre: null, clienteTelefono: null, titulo: '', canchaId: 1, dia: 2, hora: '19:00',
        duracion: 90, precio: 36000, desde: '2026-10-06', hasta: null, notas: null,
      },
    });
  });

  it('acepta un cliente nuevo y normaliza su teléfono', () => {
    const { datos } = validarNuevoFijo(formulario({
      cliente: { modo: 'nuevo', nombre: '  Los  del martes ', telefono: '011 15 2233 4455' },
      titulo: 'Martes vóley',
      hasta: '2026-12-31',
      notas: ' Traen pelota ',
    }), hoy);
    expect(datos).toMatchObject({
      clienteId: null, clienteNombre: 'Los del martes', clienteTelefono: '5491122334455', titulo: 'Martes vóley',
      hasta: '2026-12-31', notas: 'Traen pelota',
    });
  });

  it('marca cada problema', () => {
    const { datos, errores } = validarNuevoFijo(formulario({
      cliente: { modo: 'existente', id: null },
      titulo: 'X',
      horario: { canchaId: null, dia: 2, hora: '19:07', duracion: 50 },
      precio: 'mucho',
      desde: '2026-09-30',
      hasta: '2026-09-01',
    }), hoy);
    expect(datos).toBeNull();
    expect(Object.keys(errores).sort()).toEqual(['canchaId', 'cliente', 'desde', 'duracion', 'hasta', 'hora', 'precio', 'titulo']);
    expect(validarNuevoFijo(formulario({ cliente: { modo: 'nuevo', nombre: 'A', telefono: '12' } }), hoy).errores)
      .toMatchObject({ clienteNombre: expect.any(String), clienteTelefono: expect.any(String) });
  });

  it('permite precio cero', () => {
    expect(validarNuevoFijo(formulario({ precio: '0' }), hoy).datos?.precio).toBe(0);
  });
});

describe('validarCambiosFijo', () => {
  const cambios = { desdeFecha: '2026-10-06', horario: { canchaId: 2, dia: 3, hora: '20:00', duracion: 60 }, precio: '40000', titulo: 'Martes', hasta: '' };

  it('valida y arma los cambios', () => {
    expect(validarCambiosFijo(cambios, hoy).datos).toEqual({
      desdeFecha: '2026-10-06', canchaId: 2, dia: 3, hora: '20:00', duracion: 60, precio: 40000, titulo: 'Martes', hasta: null,
    });
  });

  it('exige aplicar desde hoy, un nombre y un fin posterior', () => {
    const { errores } = validarCambiosFijo({ ...cambios, desdeFecha: '2026-09-30', titulo: ' ', hasta: '2026-09-29' }, hoy);
    expect(errores).toEqual({
      desdeFecha: 'Los cambios aplican desde hoy en adelante.',
      titulo: 'Ingresá el nombre del fijo.',
      hasta: 'La fecha de fin no puede ser anterior a la de inicio.',
    });
  });
});
