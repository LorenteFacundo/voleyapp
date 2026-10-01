import { useState, type FormEvent } from 'react';
import { useClientes } from '@/api/consultas';
import { Aviso } from '@/components/ui/Estados';
import { Input, Textarea } from '@/components/ui/Input';
import { formatTelefono, normalizarTelefono } from '@/lib/telefono';
import { useGestion } from '@/contexts/gestion';
import { useValorDiferido } from '@/hooks/useValorDiferido';
import { validarDatosCliente, type DatosCliente, type ErroresCliente } from './validacion';

type Props = {
  id: string;
  /** Datos actuales al editar. */
  inicial?: (DatosCliente & { id: number }) | null;
  onSubmit: (datos: DatosCliente) => void;
};

/** Alta o edición de un cliente. El botón de guardar vive en el pie del diálogo (atributo form). */
export function ClienteForm({ id, inicial, onSubmit }: Props) {
  const { clubId } = useGestion();
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [telefono, setTelefono] = useState(inicial?.telefono ? formatTelefono(inicial.telefono) : '');
  const [email, setEmail] = useState(inicial?.email ?? '');
  const [notas, setNotas] = useState(inicial?.notas ?? '');
  const [errores, setErrores] = useState<ErroresCliente>({});

  // Aviso (no bloqueante) si ya hay otro cliente con el mismo teléfono.
  const normalizado = useValorDiferido(normalizarTelefono(telefono), 400);
  const mismoTelefono = useClientes(normalizado ? clubId : null, normalizado ?? '', true);
  const repetido = normalizado
    ? mismoTelefono.data?.find((cliente) => cliente.telefono === normalizado && cliente.id !== inicial?.id)
    : undefined;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const resultado = validarDatosCliente({ nombre, telefono, email, notas });
    setErrores(resultado.errores);
    if (resultado.datos) onSubmit(resultado.datos);
  }

  const telefonoNormalizado = normalizarTelefono(telefono);

  return (
    <form id={id} onSubmit={enviar} noValidate className="space-y-4">
      <Input
        label="Nombre"
        value={nombre}
        onChange={(evento) => setNombre(evento.target.value)}
        maxLength={120}
        autoComplete="off"
        required
        error={errores.nombre}
        data-autofocus
      />
      <Input
        label="Teléfono (WhatsApp)"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={telefono}
        onChange={(evento) => setTelefono(evento.target.value)}
        error={errores.telefono}
        hint={telefonoNormalizado
          ? `Se guarda como ${formatTelefono(telefonoNormalizado)}.`
          : 'Opcional. Con característica, por ejemplo 11 2233-4455.'}
      />
      {repetido && (
        <Aviso tono="alerta">
          Ya tenés a «{repetido.nombre}» con este teléfono{repetido.archivado ? ' (archivado)' : ''}. Revisá que no sea la misma persona.
        </Aviso>
      )}
      <Input
        label="Email (opcional)"
        type="email"
        inputMode="email"
        autoComplete="off"
        value={email}
        onChange={(evento) => setEmail(evento.target.value)}
        maxLength={254}
        error={errores.email}
      />
      <Textarea
        label="Notas (opcional)"
        value={notas}
        onChange={(evento) => setNotas(evento.target.value)}
        maxLength={1000}
        error={errores.notas}
        hint="Por ejemplo: juega los martes, prefiere la cancha 2."
      />
    </form>
  );
}
