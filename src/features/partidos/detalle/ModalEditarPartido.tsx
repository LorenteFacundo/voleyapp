import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import type { ConfigPartido, PartidoDetalle } from '@/api/tipos';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { mensajeDeError } from '@/api/cliente';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CamposPartido } from '../CamposPartido';
import { formularioDesdePartido, validarFormularioPartido, type ErroresPartido } from '../formulario';

/** Edición del partido por quien organiza. Se monta al abrirse: arranca con los datos actuales. */
export function ModalEditarPartido({ partido, onCerrar }: { partido: PartidoDetalle; onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const idFormulario = useId();
  const [formulario, setFormulario] = useState(() => formularioDesdePartido(partido));
  const [errores, setErrores] = useState<ErroresPartido>({});
  // Personas con cuenta que ya ocupan lugar (confirmadas o esperando aprobación).
  const anotados = Math.max(1, partido.ocupados - partido.invitados);

  const guardar = useMutation({
    mutationFn: (config: ConfigPartido) => jugadorApi.actualizarPartido(partido.id, config),
    onSuccess: () => {
      toast.success('Guardamos los cambios del partido.');
      void queryClient.invalidateQueries({ queryKey: claves.partidos });
      onCerrar();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const { errores: nuevos, config } = validarFormularioPartido(formulario, { precioTotal: partido.precio_total, anotados });
    setErrores(nuevos);
    if (config) guardar.mutate(config);
  }

  return (
    <Modal
      open
      onClose={onCerrar}
      title="Editar partido"
      descripcion="Los cambios se ven al instante en la página del partido."
      bloqueado={guardar.isPending}
      footer={(
        <>
          <Button variant="secondary" onClick={onCerrar} disabled={guardar.isPending}>Cancelar</Button>
          <Button type="submit" form={idFormulario} loading={guardar.isPending}>
            {!guardar.isPending && <Save size={17} aria-hidden="true" />} Guardar cambios
          </Button>
        </>
      )}
    >
      <form id={idFormulario} noValidate onSubmit={enviar}>
        <CamposPartido
          valor={formulario}
          onChange={(cambios) => setFormulario((actual) => ({ ...actual, ...cambios }))}
          errores={errores}
          precioTotal={partido.precio_total}
          anotados={anotados}
        />
      </form>
    </Modal>
  );
}
