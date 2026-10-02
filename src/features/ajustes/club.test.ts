import { describe, expect, it } from 'vitest';
import type { CanchaGestion, ClubConfig, HorarioPublicado } from '@/api/tipos';
import {
  campoDelError, checklistPublicacion, errorMonto, formClubDesde, formReservasDesde, normalizarInstagram, opcionesConActual,
  OPCIONES_ANTICIPACION, OPCIONES_CANCELACION, OPCIONES_VENTANA, parsearCoordenada, parsearMonto, payloadClub,
  payloadReservas, separarCoordenadas, slugificar, textoMonto, whatsappValido, etiquetaAnticipacion,
} from './club';

const club: ClubConfig = {
  id: 1,
  nombre: 'Club Sur',
  slug: 'club-sur',
  direccion: 'Av. Siempreviva 742',
  zona: 'Lanús',
  telefono: null,
  whatsapp: '5491122334455',
  instagram: 'clubsur',
  descripcion: null,
  alias_pago: null,
  titular_pago: null,
  latitud: -34.6,
  longitud: -58.4,
  publicado: false,
  confirmacion_automatica: false,
  anticipacion_minima_min: 60,
  ventana_reserva_dias: 21,
  cancelacion_horas: 24,
  respuesta_horas: 12,
  politicas: null,
};

describe('slug', () => {
  it('replica la función del servidor', () => {
    expect(slugificar('Club Atlético Ñandú')).toBe('club-atletico-nandu');
    expect(slugificar('  --Vóley & Playa 2026!! ')).toBe('voley-playa-2026');
    expect(slugificar('ÁRBOL')).toBe('arbol');
  });
});

describe('montos', () => {
  it.each([
    ['30.000', 30000],
    ['30000', 30000],
    ['$ 30.000', 30000],
    ['1.250.000', 1250000],
    ['30.000,50', 30000.5],
    ['0', 0],
    ['', null],
  ])('interpreta %s', (texto, esperado) => {
    expect(parsearMonto(texto)).toBe(esperado);
  });

  it('rechaza lo que no entiende', () => {
    expect(parsearMonto('30.5')).toBeNaN();
    expect(parsearMonto('abc')).toBeNaN();
    expect(parsearMonto('-100')).toBeNaN();
    expect(errorMonto('abc')).toMatch(/solo números/);
    expect(errorMonto('')).toMatch(/Completá/);
    expect(errorMonto('', false)).toBeNull();
  });

  it('muestra montos editables que se vuelven a leer igual', () => {
    expect(textoMonto(30000)).toBe('30.000');
    expect(parsearMonto(textoMonto(30000))).toBe(30000);
    expect(parsearMonto(textoMonto(1500.5))).toBe(1500.5);
    expect(textoMonto(null)).toBe('');
  });
});

describe('coordenadas', () => {
  it('acepta coma o punto decimal', () => {
    expect(parsearCoordenada('-34,6037')).toBe(-34.6037);
    expect(parsearCoordenada('-58.3816')).toBe(-58.3816);
    expect(parsearCoordenada('')).toBeNull();
    expect(parsearCoordenada('norte')).toBeNaN();
  });

  it('separa lo que se copia de Google Maps', () => {
    expect(separarCoordenadas('-34.603722, -58.381592')).toEqual(['-34.603722', '-58.381592']);
    expect(separarCoordenadas('(-34.6, -58.4)')).toEqual(['-34.6', '-58.4']);
    expect(separarCoordenadas('-34.6')).toBeNull();
  });
});

