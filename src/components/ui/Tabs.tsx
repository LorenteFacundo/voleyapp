import { useId, useRef, type ReactNode } from 'react';
import clsx from 'clsx';

type Tab<T extends string> = { id: T; label: string; badge?: number | string | null };

type TabsProps<T extends string> = {
  tabs: Tab<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  /** Nombre accesible del grupo de pestañas. */
  label: string;
  /**
   * Prefijo compartido con los TabPanel (por ejemplo, de useId()). Con él,
   * cada pestaña apunta a su panel (aria-controls) y el panel la nombra.
   */
  idBase?: string;
  className?: string;
};

function idPestana(idBase: string, id: string) {
  return `${idBase}-pestana-${id}`;
}

function idPanel(idBase: string, id: string) {
  return `${idBase}-panel-${id}`;
}

/** Pestañas accesibles (flechas, Inicio y Fin para moverse). Nunca envían formularios. */
export function Tabs<T extends string>({ tabs, activeTab, onChange, label, idBase, className }: TabsProps<T>) {
  const generado = useId();
  const base = idBase ?? generado;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function ir(indice: number) {
    const destino = (indice + tabs.length) % tabs.length;
    onChange(tabs[destino].id);
    refs.current[destino]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={clsx('flex gap-1 overflow-x-auto rounded-xl bg-ink/5 p-1', className)}>
      {tabs.map((tab, index) => {
        const activa = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[index] = el; }}
            id={idPestana(base, tab.id)}
            type="button"
            role="tab"
            aria-selected={activa}
            aria-controls={idBase ? idPanel(idBase, tab.id) : undefined}
            tabIndex={activa ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(evento) => {
              const destinos: Record<string, number> = {
                ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1,
              };
              if (evento.key in destinos) {
                evento.preventDefault();
                ir(destinos[evento.key]);
              }
            }}
            className={clsx(
              'flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink',
              activa ? 'bg-white text-vb-blue shadow-sm' : 'text-ink/65 hover:text-ink',
            )}
          >
            {tab.label}
            {tab.badge != null && tab.badge !== 0 && (
              <span className="rounded-full bg-vb-orange-ink px-1.5 text-xs font-bold text-white">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type TabPanelProps = {
  /** El mismo idBase que recibió Tabs. */
  idBase: string;
  /** Id de la pestaña activa. */
  id: string;
  className?: string;
  children: ReactNode;
};

/** Panel de la pestaña activa, vinculado a su pestaña. */
export function TabPanel({ idBase, id, className, children }: TabPanelProps) {
  return (
    <div role="tabpanel" id={idPanel(idBase, id)} aria-labelledby={idPestana(idBase, id)} tabIndex={0}
      className={clsx('rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink', className)}>
      {children}
    </div>
  );
}
