/** Saludo según la hora de Buenos Aires (0–23). */
export function saludoSegunHora(hora: number): string {
  if (hora >= 5 && hora < 13) return 'Buen día';
  if (hora >= 13 && hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Primer nombre para saludar: "Ana María Pérez" → "Ana". */
export function primerNombre(nombre: string | null | undefined): string | null {
  const primero = (nombre ?? '').trim().split(/\s+/)[0];
  return primero && primero.length >= 2 ? primero : null;
}
