import type { ReactNode } from 'react';
import { Aviso } from '@/components/ui/Estados';
import { mensajeSituacion, type SituacionReserva } from './operacion';
import { usePuedeReservar } from './usePuedeReservar';

/**
 * Explica por qué no se puede reservar o sumarse a partidos (reservas
 * pausadas o cuenta no habilitada durante el piloto). Por defecto no muestra
 * nada cuando se puede reservar o cuando falta iniciar sesión.
 */
export function AvisoOperacion({
  mostrar = ['pausada', 'no_habilitada'], accion, className,
}: { mostrar?: SituacionReserva[]; accion?: (situacion: SituacionReserva) => ReactNode; className?: string }) {
  const { situacion, motivoPausa } = usePuedeReservar();
  if (!situacion || !mostrar.includes(situacion)) return null;
  const mensaje = mensajeSituacion(situacion, motivoPausa);
  const extra = accion?.(situacion);
  return (
    <Aviso tono={mensaje.tono} titulo={mensaje.titulo} className={className}>
      <p>{mensaje.texto}</p>
      {extra && <div className="mt-3 flex flex-wrap gap-2">{extra}</div>}
    </Aviso>
  );
}
