import { describe, expect, it } from 'vitest';
import type { CanchaGestion } from '@/api/tipos';
import {
  errorArchivoFoto, etiquetaSuperficie, formCanchaDesde, moverFoto, siguienteOrden, TAMANO_MAXIMO_FOTO, validarCancha,
} from './canchas';

const cancha: CanchaGestion = {
  id: 4, club_id: 1, titulo: 'Cancha 1', descripcion: null, fotos: [], precio_total: 30000, precio_sena: 10000,
  techada: false, superficie: 'arena', orden: 3, activa: true,
};

describe('fotos', () => {
  it('acepta JPG, PNG y WEBP de hasta 5 MB', () => {
    expect(errorArchivoFoto({ name: 'a.jpg', type: 'image/jpeg', size: TAMANO_MAXIMO_FOTO })).toBeNull();
    expect(errorArchivoFoto({ name: 'a.webp', type: 'image/webp', size: 1000 })).toBeNull();
    expect(errorArchivoFoto({ name: 'a.heic', type: 'image/heic', size: 1000 })).toMatch(/JPG, PNG o WEBP/);
    expect(errorArchivoFoto({ name: 'a.png', type: 'image/png', size: TAMANO_MAXIMO_FOTO + 1 })).toMatch(/5 MB/);
  });

  it('reordena sin salirse de la lista', () => {
    expect(moverFoto(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moverFoto(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moverFoto(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moverFoto(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('formulario de cancha', () => {
  it('parte de la cancha existente o de valores por defecto', () => {
    expect(formCanchaDesde(cancha, 9)).toMatchObject({ titulo: 'Cancha 1', precio: '30.000', sena: '10.000', orden: '3', techada: false });
    expect(formCanchaDesde(null, 9)).toMatchObject({ titulo: '', precio: '', orden: '9', techada: true, activa: true });
    expect(siguienteOrden([cancha, { ...cancha, orden: 7 }])).toBe(8);
    expect(siguienteOrden([])).toBe(1);
  });

  it('convierte los datos para guardar', () => {
    const { datos, errores } = validarCancha({ ...formCanchaDesde(cancha, 1), titulo: '  Cancha   central ', sena: '' });
    expect(errores).toEqual({});
    expect(datos).toEqual({
      titulo: 'Cancha central', descripcion: null, precioTotal: 30000, precioSena: 0, techada: false,
      superficie: 'arena', activa: true, orden: 3,
    });
  });

  it('valida nombre, montos y orden', () => {
    const { datos, errores } = validarCancha({ ...formCanchaDesde(null, 1), titulo: 'A', precio: '10.000', sena: '20.000', orden: '-1' });
    expect(datos).toBeNull();
    expect(Object.keys(errores).sort()).toEqual(['orden', 'sena', 'titulo']);
    expect(validarCancha({ ...formCanchaDesde(null, 1), titulo: 'Cancha', precio: '' }).errores.precio).toMatch(/Completá/);
  });

  it('tiene etiquetas de superficie', () => {
    expect(etiquetaSuperficie('sintetico')).toBe('Sintético');
    expect(etiquetaSuperficie(null)).toBeNull();
  });
});
