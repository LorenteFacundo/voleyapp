const niveles = [
  { value: 1, label: 'Principiante' },
  { value: 5, label: 'Intermedio' },
  { value: 7, label: 'Avanzado' },
] as const;

export const nivelesVoley = niveles;

export function etiquetaNivelVoley(nivel: number | null | undefined): string {
  if (nivel == null) return 'Sin definir';
  if (nivel <= 3) return 'Principiante';
  if (nivel <= 6) return 'Intermedio';
  return 'Avanzado';
}
