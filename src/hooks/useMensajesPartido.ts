import { useState, useEffect, useCallback } from 'react';
import { fetchMensajesPartido } from '@/lib/booking';
import type { MensajePartido } from '@/types';

export function useMensajesPartido(partidoId: number | null) {
  const [mensajes, setMensajes] = useState<MensajePartido[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!partidoId) { setMensajes([]); return; }
    let cancelled = false;
    setLoading(true);
    fetchMensajesPartido(partidoId).then((data) => {
      if (cancelled) return;
      setMensajes(data);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setMensajes([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [partidoId, version]);

  return { mensajes, loading, refresh };
}
