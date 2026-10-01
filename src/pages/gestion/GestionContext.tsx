import { createContext, useContext } from 'react';
import type { ClubPanel, RolClub } from '@/api/tipos';

export type GestionClub = {
  clubId: number;
  panel: ClubPanel;
  rol: RolClub;
  esDueno: boolean;
};

export const GestionContext = createContext<GestionClub | null>(null);

/** Datos del club que se está gestionando (dentro de /gestion/:clubId). */
export function useGestion(): GestionClub {
  const contexto = useContext(GestionContext);
  if (!contexto) throw new Error('useGestion debe usarse dentro de GestionLayout');
  return contexto;
}
