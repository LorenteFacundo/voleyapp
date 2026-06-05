import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClubPublico } from '@/types';

export function useClubes(search?: string) {
  const [clubes, setClubes] = useState<ClubPublico[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(search ?? '');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search ?? '');
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [search]);

  const fetchClubes = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('clubes_publicos')
      .select('*')
      .order('nombre', { ascending: true });

    if (debouncedSearch) {
      const safe = debouncedSearch.replace(/[(),.*]/g, '').trim();
      if (safe) {
        query = query.or(`nombre.ilike.%${safe}%,direccion.ilike.%${safe}%`);
      }
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setClubes([]);
    } else {
      setClubes(data as ClubPublico[]);
    }

    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchClubes();
  }, [fetchClubes]);

  return { clubes, loading, error, refresh: fetchClubes };
}
