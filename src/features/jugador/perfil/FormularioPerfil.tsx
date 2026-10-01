import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import type { Perfil } from '@/api/tipos';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { mensajeDeError } from '@/api/cliente';
import { useAuth } from '@/contexts/auth';
import { formatTelefono } from '@/lib/telefono';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SelectorNivel } from '@/features/auth/SelectorNivel';
import { limpiarNombre, validarNombre, validarTelefonoOpcional } from '@/features/auth/validacion';

type Errores = { nombre: string | null; nivel: string | null; telefono: string | null };

/**
 * Datos editables del perfil. Se monta con key={perfil.id}: el estado
 * inicial sale del perfil y no se pisa mientras la persona escribe.
 */
export function FormularioPerfil({ perfil }: { perfil: Perfil }) {
  const { refreshPerfil } = useAuth();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(perfil.nombre ?? '');
  const [nivel, setNivel] = useState<number | null>(perfil.nivel);
  const [telefono, setTelefono] = useState(perfil.telefono ? formatTelefono(perfil.telefono) : '');
  const [errores, setErrores] = useState<Errores>({ nombre: null, nivel: null, telefono: null });
  const refNombre = useRef<HTMLInputElement>(null);
  const refTelefono = useRef<HTMLInputElement>(null);

  const guardar = useMutation({
    mutationFn: jugadorApi.actualizarPerfil,
    onSuccess: async () => {
      await refreshPerfil();
      void queryClient.invalidateQueries({ queryKey: claves.ranking });
      void queryClient.invalidateQueries({ queryKey: claves.partidos });
      toast.success('Guardamos tus datos.');
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  const telefonoValidado = validarTelefonoOpcional(telefono);
  const hayCambios = limpiarNombre(nombre) !== (perfil.nombre ?? '')
    || nivel !== perfil.nivel
    || (!telefonoValidado.error && telefonoValidado.valor !== perfil.telefono)
    || !!telefonoValidado.error;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nuevos: Errores = {
      nombre: validarNombre(nombre),
      nivel: nivel == null ? 'Elegí tu nivel de juego.' : null,
      telefono: telefonoValidado.error,
    };
    setErrores(nuevos);
    if (nuevos.nombre) { refNombre.current?.focus(); return; }
    if (nuevos.nivel || nivel == null) return;
    if (nuevos.telefono) { refTelefono.current?.focus(); return; }
    guardar.mutate({ nombre: limpiarNombre(nombre), nivel, telefono: telefonoValidado.valor });
  }

  return (
    <form noValidate onSubmit={enviar} className="space-y-4">
      <Input
        ref={refNombre}
        label="Nombre y apellido"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={80}
        value={nombre}
        onChange={(evento) => setNombre(evento.target.value)}
        error={errores.nombre}
      />
      <SelectorNivel
        valor={nivel}
        onChange={setNivel}
        error={errores.nivel}
        ayuda="Los partidos piden un nivel mínimo: con el tuyo te podés sumar a los que te quedan cómodos."
      />
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
        hint="Lo ven solo los clubes donde reservás, para avisarte si hay algún cambio."
      />
      <div className="flex justify-end">
        <Button type="submit" loading={guardar.isPending} disabled={!hayCambios}>
          {!guardar.isPending && <Save size={17} aria-hidden="true" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
