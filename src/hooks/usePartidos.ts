import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PartidoPublico } from '@/types';

export function usePartidos(isAuthenticated: boolean) {
  const [partidos, setPartidos] = useState<PartidoPublico[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!isAuthenticated) {
      setPartidos([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('partidos_publicos')
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
  }, [isAuthenticated, version]);

  return { partidos, loading, error, refresh };
}
