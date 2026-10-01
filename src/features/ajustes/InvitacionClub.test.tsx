import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const auth = vi.hoisted(() => ({
  valor: {
    session: null as null | { user: { email: string } },
    perfil: null as null | { email: string },
    loading: false,
    refreshPerfil: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/contexts/auth', () => ({ useAuth: () => auth.valor }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/api/publico', () => ({ publicoApi: { verInvitacionClub: vi.fn() } }));
vi.mock('@/api/jugador', () => ({ jugadorApi: { aceptarInvitacionClub: vi.fn() } }));

import { ApiError } from '@/api/cliente';
import { jugadorApi } from '@/api/jugador';
import { publicoApi } from '@/api/publico';
import { InvitacionClubPage } from '@/pages/InvitacionClubPage';

const VALIDA = {
  valida: true, motivo: null, club_nombre: 'Club Sur', rol: 'encargado' as const, email: 'a•••@mail.com', expira_at: '2026-10-08T15:00:00.000Z',
};

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/invitacion/tok123']}>
        <Routes>
          <Route path="/invitacion/:token" element={<InvitacionClubPage />} />
          <Route path="/gestion/:clubId/agenda" element={<p>Agenda del club</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Invitación al equipo de un club', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.valor = { session: null, perfil: null, loading: false, refreshPerfil: vi.fn().mockResolvedValue(undefined), signOut: vi.fn() };
  });

  it('explica cuando la invitación venció', async () => {
    vi.mocked(publicoApi.verInvitacionClub).mockResolvedValue({ valida: false, motivo: 'vencida', club_nombre: 'Club Sur' });
    renderizar();
    expect(await screen.findByRole('heading', { name: 'La invitación venció' })).toBeInTheDocument();
    expect(publicoApi.verInvitacionClub).toHaveBeenCalledWith('tok123');
  });

  it('sin sesión ofrece ingresar o crear la cuenta y volver', async () => {
    vi.mocked(publicoApi.verInvitacionClub).mockResolvedValue(VALIDA);
    renderizar();
    expect(await screen.findByRole('heading', { name: 'Club Sur' })).toBeInTheDocument();
    expect(screen.getByText('encargado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar?siguiente=%2Finvitacion%2Ftok123');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/ingresar?siguiente=%2Finvitacion%2Ftok123&modo=registro');
  });

  it('avisa si se ingresó con otra cuenta', async () => {
    vi.mocked(publicoApi.verInvitacionClub).mockResolvedValue(VALIDA);
    auth.valor = { ...auth.valor, session: { user: { email: 'bruno@mail.com' } }, perfil: { email: 'bruno@mail.com' } };
    renderizar();
    expect(await screen.findByText('La invitación es para otra cuenta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar invitación' })).toBeDisabled();
  });

  it('acepta, actualiza el perfil y lleva a la agenda del club', async () => {
    const user = userEvent.setup();
    vi.mocked(publicoApi.verInvitacionClub).mockResolvedValue(VALIDA);
    vi.mocked(jugadorApi.aceptarInvitacionClub).mockResolvedValue({ club_id: 7, club_nombre: 'Club Sur', rol: 'encargado' });
    auth.valor = { ...auth.valor, session: { user: { email: 'ana@mail.com' } }, perfil: { email: 'ana@mail.com' } };
    renderizar();
    await user.click(await screen.findByRole('button', { name: 'Aceptar invitación' }));
    expect(await screen.findByText('Agenda del club')).toBeInTheDocument();
    expect(jugadorApi.aceptarInvitacionClub).toHaveBeenCalledWith('tok123');
    expect(auth.valor.refreshPerfil).toHaveBeenCalled();
  });

  it('muestra el error del servidor', async () => {
    const user = userEvent.setup();
    vi.mocked(publicoApi.verInvitacionClub).mockResolvedValue(VALIDA);
    vi.mocked(jugadorApi.aceptarInvitacionClub).mockRejectedValue(new ApiError('La invitación venció. Pedí una nueva al club.'));
    auth.valor = { ...auth.valor, session: { user: { email: 'ana@mail.com' } }, perfil: { email: 'ana@mail.com' } };
    renderizar();
    await user.click(await screen.findByRole('button', { name: 'Aceptar invitación' }));
    expect(await screen.findByText('La invitación venció. Pedí una nueva al club.')).toBeInTheDocument();
  });
});
