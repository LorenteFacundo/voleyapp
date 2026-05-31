import { Search } from 'lucide-react';
import { useState } from 'react';

const quickFilters = ['Hoy', 'Este finde', 'Mi nivel'];

export function HeroSection({ onSearch }: { onSearch?: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden bg-vb-blue px-4 py-10 text-white md:py-14">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-vb-orange" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-vb-yellow" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-3xl font-black tracking-tight md:text-5xl">
          Encontrá tu próximo partido
        </h1>
        <p className="mt-3 text-base text-white/80 md:text-lg">
          Canchas, turnos y jugadores cerca tuyo
        </p>

        {/* Search bar */}
        <div className="mt-6 flex items-center gap-2 rounded-full bg-white/10 p-1.5 backdrop-blur-sm ring-1 ring-white/20 focus-within:ring-vb-orange">
          <Search size={18} className="ml-3 text-white/60" />
          <input
            type="text"
            placeholder="¿Dónde querés jugar hoy?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch?.(query)}
            className="flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder:text-white/50 outline-none"
          />
          <button
            onClick={() => onSearch?.(query)}
            className="rounded-full bg-vb-orange px-5 py-2 text-sm font-bold text-white transition hover:bg-vb-orange/90"
          >
            Buscar
          </button>
        </div>

        {/* Quick filters */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {quickFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(activeFilter === filter ? null : filter)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                activeFilter === filter
                  ? 'bg-vb-orange text-white'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
