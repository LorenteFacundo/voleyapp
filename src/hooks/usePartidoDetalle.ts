import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PartidoDetalle } from '@/types';

export function usePartidoDetalle(partidoId: number | null) {
  const [partido, setPartido] = useState<PartidoDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!partidoId) {
      setPartido(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('partido_detalle')
      .select('*')
      .eq('id', partidoId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          setPartido(null);
        } else {
          setPartido(data as PartidoDetalle | null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [partidoId, version]);

  return { partido, loading, error, refresh };
}
