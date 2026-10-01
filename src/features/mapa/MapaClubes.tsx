// Módulo que se carga perezosamente: Leaflet y su CSS no entran en el bundle inicial.
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { divIcon, latLngBounds, type LatLngTuple } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { CENTRO_POR_DEFECTO } from '@/hooks/useGeolocation';

export type PuntoClub = {
  id: number;
  nombre: string;
  slug: string;
  zona: string | null;
  direccion: string | null;
  latitud: number;
  longitud: number;
  /** Línea extra en el globo (por ejemplo, "Desde $ 20.000"). */
  detalle?: string | null;
};

export type PropsMapaClubes = { puntos: PuntoClub[]; ubicacion: [number, number] | null };

// Marcador propio (sin imágenes): un círculo naranja con borde blanco.
const ICONO_CLUB = divIcon({
  className: 'rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vb-orange-ink',
  html: '<span class="grid h-9 w-9 place-items-center rounded-full border-[3px] border-white bg-vb-orange-ink shadow-card">'
    + '<span class="block h-3 w-3 rounded-full bg-white"></span></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -16],
});

/** Encuadra el mapa cuando cambian los clubes visibles o la ubicación. */
function Encuadre({ clave }: { clave: string }) {
  const mapa = useMap();
  useEffect(() => {
    const coordenadas = JSON.parse(clave) as LatLngTuple[];
    if (!coordenadas.length) mapa.setView(CENTRO_POR_DEFECTO, 11);
    else if (coordenadas.length === 1) mapa.setView(coordenadas[0], 14);
    else mapa.fitBounds(latLngBounds(coordenadas), { padding: [40, 40], maxZoom: 15 });
  }, [mapa, clave]);
  return null;
}

export function MapaClubes({ puntos, ubicacion }: PropsMapaClubes) {
  const coordenadas: LatLngTuple[] = [
    ...puntos.map((punto): LatLngTuple => [punto.latitud, punto.longitud]),
    ...(ubicacion ? [ubicacion] : []),
  ];

  return (
    <div className="h-[55dvh] min-h-[430px] overflow-hidden rounded-2xl border border-vb-gray/10 shadow-card">
      <MapContainer center={CENTRO_POR_DEFECTO} zoom={11} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Encuadre clave={JSON.stringify(coordenadas)} />
        {puntos.map((punto) => (
          <Marker key={punto.id} position={[punto.latitud, punto.longitud]} icon={ICONO_CLUB} title={punto.nombre} keyboard>
            <Popup>
              <span className="block min-w-[180px] font-body">
                <span className="block font-display text-base font-black text-vb-blue">{punto.nombre}</span>
                {(punto.zona || punto.direccion) && (
                  <span className="mt-0.5 block text-xs text-ink/65">{[punto.zona, punto.direccion].filter(Boolean).join(' · ')}</span>
                )}
                {punto.detalle && <span className="mt-1 block text-xs font-semibold text-ink">{punto.detalle}</span>}
                <Link
                  to={`/club/${punto.slug}`}
                  className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg bg-vb-orange-ink px-3 text-sm font-bold !text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-blue"
                >
                  Ver horarios de {punto.nombre}
                </Link>
              </span>
            </Popup>
          </Marker>
        ))}
        {ubicacion && (
          <CircleMarker
            center={ubicacion}
            radius={8}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#1A237E', fillOpacity: 1 }}
          >
            <Popup>Estás acá</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
