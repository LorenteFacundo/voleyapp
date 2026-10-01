export const SECCIONES_AJUSTES = [
  { id: 'club', label: 'Club' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'canchas', label: 'Canchas' },
  { id: 'horarios', label: 'Horarios' },
  { id: 'equipo', label: 'Equipo' },
] as const;

export type SeccionAjustes = (typeof SECCIONES_AJUSTES)[number]['id'];

/** Cambia de sección (y opcionalmente otros parámetros de la URL, como la cancha). */
export type IrASeccion = (seccion: SeccionAjustes, extra?: Record<string, string>) => void;

export function esSeccionAjustes(valor: string | null): valor is SeccionAjustes {
  return SECCIONES_AJUSTES.some((seccion) => seccion.id === valor);
}
