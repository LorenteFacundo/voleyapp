import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { CanchaDetalle } from '@/types';

export type CanchaConClub = CanchaDetalle & {
  clubes: {
    id: number;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    latitud: number | null;
    longitud: number | null;
  } | null;
};

export function useAllCanchas(search?: string) {
  const [canchas, setCanchas] = useState<CanchaConClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search ?? '');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search ?? ''), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const fetchCanchas = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('canchas')
      .select(`
        id, club_id, nombre_identificador, titulo, descripcion, fotos, precio_total, precio_sena,
        clubes:club_id ( id, nombre, direccion, telefono, latitud, longitud )
      `)
      .order('titulo', { ascending: true });

    if (debouncedSearch) {
      query = query.or(`titulo.ilike.%${debouncedSearch}%,nombre_identificador.ilike.%${debouncedSearch}%`);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setCanchas([]);
    } else {
      setCanchas((data ?? []) as unknown as CanchaConClub[]);
    }

    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCanchas();
  }, [fetchCanchas]);

  return { canchas, loading, error, refresh: fetchCanchas };
}
