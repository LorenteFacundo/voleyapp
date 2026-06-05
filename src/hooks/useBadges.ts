import { useState, useEffect } from 'react';
import { fetchBadgesUsuario, fetchBadgesCatalogo } from '@/lib/booking';
import type { BadgeCatalogo, UsuarioBadge } from '@/types';

export function useBadges(usuarioId: string | null) {
  const [obtenidos, setObtenidos] = useState<UsuarioBadge[]>([]);
  const [catalogo, setCatalogo] = useState<BadgeCatalogo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!usuarioId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchBadgesUsuario(usuarioId), fetchBadgesCatalogo()])
      .then(([u, c]) => {
        if (cancelled) return;
        setObtenidos(u);
        setCatalogo(c);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [usuarioId]);

  return { obtenidos, catalogo, loading };
}
