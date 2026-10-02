const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

export function formatMoney(value: number | string | null | undefined): string {
  // Intl usa espacios no separables; se normalizan para copiar y compartir.
  return moneda.format(Number(value ?? 0)).replace(/\s/g, ' ');
}

export function formatNumero(value: number | null | undefined): string {
  return numero.format(Number(value ?? 0));
}

export function formatPorcentaje(parte: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((parte / total) * 100)}%`;
}

/** Iniciales para avatares: "Ana Pérez" → "AP". */
export function iniciales(nombre: string | null | undefined): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return partes.slice(0, 2).map((parte) => parte.charAt(0).toUpperCase()).join('');
}

export function pluralizar(cantidad: number, singular: string, plural = `${singular}s`): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}
