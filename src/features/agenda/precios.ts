// Precio sugerido para una reserva cargada a mano.

import type { CanchaGestion, HorarioPublicado } from '@/api/tipos';
import { intervaloDeHorario, type Intervalo } from './layout';

export type SugerenciaPrecio = {
  precio: number;
  origen: 'bloque' | 'proporcional' | 'cancha';
  /** Explicación breve para mostrar debajo del campo. */
  detalle: string;
};

/** Redondea a la centena: nadie cobra $22.537. */
export function redondearPrecio(valor: number, paso = 100): number {
  return Math.round(valor / paso) * paso;
}

function solapamiento(a: Intervalo, b: Intervalo): number {
  return Math.max(0, Math.min(a.fin, b.fin) - Math.max(a.inicio, b.inicio));
}

function distancia(a: Intervalo, b: Intervalo): number {
  if (solapamiento(a, b) > 0) return 0;
  return Math.min(Math.abs(a.inicio - b.fin), Math.abs(b.inicio - a.fin));
}

/** El bloque que más se superpone con el rango o, si ninguno, el más cercano. */
function bloqueMasCercano(horarios: HorarioPublicado[], rango: Intervalo): HorarioPublicado | null {
  let mejor: HorarioPublicado | null = null;
  let mejorSolape = -1;
  let mejorDistancia = Number.POSITIVE_INFINITY;
  for (const horario of horarios) {
    const intervalo = intervaloDeHorario(horario);
    const solape = solapamiento(intervalo, rango);
    const lejania = distancia(intervalo, rango);
    if (solape > mejorSolape || (solape === mejorSolape && lejania < mejorDistancia)) {
      mejor = horario;
      mejorSolape = solape;
      mejorDistancia = lejania;
    }
  }
  return mejor;
}

/**
 * 1. Si el rango coincide con un bloque publicado de esa cancha y día: su precio.
 * 2. Si no: proporcional al precio por minuto del bloque más cercano de la
 *    cancha (primero ese día de la semana, después cualquiera).
 * 3. Si la cancha no tiene bloques con precio: el precio base de la cancha.
 */
export function sugerirPrecio(params: {
  horarios: HorarioPublicado[];
  cancha: Pick<CanchaGestion, 'id' | 'precio_total'> | null | undefined;
  dia: number;
  rango: Intervalo;
}): SugerenciaPrecio | null {
  const { horarios, cancha, dia, rango } = params;
  if (!cancha) return null;
  const duracion = rango.fin - rango.inicio;
  if (duracion <= 0) return null;

  const propios = horarios.filter((horario) => horario.activo && horario.cancha_id === cancha.id);
  const delDia = propios.filter((horario) => horario.dia_semana === dia);
  const exacto = delDia.find((horario) => {
    const intervalo = intervaloDeHorario(horario);
    return intervalo.inicio === rango.inicio && intervalo.fin === rango.fin;
  });
  if (exacto) return { precio: Number(exacto.precio_total), origen: 'bloque', detalle: 'Precio del bloque publicado.' };

  const conPrecio = (lista: HorarioPublicado[]) => lista.filter((horario) => Number(horario.precio_total) > 0);
  const candidatos = conPrecio(delDia).length ? conPrecio(delDia) : conPrecio(propios);
  const cercano = bloqueMasCercano(candidatos, rango);
  if (cercano) {
    const intervalo = intervaloDeHorario(cercano);
    const porMinuto = Number(cercano.precio_total) / (intervalo.fin - intervalo.inicio);
    return {
      precio: redondearPrecio(porMinuto * duracion),
      origen: 'proporcional',
      detalle: `Proporcional al bloque de ${cercano.hora_inicio.slice(0, 5)} a ${cercano.hora_fin.slice(0, 5)}.`,
    };
  }

  if (Number(cancha.precio_total) > 0) {
    return { precio: Number(cancha.precio_total), origen: 'cancha', detalle: 'Precio base de la cancha.' };
  }
  return null;
}

/** Interpreta lo que se escribe en un campo de monto ("30.000", "$ 30000"). */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.replace(/[^\d,]/g, '').replace(',', '.');
  if (!limpio) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : null;
}
