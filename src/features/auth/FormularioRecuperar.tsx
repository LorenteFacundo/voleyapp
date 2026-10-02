import { useRef, useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Aviso } from '@/components/ui/Estados';
import { validarEmail } from './validacion';

/** Pide el enlace para elegir una contraseña nueva (llega a /perfil). */
export function FormularioRecuperar({
  email, onEmailChange, onIrAIngresar,
}: { email: string; onEmailChange: (email: string) => void; onIrAIngresar: () => void }) {
  const { enviarRecuperacion } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const refEmail = useRef<HTMLInputElement>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nuevo = validarEmail(email);
    setError(nuevo);
    setErrorGeneral(null);
    if (nuevo) { refEmail.current?.focus(); return; }
    setEnviando(true);
    try {
      const resultado = await enviarRecuperacion(email.trim());
      if (resultado) setErrorGeneral(resultado);
      else setEnviadoA(email.trim());
    } finally {
      setEnviando(false);
    }
  }

  if (enviadoA) {
    return (
      <div className="space-y-4">
        <Aviso tono="exito" titulo="Revisá tu email">
          Si hay una cuenta con <strong className="break-all">{enviadoA}</strong>, te llega un enlace para elegir una
          contraseña nueva. Puede tardar unos minutos: mirá también en spam.
        </Aviso>
        <Button variant="secondary" fullWidth onClick={onIrAIngresar}>Volver a ingresar</Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={enviar} className="space-y-4">
      <p className="text-sm text-ink/65">Escribí el email de tu cuenta y te mandamos un enlace para elegir una contraseña nueva.</p>
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
        error={error}
      />
      <Button type="submit" size="lg" fullWidth loading={enviando}>
        {!enviando && <Mail size={18} aria-hidden="true" />}
        Mandarme el enlace
      </Button>
    </form>
  );
}
