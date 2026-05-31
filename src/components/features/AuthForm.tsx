import { FormEvent, useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type AuthFormProps = {
  onMessage: (msg: string) => void;
};

const AUTH_TABS = [
  { id: 'login', label: 'Entrar' },
  { id: 'registro', label: 'Registro' },
];

export function AuthForm({ onMessage }: AuthFormProps) {
  const { signIn, signUp } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [nivel, setNivel] = useState('5');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error =
      authMode === 'registro'
        ? await signUp(email, password, nombre, Number(nivel))
        : await signIn(email, password);

    if (error) {
      onMessage(error);
      return;
    }

    setPassword('');
    onMessage(
      authMode === 'registro'
        ? 'Cuenta creada. Revisa tu email si Supabase pide confirmacion.'
        : 'Sesion iniciada.',
    );
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
          <Input
            label="Nivel de voley"
            type="number"
            min={1}
            max={10}
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
          />
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

      <Button type="submit" fullWidth>
        <LogIn size={17} />
        {authMode === 'registro' ? 'Crear cuenta' : 'Iniciar sesion'}
      </Button>
    </form>
  );
}
