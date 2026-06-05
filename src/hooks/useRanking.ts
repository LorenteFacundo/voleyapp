import { useState, useEffect, useCallback } from 'react';
import { fetchRanking } from '@/lib/booking';
import type { RankingEntry } from '@/types';

export function useRanking(limit = 20) {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRanking(limit).then((data) => {
      if (cancelled) return;
      setRanking(data);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setRanking([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [limit, version]);

  return { ranking, loading, refresh };
}
