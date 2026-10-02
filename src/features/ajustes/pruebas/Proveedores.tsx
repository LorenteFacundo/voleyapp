import { useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useClubPanel } from '@/api/consultas';
import { ConfirmarProvider } from '@/components/ui/Confirmar';
import { GestionContext, type GestionClub } from '@/contexts/gestion';

/** Igual que GestionLayout: el panel sale de la consulta (así las invalidaciones se reflejan). */
function GestionDePrueba({ children }: { children: ReactNode }) {
  const panel = useClubPanel(1);
  const contexto = useMemo<GestionClub | null>(() => (panel.data
    ? { clubId: 1, panel: panel.data, rol: panel.data.mi_rol, esDueno: panel.data.mi_rol === 'dueno' }
    : null), [panel.data]);
  if (!contexto) return <p>Cargando panel de prueba</p>;
  return <GestionContext.Provider value={contexto}>{children}</GestionContext.Provider>;
}

/** Proveedores de la app para probar pantallas de gestión del club 1. */
export function ProveedoresAjustes({ children, ruta = '/gestion/1/ajustes' }: { children: ReactNode; ruta?: string }) {
  const [cliente] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }));
  return (
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <ConfirmarProvider>
          <Routes>
            <Route path="/gestion/:clubId/ajustes" element={<GestionDePrueba>{children}</GestionDePrueba>} />
            <Route path="*" element={<p>Otra pantalla</p>} />
          </Routes>
        </ConfirmarProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
