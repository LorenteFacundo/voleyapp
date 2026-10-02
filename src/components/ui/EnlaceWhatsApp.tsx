import type { ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import { enlaceWhatsApp, normalizarTelefono } from '@/lib/telefono';

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2';

type Props = {
  /** Destinatario. Con `href` se usa esa URL tal cual (por ejemplo, para compartir sin destinatario). */
  telefono?: string | null;
  mensaje?: string;
  href?: string;
  /**
   * Nombre accesible de la variante de solo ícono (por ejemplo "Escribirle a Ana
   * por WhatsApp"). En los botones con texto se muestra como ayuda al pasar el mouse.
   */
  etiqueta?: string;
  variante?: 'boton' | 'destacado' | 'icono';
  tamano?: 'sm' | 'md';
  children?: ReactNode;
  className?: string;
};

/** Abre WhatsApp con el mensaje armado para que la persona lo revise y lo envíe. */
export function EnlaceWhatsApp({
  telefono, mensaje, href, etiqueta, variante = 'boton', tamano = 'md', children, className,
}: Props) {
  const destino = href ?? enlaceWhatsApp(normalizarTelefono(telefono ?? '') ?? telefono ?? '', mensaje);

  if (variante === 'icono') {
    return (
      <a
        href={destino}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${etiqueta ?? 'Escribir por WhatsApp'} (se abre WhatsApp)`}
        title={etiqueta}
        className={clsx(
          'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-green-700 transition hover:bg-green-50',
          FOCO,
          className,
        )}
      >
        <MessageCircle size={20} aria-hidden="true" />
      </a>
    );
  }

  return (
    <a
      href={destino}
      target="_blank"
      rel="noopener noreferrer"
      title={etiqueta}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition',
        tamano === 'sm' ? 'min-h-9 px-3' : 'min-h-11 px-4',
        variante === 'destacado'
          ? 'bg-green-700 text-white hover:bg-green-800'
          : 'border border-green-700/25 bg-white text-green-800 hover:border-green-700 hover:bg-green-50',
        FOCO,
        className,
      )}
    >
      <MessageCircle size={16} aria-hidden="true" />
      {children}
      <span className="sr-only"> (se abre WhatsApp)</span>
    </a>
  );
}
