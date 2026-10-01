import { useState } from 'react';
import type { InvitacionCreada } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EnlaceInvitacion } from '@/features/ajustes/EnlaceInvitacion';
import { FormInvitar } from '@/features/ajustes/FormInvitar';

/** La administración actúa como dueña de cualquier club, así que puede invitar a su dueño. */
export function InvitarDuenoModal({ club, onClose }: { club: { id: number; nombre: string }; onClose: () => void }) {
  const [creada, setCreada] = useState<InvitacionCreada | null>(null);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invitar al dueño de ${club.nombre}`}
      descripcion={creada ? undefined : 'Se suma como dueño: va a poder configurar el club, sus canchas, horarios y equipo.'}
      footer={creada
        ? <Button onClick={onClose}>Listo</Button>
        : <Button variant="secondary" onClick={onClose}>Cancelar</Button>}
    >
      {creada
        ? <EnlaceInvitacion invitacion={creada} clubNombre={club.nombre} />
        : <FormInvitar clubId={club.id} rolFijo="dueno" onCreada={setCreada} enfocar />}
    </Modal>
  );
}
