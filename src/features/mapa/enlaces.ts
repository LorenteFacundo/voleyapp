type Lugar = {
  nombre?: string | null;
  direccion?: string | null;
  zona?: string | null;
  latitud?: number | null;
  longitud?: number | null;
};

const BASE_GOOGLE_MAPS = 'https://www.google.com/maps/search/?api=1&query=';

/**
 * Enlace para abrir el lugar en Google Maps. Usa la dirección si está cargada
 * (con el nombre del club para que Maps encuentre el lugar); si no, las
 * coordenadas. Devuelve null si no hay datos suficientes.
 */
export function enlaceGoogleMaps(lugar: Lugar): string | null {
  const nombre = lugar.nombre?.trim();
  const direccion = lugar.direccion?.trim();
  const zona = lugar.zona?.trim();
  let consulta: string | null = null;
  if (direccion) {
    consulta = [nombre, direccion, zona].filter(Boolean).join(', ');
  } else if (lugar.latitud != null && lugar.longitud != null) {
    consulta = `${lugar.latitud},${lugar.longitud}`;
  } else if (nombre && zona) {
    consulta = `${nombre}, ${zona}`;
  }
  return consulta ? `${BASE_GOOGLE_MAPS}${encodeURIComponent(consulta)}` : null;
}
