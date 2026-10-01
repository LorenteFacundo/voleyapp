import { useRef, useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Aviso } from '@/components/ui/Estados';
import { CampoClave } from './CampoClave';
import { validarEmail } from './validacion';

/**
 * Ingreso con email y contraseña. Al iniciar sesión, la pantalla redirige
 * sola (ver IngresarPage): este formulario solo muestra errores.
 */
export function FormularioIngreso({
  email, onEmailChange, onOlvideClave,
}: { email: string; onEmailChange: (email: string) => void; onOlvideClave: () => void }) {
  const { signIn } = useAuth();
  const [clave, setClave] = useState('');
  const [errores, setErrores] = useState<{ email: string | null; clave: string | null }>({ email: null, clave: null });
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refEmail = useRef<HTMLInputElement>(null);
  const refClave = useRef<HTMLInputElement>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nuevos = { email: validarEmail(email), clave: clave ? null : 'Escribí tu contraseña.' };
    setErrores(nuevos);
    setErrorGeneral(null);
    if (nuevos.email) { refEmail.current?.focus(); return; }
    if (nuevos.clave) { refClave.current?.focus(); return; }
    setEnviando(true);
    try {
      const error = await signIn(email.trim(), clave);
      if (error) setErrorGeneral(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="space-y-4">
      {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}
      <Input
        ref={refEmail}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        value={email}
        onChange={(evento) => onEmailChange(evento.target.value)}
        error={errores.email}
      />
      <CampoClave
        ref={refClave}
        label="Contraseña"
        autoComplete="current-password"
        value={clave}
        onChange={(evento) => setClave(evento.target.value)}
        error={errores.clave}
      />
      <Button type="submit" size="lg" fullWidth loading={enviando}>
        {!enviando && <LogIn size={18} aria-hidden="true" />}
        Ingresar
      </Button>
      <div className="text-center">
        <button
          type="button"
          onClick={onOlvideClave}
          className="min-h-11 rounded-lg px-2 text-sm font-semibold text-vb-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>
    </form>
  );
}
