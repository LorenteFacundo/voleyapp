/**
 * Copia texto al portapapeles. Usa la API moderna y, si no está disponible
 * (navegadores viejos o contexto no seguro), un textarea temporal.
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Se intenta con el método alternativo.
  }
  const enfocado = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let copiado = false;
  try {
    copiado = document.execCommand('copy');
  } catch {
    copiado = false;
  }
  document.body.removeChild(area);
  enfocado?.focus();
  return copiado;
}

/**
 * En celulares abre el menú de compartir del sistema; en computadoras (o si
 * no está disponible) copia el enlace. Devuelve cómo se compartió.
 */
export async function compartirEnlace(datos: { titulo: string; texto?: string; url: string }): Promise<'compartido' | 'copiado' | 'cancelado' | 'error'> {
  const esTactil = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (esTactil && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: datos.titulo, text: datos.texto, url: datos.url });
      return 'compartido';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelado';
    }
  }
  return (await copiarAlPortapapeles(datos.url)) ? 'copiado' : 'error';
}
