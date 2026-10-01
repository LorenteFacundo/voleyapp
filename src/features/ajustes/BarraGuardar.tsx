import { Button } from '@/components/ui/Button';

type Props = {
  visible: boolean;
  mensaje: string;
  guardando: boolean;
  onDescartar: () => void;
  /** Si se indica, el botón envía ese formulario. */
  formId?: string;
  onGuardar?: () => void;
  textoGuardar?: string;
  deshabilitado?: boolean;
};

/**
 * Barra fija abajo mientras haya cambios sin guardar. En celulares queda
 * encima de la barra de navegación.
 */
export function BarraGuardar({
  visible, mensaje, guardando, onDescartar, formId, onGuardar, textoGuardar = 'Guardar cambios', deshabilitado,
}: Props) {
  if (!visible) return null;
  return (
    <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mt-4 lg:bottom-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 shadow-soft backdrop-blur">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-amber-950">
          <span className="h-2 w-2 shrink-0 rounded-full bg-vb-orange-ink" aria-hidden="true" />
          {mensaje}
        </p>
        <div className="flex flex-1 justify-end gap-2 sm:flex-none">
          <Button variant="secondary" onClick={onDescartar} disabled={guardando}>Descartar</Button>
          <Button
            type={formId ? 'submit' : 'button'}
            form={formId}
            onClick={formId ? undefined : onGuardar}
            loading={guardando}
            disabled={deshabilitado}
          >
            {textoGuardar}
          </Button>
        </div>
      </div>
    </div>
  );
}
