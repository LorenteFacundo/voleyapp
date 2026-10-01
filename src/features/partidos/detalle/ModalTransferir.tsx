import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown } from 'lucide-react';
import { toast } from 'sonner';
import type { PartidoDetalle } from '@/api/tipos';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { mensajeDeError } from '@/api/cliente';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

/** Pasar la organización a otra persona confirmada en el partido. */
export function ModalTransferir({ partido, onCerrar }: { partido: PartidoDetalle; onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const idFormulario = useId();
  const candidatos = partido.participantes.filter((participante) => participante.estado === 'confirmado'
    && !participante.es_organizador && !participante.soy_yo && participante.usuario_id);
  const [elegido, setElegido] = useState(candidatos[0]?.usuario_id ?? '');
  const nombreElegido = candidatos.find((candidato) => candidato.usuario_id === elegido)?.nombre ?? '';

  const transferir = useMutation({
    mutationFn: () => jugadorApi.transferirPartido(partido.id, elegido),
    onSuccess: () => {
      toast.success(`Listo: ahora organiza ${nombreElegido}.`);
      void queryClient.invalidateQueries({ queryKey: claves.partidos });
      onCerrar();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (elegido) transferir.mutate();
  }

  return (
    <Modal
      open
      onClose={onCerrar}
      title="Pasar la organización"
      size="sm"
      bloqueado={transferir.isPending}
      footer={candidatos.length ? (
        <>
          <Button variant="secondary" onClick={onCerrar} disabled={transferir.isPending}>Cancelar</Button>
          <Button type="submit" form={idFormulario} loading={transferir.isPending} disabled={!elegido}>
            {!transferir.isPending && <Crown size={17} aria-hidden="true" />} Pasar la organización
          </Button>
        </>
      ) : <Button variant="secondary" onClick={onCerrar}>Entendido</Button>}
    >
      {candidatos.length ? (
        <form id={idFormulario} noValidate onSubmit={enviar} className="space-y-4">
          <Select label="¿Quién organiza ahora?" value={elegido} onChange={(evento) => setElegido(evento.target.value)}>
            {candidatos.map((candidato) => (
              <option key={candidato.usuario_id} value={candidato.usuario_id ?? ''}>{candidato.nombre}</option>
            ))}
          </Select>
          <Aviso tono="info">
            Va a poder editar el partido, aprobar jugadores y cancelarlo. Vos seguís anotado como jugador y la reserva de la
            cancha sigue a nombre de quien la pidió.
          </Aviso>
        </form>
      ) : (
        <p className="text-sm text-ink/70">
          Todavía no hay otra persona confirmada. Cuando alguien se sume, vas a poder pasarle la organización.
        </p>
      )}
    </Modal>
  );
}
