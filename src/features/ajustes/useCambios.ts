import { useEffect, useState } from 'react';

/**
 * Edición sobre datos del servidor: se guardan solo los campos tocados, así lo
 * que no se editó siempre muestra lo último guardado (sin copiar props a estado).
 */
export function useCambios<T extends object>(base: T) {
  const [cambios, setCambios] = useState<Partial<T>>({});
  const valores: T = { ...base, ...cambios };
  const editados = (Object.keys(cambios) as (keyof T)[]).filter((campo) => !Object.is(cambios[campo], base[campo]));

  function cambiar<K extends keyof T>(campo: K, valor: T[K]) {
    setCambios((previos) => ({ ...previos, [campo]: valor }));
  }

  function descartar() {
    setCambios({});
  }

  return { valores, editados, hayCambios: editados.length > 0, cambiar, descartar };
}

/** Pide confirmación al cerrar o recargar la pestaña si hay cambios sin guardar. */
export function useAvisoSalida(activo: boolean) {
  useEffect(() => {
    if (!activo) return undefined;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [activo]);
}
