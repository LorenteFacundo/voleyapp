import { useId, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MailPlus } from 'lucide-react';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { InvitacionCreada, RolClub } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ROLES_CLUB } from './equipo';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Props = {
  clubId: number;
  /** Si se indica, no se elige el rol (por ejemplo, al invitar al dueño desde la administración). */
  rolFijo?: RolClub;
  onCreada: (invitacion: InvitacionCreada) => void;
  /** Enfoca el email al abrir el diálogo que lo contiene. */
  enfocar?: boolean;
};

/** Crea una invitación al equipo del club; el enlace lo muestra quien la usa. */
export function FormInvitar({ clubId, rolFijo, onCreada, enfocar }: Props) {
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolClub>(rolFijo ?? 'encargado');
  const [error, setError] = useState<string | null>(null);
  const nombreGrupo = useId();

  const invitar = useMutation({
    mutationFn: (datos: { email: string; rol: RolClub }) => clubApi.invitar(clubId, datos.email, datos.rol),
    onSuccess: (invitacion) => {
      setEmail('');
      setError(null);
      onCreada(invitacion);
    },
    onError: (motivo) => setError(mensajeDeError(motivo)),
  });

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const limpio = email.trim().toLowerCase();
    if (!EMAIL.test(limpio)) {
      setError('Escribí un email válido, por ejemplo nombre@gmail.com.');
      return;
    }
    invitar.mutate({ email: limpio, rol: rolFijo ?? rol });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <Input
        label="Email de la persona"
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={254}
        data-autofocus={enfocar || undefined}
        value={email}
        error={error}
        onChange={(evento) => {
          setEmail(evento.target.value);
          if (error) setError(null);
        }}
        hint="Tiene que ingresar a VoleyApp con este email (si no tiene cuenta, la crea con él)."
      />
      {!rolFijo && (
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-ink">Rol</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(['encargado', 'dueno'] as const).map((opcion) => (
              <label
                key={opcion}
                className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-xl border border-ink/15 p-3 transition has-[:checked]:border-vb-orange-ink has-[:checked]:bg-vb-orange-light has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-vb-orange-ink"
              >
                <input
                  type="radio"
                  name={nombreGrupo}
                  value={opcion}
                  checked={rol === opcion}
                  onChange={() => setRol(opcion)}
                  className="mt-0.5 h-4 w-4 accent-vb-orange-ink"
                />
                <span className="text-sm font-bold text-ink">{ROLES_CLUB[opcion].etiqueta}</span>
                <span className="col-start-2 text-xs text-ink/65">{ROLES_CLUB[opcion].resumen}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Button type="submit" loading={invitar.isPending}>
        <MailPlus size={16} aria-hidden="true" /> Crear invitación
      </Button>
    </form>
  );
}
