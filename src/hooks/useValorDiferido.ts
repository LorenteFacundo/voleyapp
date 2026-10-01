import { useEffect, useState } from 'react';

/** Devuelve el valor recién cuando deja de cambiar por `demoraMs` (para búsquedas mientras se escribe). */
export function useValorDiferido<T>(valor: T, demoraMs = 300): T {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setDiferido(valor), demoraMs);
    return () => clearTimeout(temporizador);
  }, [valor, demoraMs]);
  return diferido;
}
