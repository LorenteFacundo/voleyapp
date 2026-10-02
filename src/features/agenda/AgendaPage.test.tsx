// Prueba de la pantalla completa con un servidor falso en memoria: no usa Supabase.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import type { BloqueDisponible, Ocupacion } from '@/api/tipos';
import { fechaArgentina } from '@/lib/date';
import { ConfirmarProvider } from '@/components/ui/Confirmar';
import { GestionContext } from '@/contexts/gestion';
import { AgendaPage } from '@/pages/gestion/AgendaPage';
import { crearOcupacion, crearPanel } from './fixtures';

const api = vi.hoisted(() => ({
  agenda: vi.fn(),
  pendientes: vi.fn(),
  pagosInformados: vi.fn(),
  crearReserva: vi.fn(),
  clientes: vi.fn(),
  registrarPago: vi.fn(),
  anularPago: vi.fn(),
  resolverSolicitud: vi.fn(),
  conflictos: vi.fn(),
  bloquear: vi.fn(),
  cancelarOcupacion: vi.fn(),
  actualizarOcupacion: vi.fn(),
  moverOcupacion: vi.fn(),
  publicarPartido: vi.fn(),
}));
const publico = vi.hoisted(() => ({ disponibilidad: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/api/club', () => ({ clubApi: api }));
vi.mock('@/api/publico', () => ({ publicoApi: publico }));

// Son pruebas de interacción completas: con toda la suite en paralelo la
// máquina se satura, así que se les da más margen que el predeterminado.
vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 10_000 });

const panel = crearPanel({ pendientes: 1 });
const ANA = { id: 10, nombre: 'Ana Gómez', telefono: '5491155556666', email: 'ana@mail.com', es_usuario_app: true };

let ocupaciones: Ocupacion[] = [];

function fakeServidor() {
  ocupaciones = [
    // Jueves 1 de octubre: Cancha 1 de 19 a 21 (WhatsApp) y un pedido de la app en Cancha 2.
    crearOcupacion({ id: 100 }),
    crearOcupacion({
      id: 101, cancha_id: 2, estado: 'pendiente', origen: 'app', vence_at: '2026-10-01T17:00:00.000Z', sena: 10000,
      cliente: ANA, jugador: { nombre: ANA.nombre, email: ANA.email, telefono: ANA.telefono },
    }),
  ];
  api.agenda.mockImplementation(async (_club: number, desde: string, hasta: string) => ({
    desde,
    hasta,
    ocupaciones: ocupaciones.filter((o) => fechaArgentina(o.inicio) >= desde && fechaArgentina(o.inicio) <= hasta
      && (o.estado === 'pendiente' || o.estado === 'confirmada')),
  }));
  api.pendientes.mockImplementation(async () => ocupaciones.filter((o) => o.estado === 'pendiente'));
  api.pagosInformados.mockImplementation(async () => ocupaciones.filter((o) => o.pago_informado_at && o.pagado < o.precio));
  api.clientes.mockResolvedValue([]);
  api.registrarPago.mockImplementation(async ({ monto, ocupacionId }: { monto: number; ocupacionId: number }) => {
    ocupaciones = ocupaciones.map((o) => (o.id === ocupacionId
      ? { ...o, pagado: o.pagado + monto, estado_pago: o.pagado + monto >= o.precio ? 'pagado' : 'parcial' }
      : o));
    return { pago_id: 55, ocupacion: ocupaciones.find((o) => o.id === ocupacionId) ?? null, saldo_cliente: 0 };
  });
}

function renderAgenda(ruta = '/gestion/7/agenda', panelDePrueba = panel) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfirmarProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route
              path="/gestion/:clubId/agenda"
              element={(
                <GestionContext.Provider value={{ clubId: 7, panel: panelDePrueba, rol: 'dueno', esDueno: true }}>
                  <AgendaPage />
                </GestionContext.Provider>
              )}
            />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </ConfirmarProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  // jsdom no trae matchMedia (lo usa el Toaster).
  window.matchMedia ??= ((consulta: string) => ({
    matches: false, media: consulta, onchange: null,
    addListener: () => undefined, removeListener: () => undefined,
    addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  // Jueves 1 de octubre de 2026, 12:00 en Buenos Aires.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'));
  vi.clearAllMocks();
  fakeServidor();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('agenda del club', () => {
  it('muestra el día con reservas, pedidos y turnos libres', async () => {
    renderAgenda();
    expect(await screen.findByRole('button', { name: /Juan Pérez, cargada por el club, por WhatsApp/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jueves 1 de octubre' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancha 2, Ana Gómez, pedido pendiente, vence en 2 h/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Libre de 21:00 a 23:00 en Cancha 1, \$30\.000/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1 pedido sin responder/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1 turno libre hoy/ })).toBeInTheDocument();
    expect(api.agenda).toHaveBeenCalledWith(7, '2026-10-01', '2026-10-01', false);
  });

  it('respeta la fecha de la URL', async () => {
    renderAgenda('/gestion/7/agenda?fecha=2026-10-02');
    expect(await screen.findByRole('heading', { name: 'Viernes 2 de octubre' })).toBeInTheDocument();
    await waitFor(() => expect(api.agenda).toHaveBeenCalledWith(7, '2026-10-02', '2026-10-02', false));
  });

  it('carga una reserva desde un turno libre con el precio del bloque', async () => {
    const user = userEvent.setup();
    api.crearReserva.mockImplementation(async (datos: { inicio: string; fin: string }) => crearOcupacion({
      id: 200, inicio: datos.inicio, fin: datos.fin,
      cliente: { id: 11, nombre: 'Carlos Ruiz', telefono: '5491122334455', email: null, es_usuario_app: false },
    }));
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: /Libre de 21:00 a 23:00 en Cancha 1/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva reserva' });
    expect(within(dialogo).getByLabelText('Precio')).toHaveValue('30000');
    expect(within(dialogo).getByLabelText('Hora de inicio')).toHaveValue('21:00');

    await user.click(within(dialogo).getByRole('radio', { name: 'Nuevo' }));
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Carlos Ruiz');
    await user.type(within(dialogo).getByLabelText('Teléfono (opcional)'), '11 2233-4455');
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar reserva' }));

    await waitFor(() => expect(api.crearReserva).toHaveBeenCalledWith({
      clubId: 7,
      canchaId: 1,
      inicio: '2026-10-02T00:00:00.000Z',
      fin: '2026-10-02T02:00:00.000Z',
      clienteId: null,
      clienteNombre: 'Carlos Ruiz',
      clienteTelefono: '5491122334455',
      origen: 'whatsapp',
      precio: 30000,
      titulo: null,
      notas: null,
    }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nueva reserva' })).not.toBeInTheDocument());
    expect(await screen.findByText(/Reserva guardada: Cancha 1, 21:00–23:00/)).toBeInTheDocument();
  });

  it('no guarda sin cliente ni título y muestra el error del servidor', async () => {
    const user = userEvent.setup();
    api.crearReserva.mockRejectedValue(new Error('Se superpone con otra reserva o bloqueo en esa cancha'));
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: /Libre de 21:00 a 23:00/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva reserva' });
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar reserva' }));
    expect(api.crearReserva).not.toHaveBeenCalled();
    expect(within(dialogo).getByText(/Elegí un cliente, cargá uno nuevo/)).toBeInTheDocument();

    await user.click(within(dialogo).getByRole('radio', { name: 'Sin cliente' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Clase' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar reserva' }));
    expect(await within(dialogo).findByText('Se superpone con otra reserva o bloqueo en esa cancha')).toBeInTheDocument();
    expect(api.crearReserva).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Clase', clienteId: null, clienteNombre: null }));
  });

  it('registra un pago desde el detalle de la reserva', async () => {
    const user = userEvent.setup();
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: /Juan Pérez, cargada por el club/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Juan Pérez' });
    expect(within(dialogo).getByRole('link', { name: /^Confirmación/ })).toHaveAttribute('href', expect.stringContaining('https://wa.me/5491122334455?text='));
    await user.click(within(dialogo).getByRole('button', { name: 'Total $30.000' }));
    await waitFor(() => expect(api.registrarPago).toHaveBeenCalledWith({ clubId: 7, monto: 30000, medio: 'efectivo', ocupacionId: 100 }));
    await waitFor(() => expect(within(dialogo).queryByRole('button', { name: 'Total $30.000' })).not.toBeInTheDocument());
    expect(await screen.findByText(/Registraste un pago de \$30\.000 \(efectivo\)/)).toBeInTheDocument();
  });

  it('confirma un pedido desde el panel de pendientes', async () => {
    const user = userEvent.setup();
    api.resolverSolicitud.mockImplementation(async (id: number) => {
      ocupaciones = ocupaciones.map((o) => (o.id === id ? { ...o, estado: 'confirmada' } : o));
      return { estado: 'confirmada' };
    });
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: /^1 pedido sin responder/ }));
    const panelPedidos = await screen.findByRole('dialog', { name: 'Pedidos sin responder' });
    expect(await within(panelPedidos).findByText('Ana Gómez')).toBeInTheDocument();
    await user.click(within(panelPedidos).getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => expect(api.resolverSolicitud).toHaveBeenCalledWith(101, true, null));
    expect(await screen.findByText(/Confirmaste la reserva de Ana Gómez/)).toBeInTheDocument();
    expect(await within(panelPedidos).findByText('No hay pedidos pendientes')).toBeInTheDocument();
  });

  it('avisa con claridad si el pedido venció antes de responderlo', async () => {
    const user = userEvent.setup();
    api.resolverSolicitud.mockResolvedValue({ estado: 'vencida' });
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: /^1 pedido sin responder/ }));
    const panelPedidos = await screen.findByRole('dialog', { name: 'Pedidos sin responder' });
    await user.click(await within(panelPedidos).findByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText(/venció antes de que lo respondieras y el horario quedó libre/)).toBeInTheDocument();
  });

  it('rechaza un pedido pidiendo un motivo', async () => {
    const user = userEvent.setup();
    api.resolverSolicitud.mockResolvedValue({ estado: 'rechazada' });
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: /Ana Gómez, pedido pendiente/ }));
    const detalle = await screen.findByRole('dialog', { name: 'Ana Gómez' });
    await user.click(within(detalle).getByRole('button', { name: /Rechazar/ }));
    const confirmacion = await screen.findByRole('dialog', { name: 'Rechazar pedido' });
    await user.type(within(confirmacion).getByLabelText('Motivo (opcional)'), 'Cancha en mantenimiento');
    await user.click(within(confirmacion).getByRole('button', { name: 'Rechazar pedido' }));
    await waitFor(() => expect(api.resolverSolicitud).toHaveBeenCalledWith(101, false, 'Cancha en mantenimiento'));
  });

  it('bloquea canchas mostrando antes las reservas afectadas', async () => {
    const user = userEvent.setup();
    api.conflictos.mockImplementation(async () => [ocupaciones[0]]);
    api.bloquear.mockImplementation(async () => ({
      bloqueos: 2,
      canceladas: [{ ...ocupaciones[0], estado: 'cancelada', motivo_cancelacion: 'Lluvia', cancelada_por: 'club' }],
    }));
    renderAgenda();
    await screen.findByRole('button', { name: /Juan Pérez/ });
    await user.click(screen.getByRole('button', { name: 'Bloquear' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Bloquear canchas' });
    await user.click(within(dialogo).getByRole('button', { name: 'Lluvia' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Revisar y bloquear' }));

    await waitFor(() => expect(api.conflictos).toHaveBeenCalledWith(7, [1, 2], '2026-10-01T15:00:00.000Z', '2026-10-02T02:00:00.000Z'));
    expect(await within(dialogo).findByText('Hay 1 reserva en ese horario')).toBeInTheDocument();
    const confirmar = within(dialogo).getByRole('button', { name: 'Bloquear y cancelar 1 reserva' });
    expect(confirmar).toBeDisabled();
    await user.click(within(dialogo).getByRole('checkbox', { name: /Sí, cancelar esta reserva/ }));
    await user.click(confirmar);

    await waitFor(() => expect(api.bloquear).toHaveBeenCalledWith({
      clubId: 7, canchas: [1, 2], inicio: '2026-10-01T15:00:00.000Z', fin: '2026-10-02T02:00:00.000Z', motivo: 'Lluvia', cancelarReservas: true,
    }));
    const aviso = await within(dialogo).findByRole('link', { name: /^Avisar a Juan/ });
    expect(decodeURIComponent(aviso.getAttribute('href') ?? '')).toContain('Motivo: Lluvia.');
  });

  it('arma el mensaje de turnos libres para compartir', async () => {
    const user = userEvent.setup();
    const bloque: BloqueDisponible = {
      horario_id: 2, cancha_id: 1, fecha: '2026-10-01', hora_inicio: '21:00', hora_fin: '23:00',
      inicio: '2026-10-02T00:00:00+00:00', fin: '2026-10-02T02:00:00+00:00', precio: 30000, sena: 10000,
      estado: 'libre', ocupacion_id: null,
    };
    publico.disponibilidad.mockResolvedValue({ desde: '2026-10-01', hasta: '2026-10-01', bloques: [bloque] });
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: /turno libre hoy/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Compartir turnos libres' });
    const mensaje = await within(dialogo).findByLabelText('Mensaje');
    expect(mensaje).toHaveValue([
      '🏐 Turnos libres en Club Vóley Palermo',
      '',
      '*Hoy jueves 1*',
      '• 21:00–23:00 Cancha 1 ($30.000)',
      '',
      `Reservá acá: ${window.location.origin}/club/voley-palermo`,
    ].join('\n'));
    expect(publico.disponibilidad).toHaveBeenCalledWith({ clubId: 7, desde: '2026-10-01', hasta: '2026-10-01' });
    expect(within(dialogo).getByRole('link', { name: /^Enviar por WhatsApp/ })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/\?text=/));
  });

  it('cambia a la vista semanal', async () => {
    const user = userEvent.setup();
    renderAgenda();
    await screen.findByRole('button', { name: /Juan Pérez/ });
    await user.click(screen.getByRole('button', { name: 'Semana' }));
    await waitFor(() => expect(api.agenda).toHaveBeenCalledWith(7, '2026-09-28', '2026-10-04', false));
    expect(await screen.findByRole('heading', { name: /Semana del 28 sept? al 4 oct/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /de 19:00 a 21:00, Cancha 1, Juan Pérez/ })).toBeInTheDocument();
  });

  it('abre el partido abierto con ?publicar=1 sugiriendo un turno libre', async () => {
    renderAgenda('/gestion/7/agenda?publicar=1');
    const dialogo = await screen.findByRole('dialog', { name: 'Publicar partido abierto' });
    await waitFor(() => expect(within(dialogo).getByLabelText('Hora de inicio')).toHaveValue('21:00'));
    expect(within(dialogo).getByLabelText('Precio por jugador')).toHaveValue('2500');
  });
it('cancela una reserva y deja listo el aviso por WhatsApp', async () => {
    const user = userEvent.setup();
    api.cancelarOcupacion.mockImplementation(async (id: number, motivo: string | null) => {
      const cancelada = { ...ocupaciones.find((o) => o.id === id)!, estado: 'cancelada' as const, motivo_cancelacion: motivo, cancelada_por: 'club' as const };
      ocupaciones = ocupaciones.map((o) => (o.id === id ? cancelada : o));
      return cancelada;
    });
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: /Juan Pérez, cargada por el club/ }));
    const detalle = await screen.findByRole('dialog', { name: 'Juan Pérez' });
    await user.click(within(detalle).getByRole('button', { name: 'Cancelar reserva' }));
    const confirmacion = await screen.findByRole('dialog', { name: 'Cancelar reserva' });
    await user.type(within(confirmacion).getByLabelText('Motivo (opcional)'), 'Lluvia');
    await user.click(within(confirmacion).getByRole('button', { name: 'Cancelar reserva' }));
    await waitFor(() => expect(api.cancelarOcupacion).toHaveBeenCalledWith(100, 'Lluvia'));
    const aviso = await within(detalle).findByRole('link', { name: /^Avisar a Juan/ });
    expect(decodeURIComponent(aviso.getAttribute('href') ?? '')).toContain('tuvimos que cancelar tu reserva de Cancha 1, hoy de 19:00 a 21:00. Motivo: Lluvia.');
    expect(within(detalle).queryByRole('button', { name: 'Mover' })).not.toBeInTheDocument();
  });

  it('un turno fijo se libera por fecha y un bloqueo solo se quita', async () => {
    const user = userEvent.setup();
    ocupaciones = [
      crearOcupacion({ id: 300, origen: 'fijo', serie_id: 4 }),
      crearOcupacion({
        id: 301, cancha_id: 2, tipo: 'bloqueo', origen: 'otro', cliente: null, titulo: 'Torneo', precio: 0,
        inicio: '2026-10-01T03:00:00.000Z', fin: '2026-10-02T03:00:00.000Z',
      }),
    ];
    renderAgenda();
    await user.click(await screen.findByRole('button', { name: /Juan Pérez, turno fijo/ }));
    const fijo = await screen.findByRole('dialog', { name: 'Juan Pérez' });
    expect(within(fijo).getByRole('button', { name: 'Liberar esta fecha' })).toBeInTheDocument();
    await user.click(within(fijo).getByRole('button', { name: 'Cerrar' }));

    await user.click(await screen.findByRole('button', { name: /^Bloqueo: Torneo/ }));
    const bloqueo = await screen.findByRole('dialog', { name: 'Bloqueo: Torneo' });
    expect(within(bloqueo).getByRole('button', { name: 'Quitar bloqueo' })).toBeInTheDocument();
    expect(within(bloqueo).queryByRole('button', { name: 'Mover' })).not.toBeInTheDocument();
    expect(within(bloqueo).queryByText('Cobro')).not.toBeInTheDocument();
  });

  it('lista los pagos informados y abre el cobro por transferencia', async () => {
    const user = userEvent.setup();
    ocupaciones = [crearOcupacion({ id: 400, sena: 10000, pago_informado_at: '2026-10-01T14:00:00.000Z' })];
    renderAgenda('/gestion/7/agenda', crearPanel({ pagos_informados: 1 }));
    await user.click(await screen.findByRole('button', { name: /^1 pago informado/ }));
    const pagos = await screen.findByRole('dialog', { name: 'Pagos informados' });
    expect(await within(pagos).findByText('Juan Pérez')).toBeInTheDocument();
    expect(within(pagos).getByText(/Avisó hace 1 h/)).toBeInTheDocument();
    await user.click(within(pagos).getByRole('button', { name: 'Registrar pago' }));
    const detalle = await screen.findByRole('dialog', { name: 'Juan Pérez' });
    expect(within(detalle).getByRole('radio', { name: 'Transferencia' })).toBeChecked();
    expect(within(detalle).getByRole('button', { name: 'Seña $10.000' })).toBeInTheDocument();
    expect(api.pagosInformados).toHaveBeenCalledWith(7);
  });
});
