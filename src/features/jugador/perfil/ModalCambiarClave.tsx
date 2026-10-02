import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormularioNuevaClave } from '@/features/auth/FormularioNuevaClave';

/** Cambio de contraseña desde el perfil (con la sesión abierta). */
export function ModalCambiarClave({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return (
    <Modal open={abierto} onClose={onCerrar} title="Cambiar contraseña" descripcion="Elegí una contraseña que no uses en otros sitios." size="sm">
      <FormularioNuevaClave
        onListo={onCerrar}
        acciones={<Button variant="secondary" onClick={onCerrar}>Cancelar</Button>}
      />
    </Modal>
  );
}
