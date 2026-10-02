import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('@/contexts/auth', () => ({
  useAuth: () => ({ refreshPerfil: vi.fn().mockResolvedValue(undefined), session: null, perfil: null, loading: false }),
}));
vi.mock('@/api/club', () => ({
  clubApi: {
    panel: vi.fn(),
    actualizarClub: vi.fn(),
    guardarCancha: vi.fn(),
    guardarHorarios: vi.fn(),
    subirFoto: vi.fn(),
    equipo: vi.fn(),
    invitar: vi.fn(),
    revocarInvitacion: vi.fn(),
    cambiarMiembro: vi.fn(),
  },
}));

import { ApiError } from '@/api/cliente';
import { clubApi } from '@/api/club';
import type { ClubPanel } from '@/api/tipos';
import { AjustesPage } from '@/pages/gestion/AjustesPage';
import { CLUB, EQUIPO, PANEL } from './pruebas/datos';
import { ProveedoresAjustes } from './pruebas/Proveedores';

const api = vi.mocked(clubApi);

function renderizar(panel: ClubPanel = PANEL, ruta?: string) {
  api.panel.mockResolvedValue(panel);
  return render(<ProveedoresAjustes ruta={ruta}><AjustesPage /></ProveedoresAjustes>);
}

async function abrirSeccion(nombre: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('tab', { name: nombre }));
  return user;
}

