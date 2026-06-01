import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PartidoPublico } from '@/types';

export type PartidoConRol = PartidoPublico & {
  mi_rol: 'organizador' | 'jugador';
};

export function useMisPartidos(isAuthenticated: boolean) {
  const [partidos, setPartidos] = useState<PartidoConRol[]>([]);
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

    const fetchPartidos = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // 1. Get matches where user is a participant
      const { data: participaciones, error: partError } = await supabase
        .from('participantes_partido')
        .select('partido_id')
        .eq('usuario_id', user.id);

      if (cancelled) return;
      if (partError) {
        setError(partError.message);
        setLoading(false);
        return;
      }

      const partidoIds = (participaciones ?? []).map((p) => p.partido_id);

      // 2. Fetch all public matches where user is organizer or participant
      let query = supabase.from('partidos_publicos').select('*');

      if (partidoIds.length > 0) {
        // Combine: organizer OR participant
        query = query.or(`organizador_id.eq.${user.id},id.in.(${partidoIds.join(',')})`);
      } else {
        // Only organizer
        query = query.eq('organizador_id', user.id);
      }

      const { data: matches, error: matchError } = await query
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (cancelled) return;

      if (matchError) {
        setError(matchError.message);
        setPartidos([]);
      } else {
        const partidosConRol: PartidoConRol[] = (matches ?? []).map((m) => ({
          ...m,
          mi_rol: m.organizador_id === user.id ? 'organizador' : 'jugador',
        }));
        setPartidos(partidosConRol);
      }

      setLoading(false);
    };

    fetchPartidos();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, version]);

  return { partidos, loading, error, refresh };
}
