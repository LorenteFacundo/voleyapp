import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/club', () => ({
  clubApi: {
    clientes: vi.fn(),
    clienteDetalle: vi.fn(),
    guardarCliente: vi.fn(),
    archivarCliente: vi.fn(),
    registrarPago: vi.fn(),
  },
}));

import { clubApi } from '@/api/club';
import { ClientesPage } from '@/pages/gestion/ClientesPage';
import { cliente, detalleCliente } from './pruebas/datos';
import { ProveedoresGestion } from './pruebas/ProveedoresGestion';

const api = vi.mocked(clubApi);

function renderizar() {
  return render(<ProveedoresGestion><ClientesPage /></ProveedoresGestion>);
}

async function abrirFicha(user: ReturnType<typeof userEvent.setup>) {
  const [boton] = await screen.findAllByRole('button', { name: /Ana Pérez/ });
  await user.click(boton);
  return screen.findByRole('dialog', { name: 'Ana Pérez' });
}

// Pantallas completas: con varios archivos en paralelo, la máquina puede ir lenta.
configure({ asyncUtilTimeout: 5000 });

describe('ClientesPage', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'));
    vi.clearAllMocks();
    api.clientes.mockResolvedValue([cliente(), cliente({ id: 8, nombre: 'Beto', telefono: null, saldo: 3000, es_usuario_app: false })]);
    api.clienteDetalle.mockResolvedValue(detalleCliente());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lista los clientes con su saldo y arma el cobro por WhatsApp con el alias', async () => {
    const user = userEvent.setup({ delay: null });
    renderizar();
    expect((await screen.findAllByText('Debe $ 12.000')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('A favor $ 3.000').length).toBeGreaterThan(0);
    expect(screen.getByText('2 clientes')).toBeInTheDocument();

    const ficha = await abrirFicha(user);
    const cobrar = within(ficha).getByRole('link', { name: /Cobrar saldo/ });
    const mensaje = decodeURIComponent(cobrar.getAttribute('href') ?? '');
    expect(mensaje).toContain('https://wa.me/5491122334455?text=');
    expect(mensaje).toContain('Tenés un saldo pendiente de $ 12.000');
    expect(mensaje).toContain('club.norte.mp');
    expect(within(ficha).getByText('Martes vóley')).toBeInTheDocument();
  });

  it('registra un pago a cuenta desde la ficha', async () => {
    const user = userEvent.setup({ delay: null });
    api.registrarPago.mockResolvedValue({ pago_id: 1, ocupacion: null, saldo_cliente: 0 });
    renderizar();
    const ficha = await abrirFicha(user);
    await user.click(within(ficha).getByRole('button', { name: /Registrar pago a cuenta/ }));

    const monto = await within(ficha).findByLabelText('Monto');
    expect(monto).toHaveValue('12000');
    await user.click(within(ficha).getByRole('radio', { name: 'Transferencia' }));
    await user.click(within(ficha).getByRole('button', { name: 'Registrar pago' }));

    await waitFor(() => expect(api.registrarPago).toHaveBeenCalled());
    expect(api.registrarPago).toHaveBeenCalledWith({
      clubId: 1, monto: 12000, medio: 'transferencia', fecha: '2026-10-01', nota: null, clienteId: 7, ocupacionId: null,
    });
    expect(await within(ficha).findByRole('button', { name: /Registrar pago a cuenta/ })).toBeInTheDocument();
  });

  it('crea un cliente con el teléfono normalizado y abre su ficha', async () => {
    const user = userEvent.setup({ delay: null });
    api.guardarCliente.mockResolvedValue({ ...detalleCliente().cliente, id: 9, nombre: 'Carla Gómez' });
    renderizar();
    await screen.findAllByText('Debe $ 12.000');
    await user.click(screen.getByRole('button', { name: 'Nuevo cliente' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo cliente' });

    await user.click(within(dialogo).getByRole('button', { name: 'Guardar cliente' }));
    expect(within(dialogo).getByText('Ingresá el nombre.')).toBeInTheDocument();
    expect(api.guardarCliente).not.toHaveBeenCalled();

    await user.type(within(dialogo).getByLabelText('Nombre'), 'Carla Gómez');
    await user.type(within(dialogo).getByLabelText('Teléfono (WhatsApp)'), '11 5555-6666');
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar cliente' }));

    await waitFor(() => expect(api.guardarCliente).toHaveBeenCalled());
    expect(api.guardarCliente).toHaveBeenCalledWith({
      clubId: 1, nombre: 'Carla Gómez', telefono: '5491155556666', email: null, notas: null,
    });
    await screen.findByRole('dialog', { name: 'Ana Pérez' });
    await waitFor(() => expect(api.clienteDetalle).toHaveBeenCalled());
    expect(api.clienteDetalle).toHaveBeenCalledWith(9);
  });

  it('importa una planilla: muestra la vista previa, crea las filas válidas y resume', async () => {
    const user = userEvent.setup({ delay: null });
    api.guardarCliente.mockResolvedValue({ ...detalleCliente().cliente, id: 20, nombre: 'Carla' });
    renderizar();
    await screen.findAllByText('Debe $ 12.000');
    await user.click(screen.getByRole('button', { name: 'Importar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Importar clientes' });

    const planilla = new File(
      ['nombre;telefono;email\nCarla;11 5555 6666;\nAna Pérez;11 2233 4455;\nX;;'],
      'clientes.csv',
      { type: 'text/csv' },
    );
    await user.upload(await within(dialogo).findByLabelText('Planilla en formato CSV'), planilla);
    expect(await within(dialogo).findByText('1 lista')).toBeInTheDocument();
    expect(within(dialogo).getByText(/Ya está en tus clientes como «Ana Pérez»/)).toBeInTheDocument();
    expect(within(dialogo).getByText('El nombre debe tener al menos 2 caracteres.')).toBeInTheDocument();

    await user.click(within(dialogo).getByRole('button', { name: 'Importar 1 cliente' }));
    expect(await within(dialogo).findByText('Importación terminada')).toBeInTheDocument();
    expect(api.guardarCliente).toHaveBeenCalledTimes(1);
    expect(api.guardarCliente).toHaveBeenCalledWith({
      clubId: 1, nombre: 'Carla', telefono: '5491155556666', email: null, notas: null,
    });
    expect(within(dialogo).getByText('1 cliente creado.')).toBeInTheDocument();
  });

  it('archiva un cliente después de confirmar', async () => {
    const user = userEvent.setup({ delay: null });
    api.archivarCliente.mockResolvedValue(undefined);
    renderizar();
    const ficha = await abrirFicha(user);
    await user.click(within(ficha).getByRole('button', { name: 'Archivar' }));
    const confirmacion = await screen.findByRole('dialog', { name: '¿Archivar a Ana Pérez?' });
    expect(confirmacion).toHaveTextContent('Tiene 1 fijo activo');
    await user.click(within(confirmacion).getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(api.archivarCliente).toHaveBeenCalled());
    expect(api.archivarCliente).toHaveBeenCalledWith(7, true);
  });
});