describe('Ajustes del club', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    api.equipo.mockResolvedValue(EQUIPO);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a un encargado le explica que es solo para dueños', async () => {
    renderizar({ ...PANEL, mi_rol: 'encargado' });
    expect(await screen.findByText('Los ajustes son solo para dueños')).toBeInTheDocument();
    expect(api.equipo).not.toHaveBeenCalled();
  });

  it('guarda solo los datos del club que cambiaron, ya normalizados', async () => {
    const user = userEvent.setup();
    // Como el servidor real: después de guardar, el panel devuelve los datos nuevos.
    api.actualizarClub.mockImplementation(async (_clubId, datos) => {
      const club = { ...CLUB, ...datos };
      api.panel.mockResolvedValue({ ...PANEL, club });
      return club;
    });
    renderizar();

    const whatsapp = await screen.findByLabelText('WhatsApp');
    expect(whatsapp).toHaveValue('+54 9 11 2233-4455');
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();

    await user.clear(whatsapp);
    await user.type(whatsapp, '011 15 5566-7788');
    await user.clear(screen.getByLabelText('Instagram (opcional)'));
    await user.type(screen.getByLabelText('Instagram (opcional)'), 'https://instagram.com/club.sur/');
    expect(screen.getByText('Se guardará como +54 9 11 5566-7788.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(api.actualizarClub).toHaveBeenCalledWith(1, { whatsapp: '5491155667788', instagram: 'club.sur' });
    expect(await screen.findByLabelText('WhatsApp')).toHaveValue('+54 9 11 5566-7788');
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
  });

  it('marca en el campo el error del servidor', async () => {
    const user = userEvent.setup();
    api.actualizarClub.mockRejectedValue(new ApiError('Esa dirección pública ya está en uso'));
    renderizar();
    const slug = await screen.findByLabelText('Dirección pública');
    await user.clear(slug);
    await user.type(slug, 'Club Norte');
    expect(screen.getByText(/\/club\/club-norte$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(api.actualizarClub).toHaveBeenCalledWith(1, { slug: 'club-norte' });
    expect(await screen.findByText('Esa dirección pública ya está en uso')).toBeInTheDocument();
    expect(slug).toHaveAttribute('aria-invalid', 'true');
  });

  it('muestra por qué el servidor no deja publicar', async () => {
    api.actualizarClub.mockRejectedValue(new ApiError('Cargá al menos una cancha activa con horarios antes de publicar el club'));
    renderizar({ ...PANEL, horarios: [] });
    const user = await abrirSeccion('Reservas');
    expect(screen.getByText('Horarios publicados en una cancha activa')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Mostrar el club en VoleyApp' }));
    expect(api.actualizarClub).toHaveBeenCalledWith(1, { publicado: true });
    expect(await screen.findByText('Cargá al menos una cancha activa con horarios antes de publicar el club')).toBeInTheDocument();
  });

  it('cambia las reglas de reserva', async () => {
    api.actualizarClub.mockResolvedValue({ ...CLUB, confirmacion_automatica: true, ventana_reserva_dias: 30 });
    renderizar();
    const user = await abrirSeccion('Reservas');
    expect(screen.getByLabelText('Tiempo para responder pedidos')).toBeEnabled();
    await user.click(screen.getByRole('switch', { name: 'Confirmación automática' }));
    expect(screen.getByLabelText('Tiempo para responder pedidos')).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Ventana de reserva'), '30');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(api.actualizarClub).toHaveBeenCalledWith(1, { confirmacion_automatica: true, ventana_reserva_dias: 30 });
  });

  it('genera bloques consecutivos y guarda la semana de la cancha', async () => {
    api.guardarHorarios.mockResolvedValue(16);
    renderizar();
    const user = await abrirSeccion('Horarios');

    expect(screen.getByRole('option', { name: 'Cancha 2 (inactiva)' })).toBeInTheDocument();
    expect(screen.getByText('1 bloque por semana')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generar bloques' }));
    const generador = await screen.findByRole('dialog', { name: 'Generar bloques' });
    await user.click(within(generador).getByRole('checkbox', { name: 'Sábado' }));
    fireEvent.change(within(generador).getByLabelText('Hasta'), { target: { value: '02:00' } });
    expect(within(generador).getByText(/Cada día: 18:00–20:00, 20:00–22:00, 22:00–24:00, 00:00–02:00/)).toBeInTheDocument();
    expect(within(generador).getByText(/Se reemplaza 1 bloque: Lun 18:00–20:00/)).toBeInTheDocument();
    await user.click(within(generador).getByRole('button', { name: 'Generar 24 bloques' }));

    expect(screen.queryByRole('dialog', { name: 'Generar bloques' })).not.toBeInTheDocument();
    expect(screen.getByText('24 bloques por semana (sin guardar)')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cancha 1 · sin guardar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar horarios' }));
    expect(api.guardarHorarios).toHaveBeenCalledTimes(1);
    const [canchaId, bloques] = api.guardarHorarios.mock.calls[0];
    expect(canchaId).toBe(10);
    expect(bloques).toHaveLength(24);
    expect(bloques[0]).toEqual({ dia_semana: 1, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 30000, precio_sena: 10000 });
    // La madrugada del sábado pasa al domingo.
    expect(bloques[bloques.length - 1]).toEqual({ dia_semana: 0, hora_inicio: '00:00', hora_fin: '02:00', precio_total: 30000, precio_sena: 10000 });
  });

  it('no deja agregar un bloque superpuesto', async () => {
    renderizar();
    const user = await abrirSeccion('Horarios');
    const [agregarLunes] = screen.getAllByRole('button', { name: 'Agregar un bloque el lunes' });
    await user.click(agregarLunes);
    const modal = await screen.findByRole('dialog', { name: 'Agregar bloque' });
    expect(within(modal).getByLabelText('Desde')).toHaveValue('20:00');
    fireEvent.change(within(modal).getByLabelText('Desde'), { target: { value: '19:00' } });
    fireEvent.change(within(modal).getByLabelText('Hasta'), { target: { value: '21:00' } });
    expect(within(modal).getByText('Se superpone con Lun 18:00–20:00.')).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: 'Agregar' }));
    expect(screen.getByRole('dialog', { name: 'Agregar bloque' })).toBeInTheDocument();

    fireEvent.change(within(modal).getByLabelText('Desde'), { target: { value: '20:00' } });
    fireEvent.change(within(modal).getByLabelText('Hasta'), { target: { value: '22:00' } });
    await user.click(within(modal).getByRole('button', { name: 'Agregar' }));
    expect(screen.queryByRole('dialog', { name: 'Agregar bloque' })).not.toBeInTheDocument();
    expect(screen.getByText('2 bloques por semana (sin guardar)')).toBeInTheDocument();
  });

  it('invita a alguien al equipo y muestra el enlace una vez', async () => {
    api.invitar.mockResolvedValue({
      id: 9, token: 'abc123', email: 'carla@mail.com', rol: 'encargado', expira_at: '2026-10-08T15:00:00.000Z',
    });
    renderizar();
    const user = await abrirSeccion('Equipo');
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('vos')).toBeInTheDocument();
    // El único dueño no se puede quitar ni degradar.
    expect(screen.getByRole('button', { name: 'Salir del equipo' })).toBeDisabled();

    await user.type(screen.getByLabelText('Email de la persona'), ' Carla@Mail.com ');
    await user.click(screen.getByRole('button', { name: 'Crear invitación' }));
    expect(api.invitar).toHaveBeenCalledWith(1, 'carla@mail.com', 'encargado');
    const dialogo = await screen.findByRole('dialog', { name: 'Enlace de invitación' });
    expect(within(dialogo).getByLabelText('Enlace de invitación')).toHaveValue(`${window.location.origin}/invitacion/abc123`);
    expect(within(dialogo).getByRole('link', { name: /Compartir por WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('https://wa.me/?text='));
  });

  it('cambia el rol de un miembro después de confirmar', async () => {
    api.cambiarMiembro.mockResolvedValue(undefined);
    renderizar();
    const user = await abrirSeccion('Equipo');
    await screen.findByText('Ana Pérez');
    await user.selectOptions(screen.getByLabelText('Rol de Ana Pérez'), 'dueno');
    const confirmacion = await screen.findByRole('dialog', { name: '¿Hacer dueño a Ana Pérez?' });
    await user.click(within(confirmacion).getByRole('button', { name: 'Cambiar rol' }));
    expect(api.cambiarMiembro).toHaveBeenCalledWith(1, 'u2', 'dueno');
  });

  it('abre la sección indicada en la URL', async () => {
    renderizar(PANEL, '/gestion/1/ajustes?seccion=canchas');
    expect(await screen.findByRole('tab', { name: 'Canchas', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Inactiva')).toBeInTheDocument();
  });
});
