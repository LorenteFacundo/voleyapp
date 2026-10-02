import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmarProvider } from '@/components/ui/Confirmar';

/** Proveedores mínimos para probar pantallas de administración. */
export function ProveedoresAdmin({ children, ruta = '/admin' }: { children: ReactNode; ruta?: string }) {
  const [cliente] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }));
  return (
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <ConfirmarProvider>{children}</ConfirmarProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
