import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('@/contexts/auth', () => ({
  useAuth: () => ({ perfil: { id: 'yo', es_superadmin: false }, session: { user: { id: 'yo' } }, loading: false }),
}));
vi.mock('@/api/admin', () => ({
  adminApi: {
    resumen: vi.fn(),
    clubes: vi.fn(),
    crearClub: vi.fn(),
    usuarios: vi.fn(),
    actualizarRol: vi.fn(),
    configurarOperacion: vi.fn(),
    definirAcceso: vi.fn(),
    auditoria: vi.fn(),
    ejecutarTareas: vi.fn(),
    leads: vi.fn(),
    actualizarLead: vi.fn(),
  },
}));
vi.mock('@/api/club', () => ({ clubApi: { invitar: vi.fn() } }));

import { toast } from 'sonner';
import { adminApi } from '@/api/admin';
import { ApiError } from '@/api/cliente';
import { clubApi } from '@/api/club';
import type { ResumenAdmin as DatosResumen, UsuarioAdmin } from '@/api/tipos';
import { AuditoriaAdmin } from './AuditoriaAdmin';
import { ClubesAdmin } from './ClubesAdmin';
import { LeadsAdmin } from './LeadsAdmin';
import { OperacionAdmin } from './OperacionAdmin';
import { ResumenAdmin } from './ResumenAdmin';
import { UsuariosAdmin } from './UsuariosAdmin';
import { ProveedoresAdmin } from './pruebas/Proveedores';

const api = vi.mocked(adminApi);

const RESUMEN: DatosResumen = {
  clubes: 3, clubes_publicados: 2, canchas: 7, usuarios: 120, usuarios_semana: 9, reservas_semana: 40,
  reservas_app_semana: 12, pendientes: 2, vencidas_semana: 1, leads_nuevos: 1, envios_con_error: 0,
  operacion: { reservas_pausadas: false, motivo_pausa: null, requiere_lista_acceso: true, cuenta_habilitada: true, puede_reservar: true },
};

function usuario(id: string, nombre: string, cambios: Partial<UsuarioAdmin> = {}): UsuarioAdmin {
  return {
    id, nombre, email: `${id}@mail.com`, rol: 'jugador', nivel: 5, telefono: null, created_at: '2026-09-01T12:00:00.000Z',
    habilitado: false, clubes: [], ...cambios,
  };
}

const renderizar = (elemento: React.ReactNode) => render(<ProveedoresAdmin>{elemento}</ProveedoresAdmin>);

