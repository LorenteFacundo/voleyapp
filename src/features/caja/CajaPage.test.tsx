import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/club', () => ({
  clubApi: {
    caja: vi.fn(),
    deudas: vi.fn(),
    anularPago: vi.fn(),
    registrarPago: vi.fn(),
    clientes: vi.fn(),
    clienteDetalle: vi.fn(),
  },
}));

import { clubApi } from '@/api/club';
import { CajaPage } from '@/pages/gestion/CajaPage';
import { CAJA, DEUDAS } from '@/features/clientes/pruebas/datos';
import { ProveedoresGestion } from '@/features/clientes/pruebas/ProveedoresGestion';

const api = vi.mocked(clubApi);

function renderizar(esDueno = true) {
  return render(<ProveedoresGestion esDueno={esDueno}><CajaPage /></ProveedoresGestion>);
}

// Pantallas completas: con varios archivos en paralelo, la máquina puede ir lenta.
configure({ asyncUtilTimeout: 5000 });

describe('CajaPage', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'));
    vi.clearAllMocks();
    api.caja.mockResolvedValue(CAJA);
    api.deudas.mockResolvedValue(DEUDAS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a un encargado le explica que la caja es del dueño', () => {
    renderizar(false);
    expect(screen.getByText('La caja es solo para el dueño del club')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a la agenda' })).toHaveAttribute('href', '/gestion/1/agenda');
    expect(api.caja).not.toHaveBeenCalled();
  });

  it('muestra los totales del día y anula un pago después de confirmar', async () => {
    const user = userEvent.setup({ delay: null });
    api.anularPago.mockResolvedValue(undefined);
    renderizar();
    expect(await screen.findByText('$ 9.000')).toBeInTheDocument();
    await waitFor(() => expect(api.caja).toHaveBeenCalled());
    expect(api.caja).toHaveBeenCalledWith(1, '2026-10-01', '2026-10-01');
    expect(screen.getAllByText('Devolución').length).toBeGreaterThan(0);

    const [anular] = screen.getAllByRole('button', { name: 'Anular pago de $ 12.000 de Ana Pérez' });
    await user.click(anular);
    const confirmacion = await screen.findByRole('dialog', { name: '¿Anular este pago?' });
    await user.click(within(confirmacion).getByRole('button', { name: 'Anular pago' }));
    await waitFor(() => expect(api.anularPago).toHaveBeenCalled());
    expect(api.anularPago).toHaveBeenCalledWith(1);
  });

  it('cambia de período con los rangos rápidos', async () => {
    const user = userEvent.setup({ delay: null });
    renderizar();
    await screen.findByText('$ 9.000');
    await user.click(screen.getByRole('radio', { name: 'Esta semana' }));
    await waitFor(() => expect(api.caja).toHaveBeenLastCalledWith(1, '2026-09-28', '2026-10-01'));
    await user.click(screen.getByRole('radio', { name: 'Personalizado' }));
    const desde = screen.getByLabelText('Desde');
    await user.clear(desde);
    await user.type(desde, '2026-01-01');
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí un período de hasta 3 meses.');
  });

  it('registra la devolución de una reserva cancelada que estaba paga', async () => {
    const user = userEvent.setup({ delay: null });
    api.registrarPago.mockResolvedValue({ pago_id: 3, ocupacion: null, saldo_cliente: -12000 });
    renderizar();
    await screen.findByText('$ 9.000');
    await user.click(screen.getByRole('tab', { name: /A devolver/ }));
    await user.click(await screen.findByRole('button', { name: /Registrar devolución/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar devolución' });
    expect(within(dialogo).getByLabelText('Monto a devolver')).toHaveValue('6000');
    await user.click(within(dialogo).getByRole('button', { name: 'Registrar devolución' }));
    await waitFor(() => expect(api.registrarPago).toHaveBeenCalled());
    expect(api.registrarPago).toHaveBeenCalledWith({
      clubId: 1, monto: -6000, medio: 'transferencia', fecha: '2026-10-01', nota: 'Devolución', ocupacionId: 101, clienteId: null,
    });
  });

  it('lista las deudas con el mensaje de cobro', async () => {
    const user = userEvent.setup({ delay: null });
    renderizar();
    await user.click(await screen.findByRole('tab', { name: /Deudas/ }));
    expect(await screen.findByText('$ 20.000')).toBeInTheDocument();
    const cobrar = screen.getByRole('link', { name: /Cobrar/ });
    expect(decodeURIComponent(cobrar.getAttribute('href') ?? '')).toContain('Tenés un saldo pendiente de $ 12.000');
    expect(screen.getByText('Falta $ 8.000')).toBeInTheDocument();
  });
});
