import { forwardRef, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/Input';

type Props = Omit<ComponentProps<typeof Input>, 'type' | 'inputClassName' | 'ref' | 'accion'>;

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export const CampoClave = forwardRef<HTMLInputElement, Props>((props, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      accion={(
        <button
          type="button"
          onClick={() => setVisible((valor) => !valor)}
          aria-label="Mostrar contraseña"
          aria-pressed={visible}
          className="grid h-11 w-11 place-items-center rounded-lg text-ink/65 transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink"
        >
          {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
      )}
    />
  );
});

CampoClave.displayName = 'CampoClave';
