import { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import type { ClubPublico } from '@/types';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Card } from '@/components/ui/Card';

type MapViewProps = {
  clubes: ClubPublico[];
  onSelectClub: (clubId: number) => void;
};

function MapFocus({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function MapClubMarkers({
  clubes,
  onSelectClub,
}: {
  clubes: ClubPublico[];
  onSelectClub: (clubId: number) => void;
}) {
  return (
    <>
      {clubes.map((club) => (
        <CircleMarker
          center={[club.latitud!, club.longitud!]}
          eventHandlers={{ click: () => onSelectClub(club.id) }}
          key={`club-${club.id}`}
          pathOptions={{ color: '#1A237E', fillColor: '#FF6B35', fillOpacity: 0.85 }}
          radius={11}
        >
          <Popup>
            <strong>{club.nombre}</strong>
            <br />
            {club.direccion ?? 'Direccion pendiente'}
            <br />
            <button
              className="mt-2 rounded-lg bg-vb-orange px-3 py-1.5 text-xs font-bold text-white transition hover:bg-vb-orange/90"
              onClick={() => onSelectClub(club.id)}
              type="button"
            >
              Ver y alquilar
            </button>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

export function MapView({ clubes, onSelectClub }: MapViewProps) {
  const { center: userCenter } = useGeolocation();

  const clubesConUbicacion = useMemo(
    () => clubes.filter((c) => c.latitud != null && c.longitud != null),
    [clubes],
  );

  const mapCenter: [number, number] =
    clubesConUbicacion[0]?.latitud != null && clubesConUbicacion[0]?.longitud != null
      ? [clubesConUbicacion[0].latitud, clubesConUbicacion[0].longitud]
      : userCenter;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ink/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">Mapa de clubes</h2>
          <p className="text-sm text-ink/60">
            Los puntos aparecen cuando hay sedes con ubicacion cargada.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md bg-sand/20 px-3 py-2 text-sm font-semibold text-ink">
          <MapPin size={16} />
          {clubesConUbicacion.length} sedes activas
        </span>
      </div>

      <div className="h-[430px]">
        <MapContainer center={mapCenter} zoom={12} scrollWheelZoom className="h-full">
          <MapFocus center={mapCenter} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClubMarkers clubes={clubesConUbicacion} onSelectClub={onSelectClub} />
        </MapContainer>
      </div>
    </Card>
  );
}