describe('Administración', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.resumen.mockResolvedValue(RESUMEN);
  });

  it('muestra los indicadores y ejecuta las tareas a demanda', async () => {
    const user = userEvent.setup();
    api.ejecutarTareas.mockResolvedValue({ vencidas: 2, partidos_finalizados: 1, recordatorios: 5, fijos_generados: 8 });
    renderizar(<ResumenAdmin />);
    expect(await screen.findByText('120')).toBeInTheDocument();
    expect(screen.getByText('+9 esta semana')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Clubes interesados nuevos/ })).toHaveAttribute('href', '/admin/solicitudes');
    await user.click(screen.getByRole('button', { name: 'Ejecutar tareas ahora' }));
    expect(await screen.findByText('Fechas de fijos generadas')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('no deja cambiar el propio rol ni otorgar roles de administración sin ser superadmin', async () => {
    const user = userEvent.setup();
    api.usuarios.mockResolvedValue([
      usuario('yo', 'Yo Admin', { rol: 'admin_global' }),
      usuario('otro', 'Otra Admin', { rol: 'admin_global' }),
      usuario('ju', 'Juan Jugador'),
    ]);
    api.actualizarRol.mockRejectedValue(new ApiError('Usuario no encontrado'));
    renderizar(<UsuariosAdmin />);

    expect(await screen.findByLabelText('Rol de Yo Admin')).toBeDisabled();
    expect(screen.getByText('No podés cambiar tu propio rol.')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol de Otra Admin')).toBeDisabled();
    const rolJuan = screen.getByLabelText('Rol de Juan Jugador');
    expect(within(rolJuan).getByRole('option', { name: 'Administración' })).toBeDisabled();

    await user.selectOptions(rolJuan, 'admin_cancha');
    const confirmacion = await screen.findByRole('dialog', { name: '¿Cambiar el rol de Juan Jugador?' });
    await user.click(within(confirmacion).getByRole('button', { name: 'Cambiar rol' }));
    expect(api.actualizarRol).toHaveBeenCalledWith('ju', 'admin_cancha');
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Usuario no encontrado'));
  });

  it('habilita el acceso al piloto', async () => {
    const user = userEvent.setup();
    api.usuarios.mockResolvedValue([usuario('ju', 'Juan Jugador')]);
    api.definirAcceso.mockResolvedValue(undefined);
    renderizar(<UsuariosAdmin />);
    await user.click(await screen.findByRole('switch', { name: 'Acceso al piloto de Juan Jugador' }));
    expect(api.definirAcceso).toHaveBeenCalledWith('ju', true);
  });

  it('pausa las reservas con un mensaje después de confirmar', async () => {
    const user = userEvent.setup();
    api.configurarOperacion.mockResolvedValue({ ...RESUMEN.operacion, reservas_pausadas: true });
    renderizar(<OperacionAdmin />);
    await user.click(await screen.findByRole('switch', { name: 'Reservas de jugadores pausadas' }));
    await user.type(screen.getByLabelText('Mensaje para los jugadores (opcional)'), 'Volvemos el lunes');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirmacion = await screen.findByRole('dialog', { name: '¿Aplicar los cambios de operación?' });
    expect(within(confirmacion).getByText('Se pausan los pedidos nuevos de jugadores desde la app.')).toBeInTheDocument();
    await user.click(within(confirmacion).getByRole('button', { name: 'Aplicar' }));
    expect(api.configurarOperacion).toHaveBeenCalledWith({ reservasPausadas: true, requiereListaAcceso: true, motivo: 'Volvemos el lunes' });
  });

  it('gestiona los clubes interesados', async () => {
    const user = userEvent.setup();
    api.leads.mockResolvedValue([
      {
        id: 1, club_nombre: 'Club Norte', localidad: 'Olivos', contacto_nombre: 'Marta', contacto: 'marta@club.com',
        cantidad_canchas: 2, estado: 'nuevo', notas: null, created_at: '2026-09-30T12:00:00.000Z',
      },
      {
        id: 2, club_nombre: 'Club Oeste', localidad: 'Morón', contacto_nombre: 'Luis', contacto: '11 4455-6677',
        cantidad_canchas: 1, estado: 'contactado', notas: 'Llamar el martes', created_at: '2026-09-20T12:00:00.000Z',
      },
    ]);
    api.actualizarLead.mockResolvedValue(undefined);
    renderizar(<LeadsAdmin />);
    expect(await screen.findByRole('link', { name: /marta@club.com/ })).toHaveAttribute('href', 'mailto:marta@club.com');
    expect(screen.getByRole('link', { name: /\+54 9 11 4455-6677/ })).toHaveAttribute('href', expect.stringContaining('https://wa.me/5491144556677'));

    await user.selectOptions(screen.getByLabelText('Seguimiento de Club Norte'), 'contactado');
    expect(api.actualizarLead).toHaveBeenCalledWith(1, { estado: 'contactado' });

    const notas = screen.getByLabelText('Notas internas de Club Oeste');
    expect(notas).toHaveValue('Llamar el martes');
    await user.type(notas, ' a la tarde');
    await user.click(screen.getByRole('button', { name: 'Guardar notas' }));
    expect(api.actualizarLead).toHaveBeenCalledWith(2, { notas: 'Llamar el martes a la tarde' });
  });

  it('crea un club y ofrece invitar al dueño', async () => {
    const user = userEvent.setup();
    api.clubes.mockResolvedValue([]);
    api.crearClub.mockResolvedValue({ club_id: 4, slug: 'club-este' });
    vi.mocked(clubApi.invitar).mockResolvedValue({
      id: 3, token: 'tok3', email: 'duena@mail.com', rol: 'dueno', expira_at: '2026-10-08T15:00:00.000Z',
    });
    renderizar(<ClubesAdmin />);
    await user.click((await screen.findAllByRole('button', { name: 'Nuevo club' }))[0]);
    const alta = await screen.findByRole('dialog', { name: 'Nuevo club' });
    await user.type(within(alta).getByLabelText('Nombre del club'), 'Club Este');
    await user.click(within(alta).getByLabelText('Latitud (opcional)'));
    await user.paste('-34.6037, -58.3816');
    expect(within(alta).getByLabelText('Latitud (opcional)')).toHaveValue('-34.6037');
    expect(within(alta).getByLabelText('Longitud (opcional)')).toHaveValue('-58.3816');
    await user.click(within(alta).getByRole('button', { name: 'Crear club' }));
    expect(api.crearClub).toHaveBeenCalledWith({
      nombre: 'Club Este', zona: null, direccion: null, latitud: -34.6037, longitud: -58.3816, telefono: null, whatsapp: null,
    });

    const creado = await screen.findByRole('dialog', { name: 'Club Este ya está creado' });
    await user.type(within(creado).getByLabelText('Email de la persona'), 'duena@mail.com');
    await user.click(within(creado).getByRole('button', { name: 'Crear invitación' }));
    expect(clubApi.invitar).toHaveBeenCalledWith(4, 'duena@mail.com', 'dueno');
    expect(await screen.findByLabelText('Enlace de invitación')).toHaveValue(`${window.location.origin}/invitacion/tok3`);
  });

  it('traduce y filtra la auditoría', async () => {
    const user = userEvent.setup();
    api.auditoria.mockResolvedValue([
      { id: 1, created_at: '2026-10-01T15:00:00.000Z', accion: 'reserva.confirmar', entidad: 'ocupacion', entidad_id: '8', detalle: {}, actor: 'Ana', club: 'Club Sur' },
      { id: 2, created_at: '2026-10-01T14:00:00.000Z', accion: 'acceso.habilitar', entidad: 'usuario', entidad_id: 'x', detalle: { motivo: 'piloto' }, actor: 'Admin', club: null },
    ]);
    renderizar(<AuditoriaAdmin />);
    expect(await screen.findByText('Pedido confirmado')).toBeInTheDocument();
    expect(screen.getByText('Cuenta habilitada para el piloto')).toBeInTheDocument();
    expect(screen.getAllByText('Ver detalle')).toHaveLength(1);
    await user.selectOptions(screen.getByLabelText('Tipo de movimiento'), 'reserva');
    expect(screen.queryByText('Cuenta habilitada para el piloto')).not.toBeInTheDocument();
  });
});
