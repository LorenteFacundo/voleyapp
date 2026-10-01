import { useId } from 'react';
import { toast } from 'sonner';
import { mensajeDeError } from '@/api/cliente';
import type { Cliente } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ClienteForm } from './ClienteForm';
import { useGuardarCliente } from './useMutacionesClientes';

/** Alta de un cliente nuevo. */
export function ClienteFormModal({ onClose, onCreado }: { onClose: () => void; onCreado?: (cliente: Cliente) => void }) {
  const formId = useId();
  const guardar = useGuardarCliente();

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo cliente"
      descripcion="Con su teléfono vas a poder escribirle por WhatsApp desde acá."
      bloqueado={guardar.isPending}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardar.isPending}>Cancelar</Button>
          <Button type="submit" form={formId} loading={guardar.isPending}>Guardar cliente</Button>
        </>
      )}
    >
      <ClienteForm
        id={formId}
        onSubmit={(datos) => guardar.mutate(datos, {
          onSuccess: (cliente) => {
            toast.success(`${cliente.nombre} se agregó a tus clientes.`);
            onClose();
            onCreado?.(cliente);
          },
          onError: (error) => toast.error(mensajeDeError(error)),
        })}
      />
    </Modal>
  );
}
