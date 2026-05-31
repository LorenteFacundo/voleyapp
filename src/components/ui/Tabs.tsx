import React from 'react';
import clsx from 'clsx';

type TabsProps = {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
};

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => (
  <div className="flex rounded-md bg-ink/5 p-1">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={clsx(
          'flex-1 rounded px-3 py-2 text-sm font-semibold transition-all duration-200',
          activeTab === tab.id
            ? 'bg-white text-ink shadow-sm'
            : 'text-ink/60 hover:text-ink/80'
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
