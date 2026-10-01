// Montos escritos a mano o copiados de una planilla: "$ 30.000", "30000",
// "30.000,50", "1500.5". En Argentina el punto separa miles y la coma decimales.

const MILES_CON_PUNTO = /^\d{1,3}(\.\d{3})+$/;
const MILES_CON_COMA = /^\d{1,3}(,\d{3})+$/;

/** Devuelve el monto como número (redondeado a centavos) o null si no se entiende. */
export function parsearMonto(entrada: string | number | null | undefined): number | null {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? Math.round(entrada * 100) / 100 : null;
  let texto = (entrada ?? '').replace(/ars|\$|\s/gi, '');
  if (!texto) return null;
  const negativo = texto.startsWith('-');
  if (negativo) texto = texto.slice(1);
  if (!/^[\d.,]+$/.test(texto)) return null;

  const ultimoPunto = texto.lastIndexOf('.');
  const ultimaComa = texto.lastIndexOf(',');
  let normalizado = texto;
  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    // El separador que aparece último es el decimal; el otro, de miles.
    const decimal = ultimoPunto > ultimaComa ? '.' : ',';
    const miles = decimal === '.' ? ',' : '.';
    normalizado = texto.split(miles).join('').replace(decimal, '.');
  } else if (ultimaComa >= 0) {
    normalizado = MILES_CON_COMA.test(texto) ? texto.replace(/,/g, '') : texto.replace(',', '.');
  } else if (ultimoPunto >= 0) {
    normalizado = MILES_CON_PUNTO.test(texto) ? texto.replace(/\./g, '') : texto;
  }
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;
  const valor = Math.round(Number(normalizado) * 100) / 100;
  if (!Number.isFinite(valor)) return null;
  if (valor === 0) return 0;
  return negativo ? -valor : valor;
}

/** Para precargar un campo de monto: "12000" (sin separadores, fácil de editar). */
export function montoParaCampo(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '';
  return String(Math.round(Math.abs(valor) * 100) / 100).replace('.', ',');
}
