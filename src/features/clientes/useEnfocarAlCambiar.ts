import { useEffect, useRef } from 'react';

const ENFOCABLES = [
  '[data-autofocus]',
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
].join(',');

/**
 * Para diálogos con pasos o vistas: cuando `valor` cambia, mueve el foco al
 * primer campo del contenedor (si no, quedaría en un botón que ya no existe).
 * Si la vista no tiene campos, enfoca el contenedor (que lleva tabIndex={-1}).
 */
export function useEnfocarAlCambiar<T>(valor: T) {
  const contenedor = useRef<HTMLDivElement>(null);
  const anterior = useRef(valor);
  useEffect(() => {
    if (Object.is(anterior.current, valor)) return;
    anterior.current = valor;
    const destino = contenedor.current?.querySelector<HTMLElement>('[data-autofocus]')
      ?? contenedor.current?.querySelector<HTMLElement>(ENFOCABLES);
    (destino ?? contenedor.current)?.focus();
  }, [valor]);
  return contenedor;
}
