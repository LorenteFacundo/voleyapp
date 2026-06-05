import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { PartidoPublico } from '@/types';
import type { FiltrosPartido } from '@/components/features/MatchFilters';

export function usePartidosFiltrados(isAuthenticated: boolean) {
  const [partidos, setPartidos] = useState<PartidoPublico[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [filtros, setFiltros] = useState<FiltrosPartido>({ nivel: null, texto: '', radioKm: null });
  const { center } = useGeolocation();

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!isAuthenticated) { setPartidos([]); return; }
    let cancelled = false;
    setLoading(true);

    const tieneFiltros = filtros.nivel || filtros.texto.trim() || filtros.radioKm;

    if (tieneFiltros) {
      supabase.rpc('buscar_partidos', {
        p_nivel: filtros.nivel || null,
        p_texto: filtros.texto.trim() || null,
        p_lat: filtros.radioKm ? center[0] : null,
        p_lng: filtros.radioKm ? center[1] : null,
        p_radio_km: filtros.radioKm || null,
      }).then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error buscando partidos:', error);
          setPartidos([]);
        } else {
          setPartidos((data ?? []) as unknown as PartidoPublico[]);
        }
        setLoading(false);
      });
    } else {
      supabase
        .from('partidos_publicos')
        .select('*')
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            setPartidos([]);
          } else {
            setPartidos(data as PartidoPublico[]);
          }
          setLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [isAuthenticated, filtros, center, version]);

  return { partidos, loading, filtros, setFiltros, refresh };
}
