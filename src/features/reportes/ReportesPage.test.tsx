import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/club', () => ({
  clubApi: {
    reporte: vi.fn(),
    auditoria: vi.fn(),
    clienteDetalle: vi.fn(),
    clientes: vi.fn(),
  },
}));

import { clubApi } from '@/api/club';
import { ReportesPage } from '@/pages/gestion/ReportesPage';
import { REPORTE } from '@/features/clientes/pruebas/datos';
import { ProveedoresGestion } from '@/features/clientes/pruebas/ProveedoresGestion';

const api = vi.mocked(clubApi);

function renderizar(esDueno = true) {
  return render(<ProveedoresGestion esDueno={esDueno}><ReportesPage /></ProveedoresGestion>);
}

// Pantallas completas: con varios archivos en paralelo, la máquina puede ir lenta.
configure({ asyncUtilTimeout: 5000 });

describe('ReportesPage', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'));
    vi.clearAllMocks();
    api.reporte.mockResolvedValue(REPORTE);
    api.auditoria.mockResolvedValue([
      {
        id: 1, created_at: '2026-10-01T14:00:00.000Z', accion: 'pago.registrar', entidad: 'pago', entidad_id: '5',
        detalle: { monto: 12000, medio: 'efectivo' }, actor: 'Facu',
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a un encargado le explica que los reportes son del dueño', () => {
    renderizar(false);
    expect(screen.getByText('Los reportes son solo para el dueño del club')).toBeInTheDocument();
    expect(api.reporte).not.toHaveBeenCalled();
  });

  it('muestra los indicadores, el mapa de calor accesible y las horas valle', async () => {
    renderizar();
    expect(await screen.findByText('60%')).toBeInTheDocument();
    await waitFor(() => expect(api.reporte).toHaveBeenCalled());
    expect(api.reporte).toHaveBeenCalledWith(1, '2026-09-04', '2026-10-01');
    expect(screen.getByText('120 h')).toBeInTheDocument();

    const tabla = screen.getByRole('table', { name: /Porcentaje de ocupación/ });
    const martes = within(tabla).getByRole('rowheader', { name: 'Martes' });
    expect(martes).toBeInTheDocument();
    expect(within(tabla).getAllByRole('columnheader').map((celda) => celda.textContent)).toEqual(['15 h', '16 h', '19 h', '20 h']);
    expect(within(tabla).getAllByText('100%')).toHaveLength(1);

    expect(screen.getByText('Martes de 15 a 17 h')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Publicar un partido abierto/ })).toHaveAttribute('href', '/gestion/1/agenda?publicar=1');
    expect(screen.getByText('Cancha 1')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('carga la actividad reciente recién al abrirla', async () => {
    const user = userEvent.setup({ delay: null });
    renderizar();
    await screen.findByText('60%');
    expect(api.auditoria).not.toHaveBeenCalled();
    const boton = screen.getByRole('button', { name: 'Actividad reciente' });
    await user.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByText('registró un pago')).toBeInTheDocument();
    expect(screen.getByText('$ 12.000 · Efectivo')).toBeInTheDocument();
  });
});
