import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { CampoClave } from './CampoClave';
import { MIN_CLAVE, validarClave, validarRepeticion } from './validacion';

/** Elegir una contraseña nueva (después de un enlace de recuperación o desde el perfil). */
export function FormularioNuevaClave({
  onListo, acciones, textoBoton = 'Guardar contraseña',
}: { onListo?: () => void; acciones?: ReactNode; textoBoton?: string }) {
  const { cambiarClave } = useAuth();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errores, setErrores] = useState<{ clave: string | null; repetida: string | null }>({ clave: null, repetida: null });
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refClave = useRef<HTMLInputElement>(null);
  const refRepetida = useRef<HTMLInputElement>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nuevos = { clave: validarClave(clave), repetida: validarRepeticion(clave, repetida) };
    setErrores(nuevos);
    setErrorGeneral(null);
    if (nuevos.clave) { refClave.current?.focus(); return; }
    if (nuevos.repetida) { refRepetida.current?.focus(); return; }
    setEnviando(true);
    try {
      const error = await cambiarClave(clave);
      if (error) {
        setErrorGeneral(error);
        return;
      }
      toast.success('Listo, cambiaste tu contraseña.');
      onListo?.();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="space-y-4">
      {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}
      <CampoClave
        ref={refClave}
        label="Nueva contraseña"
        autoComplete="new-password"
        value={clave}
        onChange={(evento) => setClave(evento.target.value)}
        error={errores.clave}
        hint={`Al menos ${MIN_CLAVE} caracteres.`}
      />
      <CampoClave
        ref={refRepetida}
        label="Repetí la contraseña"
        autoComplete="new-password"
        value={repetida}
        onChange={(evento) => setRepetida(evento.target.value)}
        error={errores.repetida}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {acciones}
        <Button type="submit" loading={enviando}>
          {!enviando && <KeyRound size={17} aria-hidden="true" />}
          {textoBoton}
        </Button>
      </div>
    </form>
  );
}
