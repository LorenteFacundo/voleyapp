const PENDING_ROUTE_KEY = 'voleyapp:after-auth';
const PENDING_ROUTE_TTL_MS = 10 * 60 * 1000;

export function preservePostAuthRoute(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return;
  sessionStorage.setItem(PENDING_ROUTE_KEY, JSON.stringify({
    path,
    expiresAt: Date.now() + PENDING_ROUTE_TTL_MS,
  }));
}

export function consumePostAuthRoute(): string | null {
  const stored = sessionStorage.getItem(PENDING_ROUTE_KEY);
  sessionStorage.removeItem(PENDING_ROUTE_KEY);
  if (!stored) return null;
  try {
    const payload = JSON.parse(stored) as { path?: unknown; expiresAt?: unknown };
    if (typeof payload.path !== 'string' || !payload.path.startsWith('/') || payload.path.startsWith('//') || payload.path.includes('\\')) return null;
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Date.now()) return null;
    return payload.path;
  } catch {
    return null;
  }
}
