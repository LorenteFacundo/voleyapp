import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { nivelesVoley } from '@/lib/nivel';
import { consumePostAuthRoute } from '@/lib/navigation';

type AuthFormProps = {
  onMessage: (msg: string) => void;
};

const AUTH_TABS = [
  { id: 'login', label: 'Entrar' },
  { id: 'registro', label: 'Registro' },
];

export function AuthForm({ onMessage }: AuthFormProps) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [nivel, setNivel] = useState('');
  const [working, setWorking] = useState(false);

  async function resetPassword() {
    if (!email.trim()) { onMessage('Ingresá tu email para recuperar la contraseña.'); return; }
    setWorking(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/perfil?recuperar=1`,
    });
    setWorking(false);
    onMessage(error ? error.message : 'Si existe una cuenta con ese email, recibirás un enlace para cambiar la contraseña.');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    try {
      const error = authMode === 'registro'
        ? await signUp(email.trim(), password, nombre.trim(), Number(nivel))
        : await signIn(email.trim(), password);

      if (error) {
        onMessage(error);
        return;
      }

      setPassword('');
      if (authMode === 'registro') {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          onMessage('Cuenta creada. Revisá tu email y confirmá la cuenta para continuar.');
          return;
        }
      }

      onMessage(authMode === 'registro' ? 'Cuenta creada.' : 'Sesión iniciada.');
      const next = consumePostAuthRoute();
      if (next) navigate(next, { replace: true });
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <Tabs
        tabs={AUTH_TABS}
        activeTab={authMode}
        onChange={(id) => setAuthMode(id as 'login' | 'registro')}
      />

      {authMode === 'registro' && (
        <>
          <Input
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <label htmlFor="nivel-voley" className="block text-sm font-semibold text-ink">
            Nivel de vóley
            <select
              id="nivel-voley"
              required
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-normal focus:ring-2 focus:ring-court/40 focus:outline-none"
            >
              <option value="" disabled>Elegí tu nivel</option>
              {nivelesVoley.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </>
      )}

      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Contraseña"
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Button type="submit" fullWidth loading={working}>
        <LogIn size={17} />
        {authMode === 'registro' ? 'Crear cuenta' : 'Iniciar sesion'}
      </Button>
      {authMode === 'login' && <button type="button" onClick={resetPassword} disabled={working} className="w-full text-center text-sm font-semibold text-vb-blue underline-offset-2 hover:underline">Olvidé mi contraseña</button>}
    </form>
  );
}
