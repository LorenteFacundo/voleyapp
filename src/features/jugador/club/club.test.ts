import { describe, expect, it } from 'vitest';
import type { BloqueDisponible } from '@/api/tipos';
import {
  agruparPorCancha, canchaElegida, cubreFecha, diasReservables, fechaElegida, libresPorFecha, motivoNoDisponible,
  ventanaDeConsulta,
} from './disponibilidad';
import { enlaceInstagram, enlaceTelefono, etiquetaSuperficie, politicasClub, usuarioInstagram } from './politicas';

function bloque(cambios: Partial<BloqueDisponible>): BloqueDisponible {
  return {
    horario_id: 1, cancha_id: 1, fecha: '2026-10-01', hora_inicio: '20:00', hora_fin: '22:00',
    inicio: '2026-10-01T23:00:00.000Z', fin: '2026-10-02T01:00:00.000Z', precio: 30000, sena: 10000,
    estado: 'libre', ocupacion_id: null, ...cambios,
  };
}

describe('días y ventana de disponibilidad', () => {
  it('muestra desde hoy hasta la ventana del club, con un máximo de 14 días', () => {
    expect(diasReservables('2026-10-01', 2)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(diasReservables('2026-10-01', 30)).toHaveLength(14);
    expect(diasReservables('2026-10-01', 0)).toEqual(['2026-10-01']);
    expect(diasReservables('2026-12-30', 3).at(-1)).toBe('2027-01-02');
  });

  it('respeta la fecha y la cancha pedidas solo si son válidas', () => {
    const dias = diasReservables('2026-10-01', 6);
    expect(fechaElegida('2026-10-03', dias)).toBe('2026-10-03');
    expect(fechaElegida('2026-11-03', dias)).toBe('2026-10-01');
    expect(fechaElegida('cualquier-cosa', dias)).toBe('2026-10-01');
    expect(fechaElegida(null, dias)).toBe('2026-10-01');
    expect(canchaElegida('2', [{ id: 1 }, { id: 2 }])).toBe(2);
    expect(canchaElegida('9', [{ id: 1 }])).toBeNull();
    expect(canchaElegida('abc', [{ id: 1 }])).toBeNull();
    expect(canchaElegida(null, [{ id: 1 }])).toBeNull();
  });

  it('consulta la semana que contiene la fecha elegida', () => {
    expect(ventanaDeConsulta('2026-10-01', '2026-10-01')).toEqual({ desde: '2026-10-01', hasta: '2026-10-07' });
    expect(ventanaDeConsulta('2026-10-01', '2026-10-07')).toEqual({ desde: '2026-10-01', hasta: '2026-10-07' });
    expect(ventanaDeConsulta('2026-10-01', '2026-10-08')).toEqual({ desde: '2026-10-08', hasta: '2026-10-14' });
    expect(cubreFecha({ desde: '2026-10-01', hasta: '2026-10-07' }, '2026-10-07')).toBe(true);
    expect(cubreFecha({ desde: '2026-10-01', hasta: '2026-10-07' }, '2026-10-08')).toBe(false);
    expect(cubreFecha(undefined, '2026-10-08')).toBe(false);
  });

  it('cuenta libres por día y agrupa por cancha en el orden del club', () => {
    const bloques = [
      bloque({ cancha_id: 2, inicio: '2026-10-01T22:00:00.000Z' }),
      bloque({ cancha_id: 1, inicio: '2026-10-01T23:00:00.000Z', estado: 'ocupado' }),
      bloque({ cancha_id: 1, inicio: '2026-10-01T21:00:00.000Z' }),
      bloque({ cancha_id: 1, fecha: '2026-10-02', estado: 'ocupado' }),
    ];
    expect(libresPorFecha(bloques)).toEqual({ '2026-10-01': 2, '2026-10-02': 0 });
    const grupos = agruparPorCancha([{ id: 1 }, { id: 2 }], bloques, '2026-10-01', null);
    expect(grupos.map((grupo) => grupo.cancha.id)).toEqual([1, 2]);
    expect(grupos[0].bloques.map((b) => b.inicio)).toEqual(['2026-10-01T21:00:00.000Z', '2026-10-01T23:00:00.000Z']);
    expect(agruparPorCancha([{ id: 1 }, { id: 2 }], bloques, '2026-10-01', 2).map((grupo) => grupo.cancha.id)).toEqual([2]);
  });

  it('explica por qué un bloque no está disponible', () => {
    expect(motivoNoDisponible({ fecha: '2026-10-01' }, '2026-10-01', 7)).toBe('sobre_la_hora');
    expect(motivoNoDisponible({ fecha: '2026-10-10' }, '2026-10-01', 7)).toBe('mas_adelante');
  });
});

describe('ficha del club', () => {
  it('resume las reglas del club', () => {
    const base = { confirmacion_automatica: false, respuesta_horas: 12, cancelacion_horas: 24, anticipacion_minima_min: 90, ventana_reserva_dias: 14 };
    expect(politicasClub(base)).toEqual([
      'El club responde tu pedido en hasta 12 horas.',
      'Podés cancelar desde la app hasta 24 horas antes del turno.',
      'Los pedidos se hacen con al menos 1 h 30 min de anticipación.',
      'Recibe pedidos con hasta 14 días de anticipación.',
    ]);
    expect(politicasClub({ ...base, confirmacion_automatica: true, anticipacion_minima_min: 0, cancelacion_horas: 1 }))
      .toEqual([
        'Confirmación inmediata: tu reserva queda confirmada al pedirla.',
        'Podés cancelar desde la app hasta 1 hora antes del turno.',
        'Recibe pedidos con hasta 14 días de anticipación.',
      ]);
  });

  it('acepta el Instagram como usuario o enlace', () => {
    expect(usuarioInstagram('@club.sur')).toBe('club.sur');
    expect(usuarioInstagram('https://www.instagram.com/club_sur/?hl=es')).toBe('club_sur');
    expect(usuarioInstagram('instagram.com/clubsur')).toBe('clubsur');
    expect(usuarioInstagram('https://facebook.com/clubsur')).toBeNull();
    expect(usuarioInstagram('club sur')).toBeNull();
    expect(enlaceInstagram('@club.sur')).toBe('https://www.instagram.com/club.sur/');
    expect(enlaceInstagram(null)).toBeNull();
  });

  it('arma enlaces para llamar', () => {
    expect(enlaceTelefono('5491122334455')).toBe('tel:+5491122334455');
    expect(enlaceTelefono('011 4222-3333')).toBe('tel:01142223333');
    expect(enlaceTelefono('123')).toBeNull();
    expect(enlaceTelefono(null)).toBeNull();
  });

  it('nombra las superficies', () => {
    expect(etiquetaSuperficie('sintetico')).toBe('Sintético');
    expect(etiquetaSuperficie(null)).toBeNull();
  });
});
