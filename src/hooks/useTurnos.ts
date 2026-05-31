import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Turno } from '@/types';

export function useTurnos(canchaId: number | null, desdeFecha: string) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (canchaId === null) {
      setTurnos([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('disponibilidad_turnos')
      .select('*')
      .eq('cancha_id', canchaId)
      .gte('fecha', desdeFecha)
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          setTurnos([]);
        } else {
          setTurnos(data as Turno[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canchaId, desdeFecha, version]);

  return { turnos, loading, error, refresh };
}
