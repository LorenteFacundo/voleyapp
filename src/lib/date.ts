// Fechas y horas siempre en hora de Buenos Aires, sin importar la zona del
// dispositivo. Las fechas de calendario viajan como 'YYYY-MM-DD' y los
// instantes como ISO 8601 (timestamptz).

export const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';

const ISO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

type Partes = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const formateadorPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_ARGENTINA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const DIAS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function partesEnArgentina(fecha: Date): Partes {
  const valores = Object.fromEntries(formateadorPartes.formatToParts(fecha).map((p) => [p.type, p.value]));
  return {
    year: Number(valores.year),
    month: Number(valores.month),
    day: Number(valores.day),
    hour: Number(valores.hour),
    minute: Number(valores.minute),
    weekday: DIAS_EN.indexOf(valores.weekday),
  };
}

function aFecha(valor: string | Date): Date {
  return valor instanceof Date ? valor : new Date(valor);
}

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

export function esFechaISO(valor: string): boolean {
  const match = ISO_FECHA.exec(valor);
  if (!match) return false;
  const [anio, mes, dia] = match.slice(1).map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

export function todayArgentinaISO(now = new Date()): string {
  return fechaArgentina(now);
}

export function addDaysToISODate(value: string, days: number): string {
  if (!esFechaISO(value) || !Number.isInteger(days)) throw new Error('Fecha inválida');
  const [anio, mes, dia] = value.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + days);
  return fecha.toISOString().slice(0, 10);
}

/** Días entre dos fechas de calendario (b - a). */
export function diferenciaEnDias(a: string, b: string): number {
  const [aa, am, ad] = a.split('-').map(Number);
  const [ba, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ba, bm - 1, bd) - Date.UTC(aa, am - 1, ad)) / 86_400_000);
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(fecha: string): number {
  if (!esFechaISO(fecha)) throw new Error('Fecha inválida');
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

/** Lunes de la semana de la fecha. */
export function inicioDeSemana(fecha: string): string {
  return addDaysToISODate(fecha, -((diaSemana(fecha) + 6) % 7));
}

/** Fecha de calendario en Buenos Aires de un instante. */
export function fechaArgentina(instante: string | Date): string {
  const p = partesEnArgentina(aFecha(instante));
  return `${p.year}-${dosDigitos(p.month)}-${dosDigitos(p.day)}`;
}

/** Hora 'HH:MM' en Buenos Aires de un instante. */
export function horaArgentina(instante: string | Date): string {
  const p = partesEnArgentina(aFecha(instante));
  return `${dosDigitos(p.hour)}:${dosDigitos(p.minute)}`;
}

/** Minutos desde la medianoche (hora de Buenos Aires) de un instante. */
export function minutosDelDia(instante: string | Date): number {
  const p = partesEnArgentina(aFecha(instante));
  return p.hour * 60 + p.minute;
}

/** Instante (ISO, UTC) correspondiente a una fecha y hora de pared en Buenos Aires. */
export function instanteArgentina(fecha: string, hora: string): string {
  if (!esFechaISO(fecha) || !HORA.test(hora)) throw new Error('Fecha u hora inválida');
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [h, m] = hora.split(':').map(Number);
  const objetivo = Date.UTC(anio, mes - 1, dia, h, m);
  let estimado = objetivo;
  // Dos pasadas alcanzan para converger aunque cambie el desfase horario.
  for (let paso = 0; paso < 2; paso += 1) {
    const p = partesEnArgentina(new Date(estimado));
    const visto = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    estimado += objetivo - visto;
  }
  return new Date(estimado).toISOString();
}

export function sumarMinutos(instante: string, minutos: number): string {
  return new Date(aFecha(instante).getTime() + minutos * 60_000).toISOString();
}

export function minutosEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 60_000);
}

export function horaAMinutos(hora: string): number {
  if (!HORA.test(hora)) throw new Error('Hora inválida');
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minutosAHora(minutos: number): string {
  const normalizado = ((minutos % 1440) + 1440) % 1440;
  return `${dosDigitos(Math.floor(normalizado / 60))}:${dosDigitos(normalizado % 60)}`;
}

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;
export const DIAS_SEMANA_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
/** Orden de presentación habitual: lunes a domingo. */
export const DIAS_LUNES_A_DOMINGO = [1, 2, 3, 4, 5, 6, 0] as const;

const formatoFechaLarga = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
});
const formatoFechaCorta = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
});
const formatoDiaMes = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function fechaUTC(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12));
}

/** "lunes 6 de octubre" */
export function formatFechaLarga(fecha: string): string {
  return formatoFechaLarga.format(fechaUTC(fecha)).replace(',', '');
}

/** "lun 6 oct" */
export function formatFechaCorta(fecha: string): string {
  return formatoFechaCorta.format(fechaUTC(fecha)).replace(/[.,]/g, '');
}

/** "6 oct" */
export function formatDiaMes(fecha: string): string {
  return formatoDiaMes.format(fechaUTC(fecha)).replace('.', '');
}

/** "lun 6 oct · 18:00" */
export function formatFechaHora(instante: string): string {
  return `${formatFechaCorta(fechaArgentina(instante))} · ${horaArgentina(instante)}`;
}

/** "18:00–20:00" */
export function formatRangoHorario(inicio: string, fin: string): string {
  return `${horaArgentina(inicio)}–${horaArgentina(fin)}`;
}

/** "Hoy", "Mañana", "Ayer" o la fecha corta. */
export function formatDiaRelativo(fecha: string, hoy = todayArgentinaISO()): string {
  const diferencia = diferenciaEnDias(hoy, fecha);
  if (diferencia === 0) return 'Hoy';
  if (diferencia === 1) return 'Mañana';
  if (diferencia === -1) return 'Ayer';
  return formatFechaCorta(fecha);
}

/** "hace 5 min", "en 3 h", "hace 2 días". */
export function formatRelativo(instante: string, ahora = new Date()): string {
  const minutos = Math.round((aFecha(instante).getTime() - ahora.getTime()) / 60_000);
  const abs = Math.abs(minutos);
  const texto = abs < 1 ? 'un momento'
    : abs < 60 ? `${abs} min`
      : abs < 60 * 24 ? `${Math.round(abs / 60)} h`
        : `${Math.round(abs / 1440)} día${Math.round(abs / 1440) === 1 ? '' : 's'}`;
  if (abs < 1) return 'recién';
  return minutos > 0 ? `en ${texto}` : `hace ${texto}`;
}

export function formatDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}
