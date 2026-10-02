// Rutas internas a las que se vuelve después de iniciar sesión. Solo se
// aceptan caminos del mismo sitio para evitar redirecciones abiertas.

const PENDING_ROUTE_KEY = 'voleyapp:after-auth';
const PENDING_ROUTE_TTL_MS = 10 * 60 * 1000;

export function rutaInternaSegura(valor: string | null | undefined): string | null {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(valor)) return null;
  return valor;
}

export function preservePostAuthRoute(path: string): void {
  if (!rutaInternaSegura(path)) return;
  try {
    sessionStorage.setItem(PENDING_ROUTE_KEY, JSON.stringify({ path, expiresAt: Date.now() + PENDING_ROUTE_TTL_MS }));
  } catch {
    // Sin almacenamiento (modo privado): simplemente no se recuerda la ruta.
  }
}

export function consumePostAuthRoute(): string | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(PENDING_ROUTE_KEY);
    sessionStorage.removeItem(PENDING_ROUTE_KEY);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    const payload = JSON.parse(stored) as { path?: unknown; expiresAt?: unknown };
    if (typeof payload.path !== 'string' || !rutaInternaSegura(payload.path)) return null;
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null;
    return payload.path;
  } catch {
    return null;
  }
}

/** Enlace a la pantalla de ingreso que vuelve a la ruta indicada. */
export function rutaIngreso(siguiente: string): string {
  const segura = rutaInternaSegura(siguiente);
  return segura ? `/ingresar?siguiente=${encodeURIComponent(segura)}` : '/ingresar';
}
