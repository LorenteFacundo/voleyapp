export function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

export function formatTime(value: string) {
  return value.slice(0, 5);
}

export function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}
