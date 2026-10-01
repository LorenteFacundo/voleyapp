// Escala de nivel 1–10. Los umbrales coinciden con la validación del servidor
// (private.nivel_minimo): intermedio desde 4, competitivo desde 7.

export type NivelPartido = 'recreativo' | 'intermedio' | 'competitivo';

export const NIVELES_JUGADOR = [
  { value: 2, label: 'Principiante', descripcion: 'Estoy aprendiendo o juego hace poco.' },
  { value: 5, label: 'Intermedio', descripcion: 'Juego seguido y manejo los fundamentos.' },
  { value: 8, label: 'Avanzado', descripcion: 'Juego en competencia o liga.' },
] as const;

export const NIVELES_PARTIDO: { value: NivelPartido; label: string; minimo: number }[] = [
  { value: 'recreativo', label: 'Recreativo', minimo: 1 },
  { value: 'intermedio', label: 'Intermedio', minimo: 4 },
  { value: 'competitivo', label: 'Competitivo', minimo: 7 },
];

export function etiquetaNivelVoley(nivel: number | null | undefined): string {
  if (nivel == null) return 'Sin definir';
  if (nivel <= 3) return 'Principiante';
  if (nivel <= 6) return 'Intermedio';
  return 'Avanzado';
}

export function etiquetaNivelPartido(nivel: string | null | undefined): string {
  return NIVELES_PARTIDO.find((opcion) => opcion.value === nivel)?.label ?? 'Recreativo';
}

export function cumpleNivel(nivelJugador: number | null | undefined, nivelPartido: string): boolean {
  const minimo = NIVELES_PARTIDO.find((opcion) => opcion.value === nivelPartido)?.minimo ?? 1;
  return (nivelJugador ?? 1) >= minimo;
}

/** Valor de la escala más cercano a una de las opciones de registro. */
export function opcionNivelCercana(nivel: number | null | undefined): number {
  const valor = nivel ?? 5;
  return NIVELES_JUGADOR.reduce((cercana, opcion) =>
    Math.abs(opcion.value - valor) < Math.abs(cercana - valor) ? opcion.value : cercana, NIVELES_JUGADOR[1].value as number);
}
