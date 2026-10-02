import { useRef, useState, type FormEvent } from 'react';
import { MailCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Aviso } from '@/components/ui/Estados';
import { CampoClave } from './CampoClave';
import { SelectorNivel } from './SelectorNivel';
import {
  MIN_CLAVE, limpiarNombre, validarClave, validarEmail, validarNombre, validarTelefonoOpcional,
} from './validacion';

type Errores = { nombre: string | null; email: string | null; clave: string | null; nivel: string | null; telefono: string | null };

const SIN_ERRORES: Errores = { nombre: null, email: null, clave: null, nivel: null, telefono: null };

/**
 * Alta de cuenta. Si el proyecto pide confirmar el email, muestra el paso
 * "Revisá tu email"; el enlace del email lleva a `destino` (por defecto, /app).
 */
export function FormularioRegistro({
  email, onEmailChange, onIrAIngresar, destino = null,
}: { email: string; onEmailChange: (email: string) => void; onIrAIngresar: () => void; destino?: string | null }) {
  const { signUp, reenviarConfirmacion } = useAuth();
  const [nombre, setNombre] = useState('');
  const [clave, setClave] = useState('');
  const [nivel, setNivel] = useState<number | null>(null);
  const [telefono, setTelefono] = useState('');
  const [errores, setErrores] = useState<Errores>(SIN_ERRORES);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [reenvio, setReenvio] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const refNombre = useRef<HTMLInputElement>(null);
  const refEmail = useRef<HTMLInputElement>(null);
  const refClave = useRef<HTMLInputElement>(null);
  const refTelefono = useRef<HTMLInputElement>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const telefonoValidado = validarTelefonoOpcional(telefono);
    const nuevos: Errores = {
      nombre: validarNombre(nombre),
      email: validarEmail(email),
      clave: validarClave(clave),
      nivel: nivel == null ? 'Elegí tu nivel: sirve para encontrar partidos a tu medida.' : null,
      telefono: telefonoValidado.error,
    };
    setErrores(nuevos);
    setErrorGeneral(null);
    if (nuevos.nombre) { refNombre.current?.focus(); return; }
    if (nuevos.email) { refEmail.current?.focus(); return; }
    if (nuevos.clave) { refClave.current?.focus(); return; }
    if (nuevos.nivel || nivel == null) return;
    if (nuevos.telefono) { refTelefono.current?.focus(); return; }

    setEnviando(true);
    try {
      const resultado = await signUp({
        email: email.trim(),
        password: clave,
        nombre: limpiarNombre(nombre),
        nivel,
        telefono: telefonoValidado.valor,
        destino,
      });
      if (resultado.error) setErrorGeneral(resultado.error);
      else if (resultado.requiereConfirmacion) setEnviadoA(email.trim());
      // Si no hace falta confirmar, la sesión ya está abierta y la pantalla redirige sola.
      else toast.success('¡Listo, ya tenés tu cuenta!');
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    if (!enviadoA) return;
    setReenvio('enviando');
    const error = await reenviarConfirmacion(enviadoA, destino);
    if (error) {
      toast.error(error);
      setReenvio('listo');
    } else {
      toast.success('Te mandamos el email de nuevo.');
      setReenvio('enviado');
    }
  }

  if (enviadoA) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center" role="status">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green-50 text-green-700">
          <MailCheck size={28} aria-hidden="true" />
        </span>
        <h2 className="font-display text-xl font-black text-vb-blue">Revisá tu email</h2>
        <p className="text-sm text-ink/70">
          Te mandamos un enlace a <strong className="break-all text-ink">{enviadoA}</strong> para confirmar tu cuenta.
          Abrilo y ya podés empezar a jugar.
        </p>
        <p className="text-xs text-ink/65">Si no lo ves en unos minutos, buscalo en spam o en promociones.</p>
        <Button variant="secondary" fullWidth onClick={onIrAIngresar} className="mt-2">Ya confirmé, ingresar</Button>
        <Button variant="ghost" fullWidth onClick={reenviar} loading={reenvio === 'enviando'} disabled={reenvio === 'enviado'}>
          {reenvio === 'enviado' ? 'Email reenviado' : 'Reenviar el email'}
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={enviar} className="space-y-4">
      {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}
      <Input
        ref={refNombre}
        label="Nombre y apellido"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={80}
        value={nombre}
        onChange={(evento) => setNombre(evento.target.value)}
        error={errores.nombre}
        hint="Así te van a ver en los partidos."
      />
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
        autoComplete="new-password"
        value={clave}
        onChange={(evento) => setClave(evento.target.value)}
        error={errores.clave}
        hint={`Al menos ${MIN_CLAVE} caracteres.`}
      />
      <SelectorNivel valor={nivel} onChange={setNivel} error={errores.nivel} />
      <Input
        ref={refTelefono}
        label="Teléfono (opcional)"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="11 2233-4455"
        value={telefono}
        onChange={(evento) => setTelefono(evento.target.value)}
        error={errores.telefono}
        hint="Lo ven solo los clubes donde reservás, para avisarte por WhatsApp si hay algún cambio."
      />
      <Button type="submit" size="lg" fullWidth loading={enviando}>
        {!enviando && <UserPlus size={18} aria-hidden="true" />}
        Crear cuenta
      </Button>
    </form>
  );
}
