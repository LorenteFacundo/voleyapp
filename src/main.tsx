import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import './lib/monitoring';
import { crearQueryClient } from '@/api/consultas';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConfirmarProvider } from '@/components/ui/Confirmar';
import { App } from './App';

const queryClient = crearQueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmarProvider>
          <App />
        </ConfirmarProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
