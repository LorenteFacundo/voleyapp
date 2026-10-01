// Archivos generados en el navegador: CSV compatible con Excel en español y
// eventos de calendario (.ics).

const SEPARADOR_EXCEL = ';';

function celdaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  // Evita que Excel interprete el contenido como fórmula.
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\n\r,]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function generarCsv(encabezados: string[], filas: unknown[][]): string {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celdaCsv).join(SEPARADOR_EXCEL));
  // BOM para que Excel reconozca UTF-8 (acentos y ñ).
  return `\ufeff${lineas.join('\r\n')}\r\n`;
}

/** Lee un CSV (separado por ; o ,) respetando comillas. */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\ufeff/, '');
  const primeraLinea = limpio.split(/\r?\n/, 1)[0] ?? '';
  const separador = (primeraLinea.match(/;/g)?.length ?? 0) >= (primeraLinea.match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i += 1) {
    const caracter = limpio[i];
    if (entreComillas) {
      if (caracter === '"' && limpio[i + 1] === '"') { celda += '"'; i += 1; }
      else if (caracter === '"') entreComillas = false;
      else celda += caracter;
    } else if (caracter === '"') entreComillas = true;
    else if (caracter === separador) { fila.push(celda); celda = ''; }
    else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && limpio[i + 1] === '\n') i += 1;
      fila.push(celda);
      if (fila.some((valor) => valor.trim() !== '')) filas.push(fila.map((valor) => valor.trim()));
      fila = [];
      celda = '';
    } else celda += caracter;
  }
  fila.push(celda);
  if (fila.some((valor) => valor.trim() !== '')) filas.push(fila.map((valor) => valor.trim()));
  return filas;
}

function fechaIcs(instante: string): string {
  return new Date(instante).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function textoIcs(valor: string): string {
  return valor.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function generarIcs(evento: {
  id: string; titulo: string; inicio: string; fin: string; lugar?: string | null; descripcion?: string | null;
}): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VoleyApp//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${evento.id}@voleyapp`,
    `DTSTAMP:${fechaIcs(new Date().toISOString())}`,
    `DTSTART:${fechaIcs(evento.inicio)}`,
    `DTEND:${fechaIcs(evento.fin)}`,
    `SUMMARY:${textoIcs(evento.titulo)}`,
    ...(evento.lugar ? [`LOCATION:${textoIcs(evento.lugar)}`] : []),
    ...(evento.descripcion ? [`DESCRIPTION:${textoIcs(evento.descripcion)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function descargarArchivo(nombre: string, contenido: string, tipo: string): void {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
