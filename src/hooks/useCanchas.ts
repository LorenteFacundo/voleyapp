import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { CanchaDetalle } from '@/types';

export function useCanchas(clubId: number | null) {
  const [canchas, setCanchas] = useState<CanchaDetalle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clubId === null) {
      setCanchas([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchCanchas = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('canchas')
        .select('id, club_id, nombre_identificador, titulo, descripcion, fotos, precio_total, precio_sena')
        .eq('club_id', clubId)
        .order('titulo', { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setCanchas([]);
      } else {
        setCanchas(data as CanchaDetalle[]);
      }

      setLoading(false);
    };

    fetchCanchas();

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  return { canchas, loading, error };
}
