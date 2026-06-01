import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { CanchaDetalle } from '@/types';

export type CanchaDetalleConClub = CanchaDetalle & {
  clubes: {
    id: number;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    latitud: number | null;
    longitud: number | null;
  } | null;
};

export function useCanchaDetalle(canchaId: number | null) {
  const [cancha, setCancha] = useState<CanchaDetalleConClub | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!canchaId) {
      setCancha(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('canchas')
      .select(`
        id, club_id, nombre_identificador, titulo, descripcion, fotos, precio_total, precio_sena,
        clubes:club_id ( id, nombre, direccion, telefono, latitud, longitud )
      `)
      .eq('id', canchaId)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          setCancha(null);
        } else {
          setCancha(data as unknown as CanchaDetalleConClub | null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canchaId, version]);

  return { cancha, loading, error, refresh };
}
