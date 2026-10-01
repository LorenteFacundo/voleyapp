// Cupo y precio de un partido. "ocupados" ya incluye a quienes esperan
// aprobación y a los invitados sin cuenta (igual que el servidor).

export type ProgresoCupo = {
  /** 0–100: ocupados sobre el cupo máximo. */
  porcentaje: number;
  /** 0–100: posición de la marca del mínimo. */
  porcentajeMinimo: number;
  faltanParaMinimo: number;
  libres: number;
  completo: boolean;
  seJuega: boolean;
};

function acotar(valor: number): number {
  return Math.min(100, Math.max(0, valor));
}

export function progresoCupo(ocupados: number, minimo: number, maximo: number): ProgresoCupo {
  const tope = Math.max(1, maximo);
  return {
    porcentaje: acotar((ocupados / tope) * 100),
    porcentajeMinimo: acotar((minimo / tope) * 100),
    faltanParaMinimo: Math.max(0, minimo - ocupados),
    libres: Math.max(0, maximo - ocupados),
    completo: ocupados >= maximo,
    seJuega: ocupados >= minimo,
  };
}

/** "Faltan 3 para jugar", "Quedan 2 lugares", "Completo". */
export function textoCupo(progreso: ProgresoCupo): string {
  if (progreso.completo) return 'Completo';
  if (progreso.faltanParaMinimo > 0) return `Faltan ${progreso.faltanParaMinimo} para jugar`;
  return progreso.libres === 1 ? 'Queda 1 lugar' : `Quedan ${progreso.libres} lugares`;
}

export type PrecioJugador = { monto: number; estimado: boolean };

/**
 * Precio por persona: el que fijó quien organiza o, si no lo fijó, el total
 * de la cancha dividido el cupo máximo (estimado).
 */
export function precioPorJugador(partido: {
  precio_por_jugador: number | null; precio_total: number; cupo_maximo: number;
}): PrecioJugador | null {
  if (partido.precio_por_jugador != null && Number.isFinite(Number(partido.precio_por_jugador))) {
    return { monto: Number(partido.precio_por_jugador), estimado: false };
  }
  const total = Number(partido.precio_total);
  if (total > 0 && partido.cupo_maximo > 0) return { monto: Math.ceil(total / partido.cupo_maximo), estimado: true };
  return null;
}

/** Sugerencia al organizar: total dividido el cupo máximo, redondeado hacia arriba a un número prolijo. */
export function precioSugerido(precioTotal: number, cupoMaximo: number): number {
  const total = Number(precioTotal);
  if (!(total > 0) || !(cupoMaximo > 0)) return 0;
  const porPersona = total / cupoMaximo;
  const paso = porPersona >= 1000 ? 100 : 10;
  return Math.ceil(porPersona / paso) * paso;
}
