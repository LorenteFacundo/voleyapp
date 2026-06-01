import { useState, useEffect, useCallback, useMemo } from 'react';
import { obtenerTurnosDisponibles } from '@/lib/booking';
import type { TurnoVirtual } from '@/types';

const SEMANAS_ADELANTE = 5;

export function useTurnos(canchaId: number | null, desdeFecha: string) {
  const [turnos, setTurnos] = useState<TurnoVirtual[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const hastaFecha = useMemo(() => {
    const desde = new Date(`${desdeFecha}T12:00:00`);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + SEMANAS_ADELANTE * 7);
    return hasta.toISOString().slice(0, 10);
  }, [desdeFecha]);

  useEffect(() => {
    if (canchaId === null) {
      setTurnos([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    obtenerTurnosDisponibles(canchaId, desdeFecha, hastaFecha)
      .then((data) => {
        if (cancelled) return;
        setTurnos(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar turnos');
        setTurnos([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canchaId, desdeFecha, hastaFecha, version]);

  return { turnos, loading, error, refresh };
}
