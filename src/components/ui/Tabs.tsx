import { useId, useRef } from 'react';
import clsx from 'clsx';

type Tab<T extends string> = { id: T; label: string; badge?: number | string | null };

type TabsProps<T extends string> = {
  tabs: Tab<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  /** Nombre accesible del grupo de pestañas. */
  label: string;
  className?: string;
};

/** Pestañas accesibles (flechas para moverse). Nunca envían formularios. */
export function Tabs<T extends string>({ tabs, activeTab, onChange, label, className }: TabsProps<T>) {
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function mover(desde: number, paso: number) {
    const siguiente = (desde + paso + tabs.length) % tabs.length;
    onChange(tabs[siguiente].id);
    refs.current[siguiente]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={clsx('flex gap-1 overflow-x-auto rounded-xl bg-ink/5 p-1', className)}>
      {tabs.map((tab, index) => {
        const activa = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[index] = el; }}
            id={`${baseId}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activa}
            tabIndex={activa ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(evento) => {
              if (evento.key === 'ArrowRight') { evento.preventDefault(); mover(index, 1); }
              if (evento.key === 'ArrowLeft') { evento.preventDefault(); mover(index, -1); }
            }}
            className={clsx(
              'flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange/60',
              activa ? 'bg-white text-vb-blue shadow-sm' : 'text-ink/60 hover:text-ink',
            )}
          >
            {tab.label}
            {tab.badge != null && tab.badge !== 0 && (
              <span className="rounded-full bg-vb-orange px-1.5 text-xs font-bold text-white">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
