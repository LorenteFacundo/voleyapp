import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { copiarAlPortapapeles } from '@/lib/portapapeles';
import { Button } from './Button';
import type { TamanoBoton, VarianteBoton } from './estilosBoton';

type Props = {
  texto: string;
  etiqueta?: string;
  /** Nombre accesible cuando la etiqueta visible no alcanza. */
  etiquetaAccesible?: string;
  variant?: VarianteBoton;
  size?: Exclude<TamanoBoton, 'icon'>;
  className?: string;
};

/** Botón que copia un texto y muestra "Copiado" por unos segundos. */
export function BotonCopiar({
  texto, etiqueta = 'Copiar', etiquetaAccesible, variant = 'secondary', size = 'sm', className,
}: Props) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const temporizador = window.setTimeout(() => setCopiado(false), 2500);
    return () => window.clearTimeout(temporizador);
  }, [copiado]);

  async function copiar() {
    if (await copiarAlPortapapeles(texto)) setCopiado(true);
    else toast.error('No pudimos copiar. Seleccioná el texto y copialo a mano.');
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={copiar} aria-label={etiquetaAccesible} className={className}>
        {copiado ? <Check size={16} aria-hidden="true" className="text-green-700" /> : <Copy size={16} aria-hidden="true" />}
        {copiado ? 'Copiado' : etiqueta}
      </Button>
      <span className="sr-only" aria-live="polite">{copiado ? 'Copiado al portapapeles' : ''}</span>
    </>
  );
}
