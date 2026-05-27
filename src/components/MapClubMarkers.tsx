import { CircleMarker, Popup } from 'react-leaflet';
import type { ClubPublico } from '../types';

type MapClubMarkersProps = {
  clubes: ClubPublico[];
  onSelectClub: (clubId: number) => void;
};

export function MapClubMarkers({ clubes, onSelectClub }: MapClubMarkersProps) {
  return (
    <>
      {clubes.map((club) => (
        <CircleMarker
          center={[club.latitud!, club.longitud!]}
          eventHandlers={{ click: () => onSelectClub(club.id) }}
          key={`club-${club.id}`}
          pathOptions={{ color: '#2d7d6f', fillColor: '#f5b85f', fillOpacity: 0.85 }}
          radius={11}
        >
          <Popup>
            <strong>{club.nombre}</strong>
            <br />
            {club.direccion ?? 'Direccion pendiente'}
            <br />
            <button
              className="mt-2 rounded bg-court px-2 py-1 text-xs font-semibold text-white"
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