describe('datos del club', () => {
  const valores = formClubDesde(club);

  it('arma el formulario a partir del club', () => {
    expect(valores.whatsapp).toBe('+54 9 11 2233-4455');
    expect(valores.latitud).toBe('-34.6');
    expect(valores.descripcion).toBe('');
  });

  it('envía solo lo que cambió de verdad', () => {
    const editado = { ...valores, nombre: '  Club   Sur  ', zona: 'Banfield', whatsapp: '11 2233-4455' };
    const { datos, errores } = payloadClub(editado, ['nombre', 'zona', 'whatsapp'], club);
    expect(errores).toEqual({});
    expect(datos).toEqual({ zona: 'Banfield' });
  });

  it('normaliza el slug, el WhatsApp y el Instagram', () => {
    const editado = { ...valores, slug: 'Club Sur Lanús', whatsapp: '011 15 5566-7788', instagram: 'https://www.instagram.com/club.sur/' };
    const { datos } = payloadClub(editado, ['slug', 'whatsapp', 'instagram'], club);
    expect(datos).toEqual({ slug: 'club-sur-lanus', whatsapp: '5491155667788', instagram: 'club.sur' });
  });

  it('valida los campos', () => {
    const editado = { ...valores, nombre: 'A', slug: '--', whatsapp: '1234', instagram: 'no válido!' };
    const { datos, errores } = payloadClub(editado, ['nombre', 'slug', 'whatsapp', 'instagram'], club);
    expect(datos).toEqual({});
    expect(Object.keys(errores).sort()).toEqual(['instagram', 'nombre', 'slug', 'whatsapp']);
  });

  it('vacía campos opcionales como null', () => {
    const editado = { ...valores, whatsapp: '', instagram: '@', direccion: '   ' };
    expect(payloadClub(editado, ['whatsapp', 'instagram', 'direccion'], club).datos)
      .toEqual({ whatsapp: null, instagram: null, direccion: null });
  });

  it('envía latitud y longitud juntas y redondeadas', () => {
    const editado = { ...valores, longitud: '-58,38159234' };
    expect(payloadClub(editado, ['longitud'], club).datos).toEqual({ latitud: -34.6, longitud: -58.381592 });
  });

  it('borra las coordenadas cuando se vacían las dos', () => {
    expect(payloadClub({ ...valores, latitud: '', longitud: '' }, ['latitud', 'longitud'], club).datos)
      .toEqual({ latitud: null, longitud: null });
  });

  it('valida las coordenadas', () => {
    expect(payloadClub({ ...valores, longitud: '' }, ['longitud'], club).errores.longitud).toMatch(/las dos/);
    expect(payloadClub({ ...valores, latitud: '-134' }, ['latitud'], club).errores.latitud).toMatch(/-90 y 90/);
    expect(payloadClub({ ...valores, longitud: 'oeste' }, ['longitud'], club).errores.longitud).toMatch(/-180 y 180/);
  });

  it('acepta WhatsApp con código de país y área', () => {
    expect(whatsappValido('+54 9 11 2233-4455')).toBe('5491122334455');
    expect(whatsappValido('2233-4455')).toBe('5491122334455');
    expect(whatsappValido('123')).toBeNull();
  });

  it('ubica los errores del servidor en su campo', () => {
    expect(campoDelError('Esa dirección pública ya está en uso')).toBe('slug');
    expect(campoDelError('La dirección pública debe tener entre 3 y 60 letras o números')).toBe('slug');
    expect(campoDelError('La dirección no puede superar 200 caracteres')).toBe('direccion');
    expect(campoDelError('El WhatsApp debe incluir código de país y de área (ej. 5491122334455)')).toBe('whatsapp');
    expect(campoDelError('Usuario de Instagram inválido')).toBe('instagram');
    expect(campoDelError('Las coordenadas no son válidas')).toBe('latitud');
    expect(campoDelError('El teléfono debe tener entre 8 y 15 dígitos')).toBeNull();
  });

  it('extrae el usuario de Instagram', () => {
    expect(normalizarInstagram('@club.sur')).toBe('club.sur');
    expect(normalizarInstagram('instagram.com/club_sur?igsh=x')).toBe('club_sur');
  });
});

describe('reservas y políticas', () => {
  it('envía solo los cambios', () => {
    const valores = { ...formReservasDesde(club), confirmacion_automatica: true, ventana_reserva_dias: 21, politicas: '  Sin devolución  ' };
    const { datos, errores } = payloadReservas(valores, ['confirmacion_automatica', 'ventana_reserva_dias', 'politicas'], club);
    expect(errores).toEqual({});
    expect(datos).toEqual({ confirmacion_automatica: true, politicas: 'Sin devolución' });
  });

  it('valida el largo de las políticas', () => {
    const valores = { ...formReservasDesde(club), politicas: 'x'.repeat(1501) };
    expect(payloadReservas(valores, ['politicas'], club).errores.politicas).toMatch(/1500/);
  });

  it('tiene etiquetas legibles', () => {
    expect(OPCIONES_ANTICIPACION.map((opcion) => opcion.etiqueta)).toEqual([
      'Sin mínimo', '30 minutos', '1 hora', '2 horas', '3 horas', '6 horas', '12 horas', '24 horas',
    ]);
    expect(OPCIONES_VENTANA[0].etiqueta).toBe('7 días (1 semana)');
    expect(OPCIONES_CANCELACION[0].etiqueta).toBe('Hasta que empieza el turno');
    expect(OPCIONES_CANCELACION[4].etiqueta).toBe('Hasta 24 horas antes');
  });

  it('agrega el valor guardado si no está entre las opciones', () => {
    const opciones = opcionesConActual(OPCIONES_ANTICIPACION, 90, etiquetaAnticipacion);
    expect(opciones.find((opcion) => opcion.valor === 90)?.etiqueta).toBe('1 h 30 min');
    expect(opcionesConActual(OPCIONES_ANTICIPACION, 60, etiquetaAnticipacion)).toBe(OPCIONES_ANTICIPACION);
  });
});

describe('publicación', () => {
  const cancha = (id: number, activa: boolean): CanchaGestion => ({
    id, club_id: 1, titulo: `Cancha ${id}`, descripcion: null, fotos: [], precio_total: 0, precio_sena: 0,
    techada: true, superficie: null, orden: id, activa,
  });
  const horario = (canchaId: number): HorarioPublicado => ({
    id: canchaId, cancha_id: canchaId, dia_semana: 1, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 1, precio_sena: 0, activo: true,
  });

  it('exige una cancha activa con horarios', () => {
    const items = checklistPublicacion(club, [cancha(1, false), cancha(2, true)], [horario(1)]);
    expect(items.map((item) => [item.id, item.listo])).toEqual([['cancha', true], ['horarios', false], ['whatsapp', true], ['alias', false]]);
    expect(checklistPublicacion(club, [cancha(1, true)], [horario(1)])[1].listo).toBe(true);
  });
});
