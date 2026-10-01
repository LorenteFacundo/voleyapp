// Envuelve una pantalla de gestión con lo que provee la app (React Query,
// router, confirmaciones y el contexto del club) para las pruebas.

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmarProvider } from '@/components/ui/Confirmar';
import { GestionContext } from '@/contexts/gestion';
import { PANEL } from './datos';

export function ProveedoresGestion({ children, esDueno = true }: { children: ReactNode; esDueno?: boolean }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  }));
  const contexto = { clubId: 1, panel: PANEL, rol: esDueno ? 'dueno' as const : 'encargado' as const, esDueno };
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConfirmarProvider>
          <GestionContext.Provider value={contexto}>{children}</GestionContext.Provider>
        </ConfirmarProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
