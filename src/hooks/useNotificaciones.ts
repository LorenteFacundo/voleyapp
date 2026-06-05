import { useState, useEffect, useCallback } from 'react';
import { fetchNotificaciones } from '@/lib/booking';
import type { Notificacion } from '@/types';

export function useNotificaciones(isAuthenticated: boolean) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  useEffect(() => {
    if (!isAuthenticated) { setNotificaciones([]); return; }
    let cancelled = false;
    setLoading(true);
    fetchNotificaciones().then((data) => {
      if (cancelled) return;
      setNotificaciones(data);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setNotificaciones([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, version]);

  return { notificaciones, noLeidas, loading, refresh };
}
