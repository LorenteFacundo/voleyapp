import { describe, expect, it } from 'vitest';
import { distanciaKm, formatDistancia, tieneCoordenadas } from './distancia';
import { enlaceGoogleMaps } from './enlaces';

describe('distancia entre dos puntos', () => {
  it('un grado de latitud mide unos 111 km', () => {
    expect(distanciaKm({ latitud: 0, longitud: 0 }, { latitud: 1, longitud: 0 })).toBeCloseTo(111.19, 1);
  });

  it('es cero para el mismo punto y simétrica', () => {
    const obelisco = { latitud: -34.6037, longitud: -58.3816 };
    const laPlata = { latitud: -34.9214, longitud: -57.9545 };
    expect(distanciaKm(obelisco, obelisco)).toBe(0);
    expect(distanciaKm(obelisco, laPlata)).toBeCloseTo(distanciaKm(laPlata, obelisco), 10);
    expect(distanciaKm(obelisco, laPlata)).toBeGreaterThan(50);
    expect(distanciaKm(obelisco, laPlata)).toBeLessThan(55);
  });

  it('reconoce coordenadas cargadas y válidas', () => {
    expect(tieneCoordenadas({ latitud: -34.6, longitud: -58.4 })).toBe(true);
    expect(tieneCoordenadas({ latitud: null, longitud: -58.4 })).toBe(false);
    expect(tieneCoordenadas({ latitud: 120, longitud: -58.4 })).toBe(false);
    expect(tieneCoordenadas({ latitud: Number.NaN, longitud: 0 })).toBe(false);
  });

  it('formatea la distancia para mostrar', () => {
    expect(formatDistancia(0.004)).toBe('a 10 m');
    expect(formatDistancia(0.847)).toBe('a 850 m');
    expect(formatDistancia(2.34)).toBe('a 2,3 km');
    expect(formatDistancia(3)).toBe('a 3 km');
    expect(formatDistancia(15.6)).toBe('a 16 km');
  });
});

describe('enlace a Google Maps', () => {
  it('usa nombre, dirección y zona cuando hay dirección', () => {
    expect(enlaceGoogleMaps({ nombre: 'Club Sur', direccion: 'Av. Mitre 123', zona: 'Avellaneda', latitud: -34.6, longitud: -58.3 }))
      .toBe('https://www.google.com/maps/search/?api=1&query=Club%20Sur%2C%20Av.%20Mitre%20123%2C%20Avellaneda');
  });

  it('usa las coordenadas si no hay dirección', () => {
    expect(enlaceGoogleMaps({ nombre: 'Club Sur', latitud: -34.6, longitud: -58.3 }))
      .toBe('https://www.google.com/maps/search/?api=1&query=-34.6%2C-58.3');
  });

  it('devuelve null sin datos suficientes', () => {
    expect(enlaceGoogleMaps({ nombre: 'Club Sur' })).toBeNull();
    expect(enlaceGoogleMaps({ direccion: '   ' })).toBeNull();
  });
});
