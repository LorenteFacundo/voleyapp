import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PartidoPublico } from '@/types';
import { pilotBookingsEnabled } from '@/lib/pilot';

export function usePartidos() {
  const [partidos, setPartidos] = useState<PartidoPublico[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from(pilotBookingsEnabled ? 'partidos_explorar' : 'partidos_publicos')
      .select('*')
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          setPartidos([]);
        } else {
          setPartidos(data as PartidoPublico[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  return { partidos, loading, error, refresh };
}
