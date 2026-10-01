import { createContext, useContext, type ReactNode } from 'react';

export type OpcionesConfirmacion = {
  titulo: string;
  descripcion?: ReactNode;
  confirmar?: string;
  cancelar?: string;
  peligro?: boolean;
  /** Pide un texto opcional (por ejemplo, el motivo de una cancelación). */
  pedirMotivo?: { etiqueta: string; placeholder?: string; obligatorio?: boolean };
};

export type Respuesta = { confirmado: boolean; motivo: string };

export type Contexto = (opciones: OpcionesConfirmacion) => Promise<Respuesta>;

export const ConfirmarContext = createContext<Contexto | null>(null);

export function useConfirmar(): Contexto {
  const contexto = useContext(ConfirmarContext);
  if (!contexto) throw new Error('useConfirmar debe usarse dentro de ConfirmarProvider');
  return contexto;
}
