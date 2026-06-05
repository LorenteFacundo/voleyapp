import { useState } from 'react';
import { MapPin, X, ChevronUp } from 'lucide-react';
import type { ClubPublico } from '@/types';
import { MapView } from './MapView';

export function ExpandableMap({ clubes, onSelectClub }: { clubes: ClubPublico[]; onSelectClub: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const clubesConUbicacion = clubes.filter((c) => c.latitud != null && c.longitud != null);

  // Desktop: always show map directly
  const desktopMap = (
    <div className="hidden md:block overflow-hidden rounded-2xl border border-vb-gray/10 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-vb-gray/10 p-4">
        <div>
          <h2 className="text-lg font-bold text-vb-blue">Mapa de clubes</h2>
          <p className="text-sm text-vb-gray/60">{clubesConUbicacion.length} sedes activas</p>
        </div>
      </div>
      <div className="h-[430px]">
        <MapView clubes={clubes} onSelectClub={onSelectClub} />
      </div>
    </div>
  );

  // Mobile: fullscreen expanded map
  if (expanded) {
    return (
      <>
        {desktopMap}
        <div className="fixed inset-0 z-40 flex flex-col bg-white animate-fade-in md:hidden">
          <div className="flex items-center justify-between border-b border-vb-gray/10 p-4">
            <div>
              <h2 className="text-lg font-bold text-vb-blue">Mapa de clubes</h2>
              <p className="text-sm text-vb-gray/60">{clubesConUbicacion.length} sedes activas</p>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="grid h-10 w-10 place-items-center rounded-full bg-vb-gray/10 text-vb-gray transition hover:bg-vb-gray/20"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1">
            <MapView clubes={clubes} onSelectClub={(id) => { setExpanded(false); onSelectClub(id); }} />
          </div>
        </div>
      </>
    );
  }

  // Mobile: collapsed trigger
  return (
    <>
      {desktopMap}
      <div
        onClick={() => setExpanded(true)}
        className="cursor-pointer overflow-hidden rounded-2xl border border-vb-gray/10 bg-white shadow-card transition hover:shadow-card-hover md:hidden"
      >
        <div className="flex items-center gap-3 p-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-vb-orange-light text-vb-orange">
            <MapPin size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-vb-blue">Ver mapa de clubes</h3>
            <p className="text-sm text-vb-gray/60 truncate">
              {clubesConUbicacion.length} sedes con ubicación cargada
            </p>
          </div>
          <ChevronUp size={20} className="shrink-0 text-vb-gray/40" />
        </div>
        <div className="relative h-16 bg-vb-light overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            {clubesConUbicacion.slice(0, 3).map((_, i) => (
              <div
                key={i}
                className="absolute h-2 w-2 rounded-full bg-vb-orange"
                style={{
                  left: `${20 + i * 25}%`,
                  top: `${30 + (i % 2) * 20}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
