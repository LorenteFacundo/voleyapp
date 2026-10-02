import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/club', () => ({
  clubApi: {
    series: vi.fn(),
    clientes: vi.fn(),
    clienteDetalle: vi.fn(),
    guardarCliente: vi.fn(),
    previsualizarSerie: vi.fn(),
    crearSerie: vi.fn(),
    modificarSerie: vi.fn(),
    finalizarSerie: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { FijosPage } from '@/pages/gestion/FijosPage';
import { cliente, serie } from '@/features/clientes/pruebas/datos';
import { ProveedoresGestion } from '@/features/clientes/pruebas/ProveedoresGestion';

const api = vi.mocked(clubApi);

function renderizar() {
  return render(<ProveedoresGestion><FijosPage /></ProveedoresGestion>);
}

// Pantallas completas: con varios archivos en paralelo, la máquina puede ir lenta.
configure({ asyncUtilTimeout: 5000 });

describe('FijosPage', { timeout: 30_000 }, () => {
  beforeEach(() => {
    // Jueves 1 de octubre de 2026, 12:00 en Buenos Aires.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'));
    vi.clearAllMocks();
    api.series.mockResolvedValue([
      serie(),
      serie({ id: 4, titulo: 'Sábado mixto', dia_semana: 6, hora_inicio: '10:00', duracion_min: 120, deuda: 0, cliente: null }),
    ]);
    api.clientes.mockResolvedValue([cliente()]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrupa los fijos por día y muestra la deuda', async () => {
    renderizar();
    expect(await screen.findByRole('heading', { name: 'Martes (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sábado (1)' })).toBeInTheDocument();
    expect(screen.getByText('Te deben $ 8.000')).toBeInTheDocument();
    const tarjeta = screen.getByRole('article', { name: 'Martes vóley' });
    expect(within(tarjeta).getByText('19:00–20:30')).toBeInTheDocument();
    const cobrar = within(tarjeta).getByRole('link', { name: /Cobrar/ });
    expect(decodeURIComponent(cobrar.getAttribute('href') ?? '')).toContain('por el fijo de los martes 19:00');
  });

  it('crea un fijo revisando los choques antes', async () => {
    const user = userEvent.setup({ delay: null });
    api.previsualizarSerie.mockResolvedValue({
      fechas: 12, primera: '2026-10-06', horizonte: '2026-12-24',
      conflictos: [{ fecha: '2026-10-13', detalle: 'Torneo (18:00–22:00)' }],
    });
    api.crearSerie.mockResolvedValue({ serie_id: 9, creadas: 11, conflictos: ['2026-10-13'] });
    renderizar();
    await screen.findByRole('heading', { name: 'Martes (1)' });

    await user.click(screen.getByRole('button', { name: 'Nuevo fijo' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo fijo' });
    await user.click(within(dialogo).getByRole('radio', { name: 'Cliente nuevo' }));
    await user.type(within(dialogo).getByLabelText('Nombre del cliente'), 'Los del martes');
    await user.selectOptions(within(dialogo).getByLabelText('Cancha'), '10');
    await user.selectOptions(within(dialogo).getByLabelText('Día'), '2');
    await user.click(within(dialogo).getByRole('radio', { name: '1 h 30 min' }));
    expect(within(dialogo).getByLabelText('Precio por turno')).toHaveValue('36000');

    await user.click(within(dialogo).getByRole('button', { name: 'Revisar fechas' }));
    await waitFor(() => expect(api.previsualizarSerie).toHaveBeenCalled());
    expect(api.previsualizarSerie).toHaveBeenCalledWith({
      clubId: 1, canchaId: 10, diaSemana: 2, horaInicio: '19:00', duracionMin: 90, desde: '2026-10-06', hasta: null,
    });
    expect(await within(dialogo).findByText(/Torneo/)).toBeInTheDocument();
    const crear = within(dialogo).getByRole('button', { name: 'Crear fijo' });
    expect(crear).toBeDisabled();

    await user.click(within(dialogo).getByRole('checkbox', { name: /Omitir esas fechas/ }));
    expect(crear).toBeEnabled();
    await user.click(crear);
    await waitFor(() => expect(api.crearSerie).toHaveBeenCalled());
    expect(api.crearSerie).toHaveBeenCalledWith({
      clubId: 1, canchaId: 10, titulo: '', diaSemana: 2, horaInicio: '19:00', duracionMin: 90, desde: '2026-10-06',
      hasta: null, precio: 36000, clienteId: null, clienteNombre: 'Los del martes', clienteTelefono: null, notas: null,
      omitirConflictos: true,
    });
    expect(toast.success).toHaveBeenCalledWith('Fijo creado: 11 fechas reservadas.', {
      description: 'Se omitieron por choques: 13/10.',
    });
  });

  it('importa fijos de una planilla y crea una sola vez al cliente sin teléfono', async () => {
    const user = userEvent.setup({ delay: null });
    api.guardarCliente.mockResolvedValue({
      id: 30, nombre: 'Grupo Lunes', telefono: null, email: null, es_usuario_app: false, notas: null, archivado: false,
      created_at: '2026-10-01T15:00:00.000Z',
    });
    api.crearSerie
      .mockResolvedValueOnce({ serie_id: 20, creadas: 12, conflictos: [] })
      .mockResolvedValueOnce({ serie_id: 21, creadas: 10, conflictos: ['2026-10-14', '2026-10-21'] });
    renderizar();
    await screen.findByRole('heading', { name: 'Martes (1)' });
    await user.click(screen.getByRole('button', { name: 'Importar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Importar fijos' });

    const planilla = new File([
      'titulo;cliente;telefono;cancha;dia;hora;duracion_min;precio;desde;hasta\n'
      + ';Grupo Lunes;;Cancha 2;lunes;20;60;30000;;\n'
      + 'Miércoles;Grupo Lunes;;Cancha 2;mie;20;60;30000;;\n',
    ], 'fijos.csv', { type: 'text/csv' });
    await user.upload(await within(dialogo).findByLabelText('Planilla en formato CSV'), planilla);
    await user.click(await within(dialogo).findByRole('button', { name: 'Crear 2 fijos' }));

    expect(await within(dialogo).findByText('Importación terminada')).toBeInTheDocument();
    expect(api.guardarCliente).toHaveBeenCalledTimes(1);
    expect(api.guardarCliente).toHaveBeenCalledWith({ clubId: 1, nombre: 'Grupo Lunes' });
    expect(api.crearSerie).toHaveBeenNthCalledWith(1, expect.objectContaining({
      clienteId: 30, clienteNombre: null, titulo: '', canchaId: 11, diaSemana: 1, horaInicio: '20:00', omitirConflictos: true,
    }));
    expect(api.crearSerie).toHaveBeenNthCalledWith(2, expect.objectContaining({ clienteId: 30, titulo: 'Miércoles', diaSemana: 3 }));
    expect(within(dialogo).getByText('Omitidas por choques: 14/10, 21/10.')).toBeInTheDocument();
  });

  it('termina un fijo desde su próxima fecha', async () => {
    const user = userEvent.setup({ delay: null });
    api.finalizarSerie.mockResolvedValue({ canceladas: 12 });
    renderizar();
    await user.click(await screen.findByRole('button', { name: 'Terminar el fijo Martes vóley' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Terminar fijo' });
    expect(within(dialogo).getByLabelText('Liberar desde')).toHaveValue('2026-10-06');
    await user.click(within(dialogo).getByRole('button', { name: 'Terminar fijo' }));
    await waitFor(() => expect(api.finalizarSerie).toHaveBeenCalled());
    expect(api.finalizarSerie).toHaveBeenCalledWith(3, '2026-10-06');
  });

  it('modifica solo el precio sin pedir revisión de fechas', async () => {
    const user = userEvent.setup({ delay: null });
    api.modificarSerie.mockResolvedValue({ serie_id: 3, creadas: 0, conflictos: [], canceladas: 0 });
    renderizar();
    await user.click(await screen.findByRole('button', { name: 'Modificar el fijo Martes vóley' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Modificar fijo' });
    const guardar = within(dialogo).getByRole('button', { name: 'Guardar cambios' });
    expect(guardar).toBeDisabled();
    const precio = within(dialogo).getByLabelText('Precio por turno');
    await user.clear(precio);
    await user.type(precio, '40.000');
    await user.click(guardar);
    expect(api.previsualizarSerie).not.toHaveBeenCalled();
    await waitFor(() => expect(api.modificarSerie).toHaveBeenCalled());
    expect(api.modificarSerie).toHaveBeenCalledWith({
      serieId: 3, desdeFecha: '2026-10-06', canchaId: 10, diaSemana: 2, horaInicio: '19:00', duracionMin: 90,
      precio: 40000, titulo: 'Martes vóley', hasta: null, omitirConflictos: false,
    });
  });
});
