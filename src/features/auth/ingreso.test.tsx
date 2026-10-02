import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { AuthContext, type AuthContextValue } from '@/contexts/auth';
import { IngresarPage } from '@/pages/IngresarPage';

// La pantalla no habla con Supabase: todo pasa por el contexto de sesión simulado.
// (La campanita del encabezado consulta notificaciones: se responde vacío.)
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: async () => ({ data: 0, error: null }) } }));

function crearAuth(cambios: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    session: null,
    perfil: null,
    loading: false,
    recuperandoClave: false,
    esAdmin: false,
    esStaff: false,
    signIn: vi.fn(async () => null),
    signUp: vi.fn(async () => ({ error: null, requiereConfirmacion: true })),
    reenviarConfirmacion: vi.fn(async () => null),
    signOut: vi.fn(async () => undefined),
    enviarRecuperacion: vi.fn(async () => null),
    cambiarClave: vi.fn(async () => null),
    terminarRecuperacion: vi.fn(),
    refreshPerfil: vi.fn(async () => undefined),
    ...cambios,
  };
}

function mostrar(auth: AuthContextValue, ruta = '/ingresar') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/ingresar" element={<IngresarPage />} />
            <Route path="/app" element={<p>Pantalla de inicio</p>} />
            <Route path="/club/:slug" element={<p>Pantalla del club</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// Escribir letra por letra es lento cuando corren todas las pruebas juntas: margen amplio.
describe('pantalla de ingreso', { timeout: 30_000 }, () => {
  it('cambiar de pestaña no envía ningún formulario y conserva el email', async () => {
    const usuario = userEvent.setup({ delay: null });
    const auth = crearAuth();
    mostrar(auth);

    await usuario.type(screen.getByLabelText('Email'), 'ana@mail.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await usuario.click(screen.getByRole('tab', { name: 'Crear cuenta' }));
    await usuario.click(screen.getByRole('tab', { name: 'Recuperar' }));

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.enviarRecuperacion).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email')).toHaveValue('ana@mail.com');
  });

  it('no deja crear una cuenta con el nombre vacío', async () => {
    const usuario = userEvent.setup({ delay: null });
    const auth = crearAuth();
    mostrar(auth, '/ingresar?modo=registro');

    await usuario.type(screen.getByLabelText('Nombre y apellido'), '   ');
    await usuario.type(screen.getByLabelText('Email'), 'ana@mail.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await usuario.click(screen.getByRole('radio', { name: /Intermedio/ }));
    await usuario.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Crear cuenta' }));

    expect(auth.signUp).not.toHaveBeenCalled();
    expect(screen.getByText('Escribí tu nombre.')).toBeInTheDocument();
  });

  it('crea la cuenta con el teléfono normalizado y pide confirmar el email', async () => {
    const usuario = userEvent.setup({ delay: null });
    const auth = crearAuth();
    mostrar(auth, '/ingresar?modo=registro');

    await usuario.type(screen.getByLabelText('Nombre y apellido'), '  Ana   Pérez ');
    await usuario.type(screen.getByLabelText('Email'), 'ana@mail.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await usuario.click(screen.getByRole('radio', { name: /Intermedio/ }));
    await usuario.type(screen.getByLabelText('Teléfono (opcional)'), '11 2233-4455');
    await usuario.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Crear cuenta' }));

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'ana@mail.com', password: 'secreta123', nombre: 'Ana Pérez', nivel: 5, telefono: '5491122334455', destino: '/app',
    });
    expect(await screen.findByRole('heading', { name: 'Revisá tu email' })).toBeInTheDocument();
  });

  it('el email de confirmación vuelve a la ruta pedida y se puede reenviar', async () => {
    const usuario = userEvent.setup({ delay: null });
    const auth = crearAuth();
    mostrar(auth, '/ingresar?modo=registro&siguiente=%2Fclub%2Fsur');

    await usuario.type(screen.getByLabelText('Nombre y apellido'), 'Ana Pérez');
    await usuario.type(screen.getByLabelText('Email'), 'ana@mail.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreta123');
    await usuario.click(screen.getByRole('radio', { name: /Intermedio/ }));
    await usuario.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Crear cuenta' }));

    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ destino: '/club/sur' }));
    await usuario.click(await screen.findByRole('button', { name: 'Reenviar el email' }));
    expect(auth.reenviarConfirmacion).toHaveBeenCalledWith('ana@mail.com', '/club/sur');
    expect(await screen.findByRole('button', { name: 'Email reenviado' })).toBeDisabled();
  });

  it('muestra el error del servidor al ingresar', async () => {
    const usuario = userEvent.setup({ delay: null });
    const auth = crearAuth({ signIn: vi.fn(async () => 'Email o contraseña incorrectos.') });
    mostrar(auth);

    await usuario.type(screen.getByLabelText('Email'), 'ana@mail.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'equivocada');
    await usuario.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Ingresar' }));

    expect(auth.signIn).toHaveBeenCalledWith('ana@mail.com', 'equivocada');
    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument();
  });

  it('con la sesión abierta vuelve a la ruta pedida', async () => {
    mostrar(crearAuth({ session: { user: { id: 'u1' } } as unknown as Session }), '/ingresar?siguiente=%2Fclub%2Fsur');
    expect(await screen.findByText('Pantalla del club')).toBeInTheDocument();
  });

  it('ignora rutas externas en ?siguiente=', async () => {
    mostrar(crearAuth({ session: { user: { id: 'u1' } } as unknown as Session }), '/ingresar?siguiente=https%3A%2F%2Fmalicioso.com');
    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
  });
});
