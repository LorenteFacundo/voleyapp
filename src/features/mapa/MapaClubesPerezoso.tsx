import { Component, Suspense, lazy, type ReactNode } from 'react';
import { MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Cargando } from '@/components/ui/Estados';
import type { PropsMapaClubes } from './MapaClubes';

const MapaClubes = lazy(() => import('./MapaClubes').then((modulo) => ({ default: modulo.MapaClubes })));

type PropsLimite = { children: ReactNode; onVerLista: () => void };

/** Si el mapa no se puede cargar (por ejemplo, sin conexión), se ofrece volver a la lista. */
class LimiteMapa extends Component<PropsLimite, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div role="alert" className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl bg-ink/5 px-4 text-center">
        <MapPinOff className="text-vb-orange-ink" size={32} aria-hidden="true" />
        <p className="max-w-sm text-sm font-medium text-ink/70">No pudimos cargar el mapa. Revisá tu conexión e intentá de nuevo.</p>
        <Button variant="secondary" size="sm" onClick={this.props.onVerLista}>Ver la lista</Button>
      </div>
    );
  }
}

/** Mapa de clubes con Leaflet cargado a demanda. */
export function MapaClubesPerezoso({ onVerLista, ...props }: PropsMapaClubes & { onVerLista: () => void }) {
  return (
    <LimiteMapa onVerLista={onVerLista}>
      <Suspense
        fallback={(
          <div className="grid h-[55dvh] min-h-[430px] place-items-center rounded-2xl bg-ink/5">
            <Cargando texto="Cargando el mapa…" />
          </div>
        )}
      >
        <MapaClubes {...props} />
      </Suspense>
    </LimiteMapa>
  );
}
