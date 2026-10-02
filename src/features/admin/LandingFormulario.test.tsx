import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }));

// El formulario de "Sumá tu cancha" de la landing alimenta la lista de clubes interesados.
async function renderizarLanding() {
  vi.resetModules();
  vi.stubEnv('VITE_CLUB_LEADS_ENABLED', 'true');
  const { LandingPage } = await import('@/pages/LandingPage');
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
}

function completar() {
  fireEvent.change(screen.getByLabelText('Nombre del club'), { target: { value: 'Club Norte' } });
  fireEvent.change(screen.getByLabelText('Localidad'), { target: { value: 'Olivos' } });
  fireEvent.change(screen.getByLabelText('Cantidad de canchas'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Marta' } });
  fireEvent.change(screen.getByLabelText('Email o WhatsApp'), { target: { value: 'marta@club.com' } });
}

describe('Formulario de clubes de la landing', { timeout: 30_000 }, () => {
  beforeEach(() => {
    invoke.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('pide volver a enviar si se mandó demasiado rápido y después envía', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await renderizarLanding();
    completar();
    fireEvent.click(screen.getByRole('button', { name: /Quiero sumar mi cancha/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Revisá que los datos estén bien');
    expect(invoke).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-10-01T15:00:05.000Z'));
    fireEvent.click(screen.getByRole('button', { name: /Quiero sumar mi cancha/ }));
    expect(await screen.findByText(/Recibimos tu consulta/)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('submit-club-lead', {
      body: {
        club_nombre: 'Club Norte', localidad: 'Olivos', contacto_nombre: 'Marta', contacto: 'marta@club.com', cantidad_canchas: 2, website: '',
      },
    });
  });

  it('muestra el mensaje del servidor si rechaza el envío', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'Alcanzaste el límite de consultas. Intentá más tarde.' }), { status: 429 }) },
    });
    await renderizarLanding();
    completar();
    vi.setSystemTime(new Date('2026-10-01T15:00:05.000Z'));
    fireEvent.click(screen.getByRole('button', { name: /Quiero sumar mi cancha/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Alcanzaste el límite de consultas. Intentá más tarde.');
  });
});
