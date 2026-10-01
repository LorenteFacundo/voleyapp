import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  descripcion?: React.ReactNode;
  children: React.ReactNode;
  /** Botones al pie, siempre visibles. */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Evita cerrar al tocar fuera (por ejemplo, mientras se guarda). */
  bloqueado?: boolean;
};

const anchos = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Diálogo accesible: en celulares se abre como hoja desde abajo. Atrapa el
 * foco, cierra con Escape y devuelve el foco al elemento que lo abrió.
 */
export function Modal({ open, onClose, title, descripcion, children, footer, size = 'md', bloqueado = false }: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const bloqueadoRef = useRef(bloqueado);

  useEffect(() => {
    onCloseRef.current = onClose;
    bloqueadoRef.current = bloqueado;
  });

  useEffect(() => {
    if (!open) return;
    const previo = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const primero = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(ENFOCABLES);
    (primero ?? panel)?.focus();

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !bloqueadoRef.current) {
        evento.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (evento.key !== 'Tab' || !panel) return;
      const elementos = Array.from(panel.querySelectorAll<HTMLElement>(ENFOCABLES)).filter((el) => el.offsetParent !== null);
      if (!elementos.length) return;
      const [inicio, fin] = [elementos[0], elementos[elementos.length - 1]];
      if (evento.shiftKey && document.activeElement === inicio) { evento.preventDefault(); fin.focus(); }
      else if (!evento.shiftKey && document.activeElement === fin) { evento.preventDefault(); inicio.focus(); }
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !bloqueado) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descripcion ? descId : undefined}
        tabIndex={-1}
        className={clsx(
          'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-soft outline-none',
          'animate-slide-up sm:rounded-2xl',
          anchos[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-ink">{title}</h2>
            {descripcion && <p id={descId} className="mt-0.5 text-sm text-ink/60">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={bloqueado}
            aria-label="Cerrar"
            className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/55 transition hover:bg-ink/5 hover:text-ink disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-ink/10 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
