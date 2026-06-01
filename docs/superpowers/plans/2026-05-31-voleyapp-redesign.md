# VoleyApp Rediseño Total — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar completamente la UI de VoleyApp para que sea mobile-first, visualmente vibrante, profesional y representativa del voleibol, manteniendo toda la lógica existente.

**Architecture:** Se actualiza la capa de presentación (Tailwind config, CSS global, componentes UI y layout) sin tocar hooks, contextos ni lógica de negocio. Se introduce BottomNav mobile, Hero con buscador, mapa expandible tipo sheet, y cards de partidos rediseñadas.

**Tech Stack:** React 19, Vite, Tailwind CSS 3, TypeScript, Lucide React, Leaflet (ya existente).

---

## Estructura de Archivos

### Nuevos archivos:
- `src/components/layout/BottomNav.tsx` — Navegación inferior mobile.
- `src/components/layout/HeroSection.tsx` — Banner con buscador y chips.
- `src/components/ui/FilterChips.tsx` — Chips de filtro rápido.
- `src/components/features/ExpandableMap.tsx` — Wrapper del mapa con comportamiento sheet en mobile.
- `src/components/features/MatchCardV2.tsx` — Rediseño completo de card de partido.

### Archivos modificados:
- `tailwind.config.js` — Nuevos colores, sombras, breakpoints, animaciones.
- `src/index.css` — Variables CSS, estilos globales, clases utilitarias.
- `src/App.tsx` — Estructura de layout con BottomNav y Header responsive.
- `src/pages/HomePage.tsx` — Reestructura completa.
- `src/components/layout/Header.tsx` — Rediseño compacto.
- `src/components/ui/Button.tsx` — Nuevas variantes de color.
- `src/components/ui/Card.tsx` — Bordes redondeados, sombras, hover.
- `src/components/ui/Badge.tsx` — Colores según nueva paleta.
- `src/components/features/MatchList.tsx` — Layout de grid responsive.
- `src/components/features/MapView.tsx` — Integración con ExpandableMap.

---

### Task 1: Actualizar Tailwind Config

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Abrir `tailwind.config.js` y leer contenido actual**

- [ ] **Step 2: Agregar colores, sombras, breakpoints y animaciones nuevos**

Reemplazar todo el objeto `theme.extend` con:

```javascript
      extend: {
        fontFamily: {
          display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          body: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        },
        colors: {
          'vb-orange': '#FF6B35',
          'vb-orange-light': '#FFF3ED',
          'vb-blue': '#1A237E',
          'vb-yellow': '#FFD23F',
          'vb-white': '#FFFFFF',
          'vb-gray': '#2D3436',
          'vb-light': '#F8F9FA',
          'vb-green': '#00C853',
          'vb-red': '#FF3D00',
          ink: '#101820',
          court: '#2d7d6f',
          sand: '#f5b85f',
          line: '#f4f7f5',
        },
        boxShadow: {
          soft: '0 18px 60px rgba(16, 24, 32, 0.12)',
          glow: '0 0 40px rgba(45, 125, 111, 0.15)',
          card: '0 4px 24px rgba(26, 35, 126, 0.08)',
          'card-hover': '0 12px 40px rgba(26, 35, 126, 0.15)',
        },
        screens: {
          xs: '480px',
        },
        animation: {
          'fade-in': 'fadeIn 0.3s ease-out',
          'slide-up': 'slideUp 0.4s ease-out',
          'scale-in': 'scaleIn 0.2s ease-out',
          'progress': 'progress 1s ease-out forwards',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
          slideUp: {
            '0%': { opacity: '0', transform: 'translateY(16px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          },
          scaleIn: {
            '0%': { opacity: '0', transform: 'scale(0.95)' },
            '100%': { opacity: '1', transform: 'scale(1)' },
          },
          progress: {
            '0%': { width: '0%' },
            '100%': { width: 'var(--progress-width, 0%)' },
          },
        },
      },
```

- [ ] **Step 3: Guardar archivo**

- [ ] **Step 4: Verificar que `npm run dev` inicie sin errores**

Run: `npm run dev`
Expected: Vite inicia sin errores de Tailwind.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js
git commit -m "chore: update tailwind config with vibrant volleyball theme"
```

---

### Task 2: Actualizar Estilos Globales y Variables CSS

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Abrir `src/index.css` y leer contenido actual**

- [ ] **Step 2: Reemplazar contenido completo**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color: #2D3436;
  background: #F8F9FA;
  font-family: 'DM Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  min-width: 320px;
  margin: 0;
  overflow-x: hidden;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Outfit', ui-sans-serif, system-ui, sans-serif;
  color: #1A237E;
}

button,
input,
select {
  font: inherit;
}

.leaflet-container {
  min-height: 430px;
  height: 100%;
  width: 100%;
  z-index: 0;
}

.app-shell {
  min-height: 100vh;
  background: #F8F9FA;
}

.focus-ring {
  @apply outline-none ring-2 ring-transparent transition focus:ring-vb-orange/40;
}

@layer utilities {
  .animate-stagger > * {
    animation: slideUp 0.4s ease-out backwards;
  }
  .animate-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .animate-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .animate-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .animate-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .animate-stagger > *:nth-child(5) { animation-delay: 240ms; }
  .animate-stagger > *:nth-child(6) { animation-delay: 300ms; }

  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Step 3: Guardar y verificar build**

Run: `npm run build`
Expected: Build exitosa.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "chore: update global styles with vibrant theme"
```

---

### Task 3: Actualizar Componentes UI Base (Button, Card, Badge)

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Card.tsx`
- Modify: `src/components/ui/Badge.tsx`

#### Subtask 3.1: Button

- [ ] **Step 1: Abrir `src/components/ui/Button.tsx`**

- [ ] **Step 2: Actualizar variantes de color**

Reemplazar el objeto `variantStyles` con:

```typescript
const variantStyles = {
  primary: 'bg-vb-orange text-white hover:bg-vb-orange/90 shadow-card hover:-translate-y-0.5 hover:shadow-card-hover',
  secondary: 'border border-vb-gray/15 bg-white text-vb-gray hover:border-vb-orange hover:text-vb-orange hover:-translate-y-0.5',
  ghost: 'text-vb-gray/70 hover:text-vb-gray hover:bg-vb-gray/5',
  danger: 'bg-vb-red text-white hover:bg-vb-red/90',
  blue: 'bg-vb-blue text-white hover:bg-vb-blue/90 shadow-card hover:-translate-y-0.5 hover:shadow-card-hover',
};
```

- [ ] **Step 3: Agregar variantes al type**

Cambiar el type:

```typescript
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'blue';
```

- [ ] **Step 4: Guardar**

#### Subtask 3.2: Card

- [ ] **Step 1: Abrir `src/components/ui/Card.tsx`**

- [ ] **Step 2: Actualizar estilos base**

Reemplazar la clase base con:

```typescript
        'rounded-2xl border border-vb-gray/10 bg-white shadow-card transition-all duration-300',
```

Y agregar al hover:

```typescript
        hover && 'hover:shadow-card-hover hover:-translate-y-1 cursor-pointer',
```

- [ ] **Step 3: Guardar**

#### Subtask 3.3: Badge

- [ ] **Step 1: Abrir `src/components/ui/Badge.tsx`**

- [ ] **Step 2: Actualizar colores**

Reemplazar las variantes con:

```typescript
const variants = {
  default: 'bg-vb-light text-vb-gray',
  court: 'bg-vb-orange-light text-vb-orange',
  success: 'bg-vb-green/10 text-vb-green',
  warning: 'bg-vb-yellow/20 text-vb-gray',
  danger: 'bg-vb-red/10 text-vb-red',
};
```

- [ ] **Step 3: Guardar**

- [ ] **Step 4: Commit todos los UI base**

```bash
git add src/components/ui/Button.tsx src/components/ui/Card.tsx src/components/ui/Badge.tsx
git commit -m "feat: update base UI components with vibrant theme"
```

---

### Task 4: Crear BottomNav (Mobile Navigation)

**Files:**
- Create: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Crear archivo**

```typescript
import { Home, Trophy, MapPin, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

const navItems = [
  { label: 'Inicio', icon: Home, path: '/' },
  { label: 'Partidos', icon: Trophy, path: '/partidos' },
  { label: 'Canchas', icon: MapPin, path: '/canchas' },
  { label: 'Perfil', icon: User, path: '/perfil' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-vb-gray/10 bg-white/90 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-safe">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                'flex flex-col items-center gap-0.5 py-2.5 px-3 transition-colors',
                isActive ? 'text-vb-orange' : 'text-vb-gray/50 hover:text-vb-gray'
              )}
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">{item.label}</span>
              {isActive && (
                <span className="absolute top-0 h-0.5 w-6 rounded-b-full bg-vb-orange" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Guardar**

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "feat: add bottom navigation for mobile"
```

---

### Task 5: Crear HeroSection

**Files:**
- Create: `src/components/layout/HeroSection.tsx`

- [ ] **Step 1: Crear archivo**

```typescript
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
```

- [ ] **Step 2: Guardar**

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/HeroSection.tsx
git commit -m "feat: add hero section with search and filters"
```

---

### Task 6: Crear MatchCardV2

**Files:**
- Create: `src/components/features/MatchCardV2.tsx`

- [ ] **Step 1: Crear archivo**

```typescript
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock3, Users, UserCheck, MapPin } from 'lucide-react';
import type { PartidoPublico } from '@/types';
import { formatDate, formatMoney } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function MatchCardV2({ partido }: { partido: PartidoPublico }) {
  const navigate = useNavigate();
  const yaInscripto = partido.mi_estado_inscripcion != null;
  const estaLleno = partido.jugadores_confirmados >= partido.cupo_maximo;
  const progress = Math.min(100, (partido.jugadores_confirmados / partido.cupo_maximo) * 100);

  return (
    <Card
      hover
      padding="md"
      className="group"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/partido/${partido.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/partido/${partido.id}`);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-vb-gray/60">
            <MapPin size={12} />
            <span className="truncate">{partido.club_nombre}</span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-vb-blue truncate group-hover:text-vb-orange transition-colors">
            {partido.cancha_nombre}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="court">{partido.nivel_requerido}</Badge>
          {yaInscripto && (
            <Badge variant="success">
              <UserCheck size={12} className="mr-1" />
              Inscripto
            </Badge>
          )}
          {estaLleno && !yaInscripto && (
            <Badge variant="danger">Lleno</Badge>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <span className="flex items-center gap-2 text-vb-gray/70">
          <CalendarDays size={16} className="text-vb-orange" />
          {formatDate(partido.fecha)}
        </span>
        <span className="flex items-center gap-2 text-vb-gray/70">
          <Clock3 size={16} className="text-vb-orange" />
          {partido.hora_inicio.slice(0, 5)}
        </span>
        <span className="flex items-center gap-2 text-vb-gray/70">
          <Users size={16} className="text-vb-orange" />
          {partido.jugadores_confirmados}/{partido.cupo_maximo}
        </span>
        <span className="font-bold text-vb-blue text-lg">
          {formatMoney(partido.precio_total)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-vb-gray/60 mb-1.5">
          <span>Progreso de equipo</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-vb-gray/10">
          <div
            className="h-full rounded-full bg-vb-orange transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Guardar**

- [ ] **Step 3: Commit**

```bash
git add src/components/features/MatchCardV2.tsx
git commit -m "feat: add redesigned match card with progress bar"
```

---

### Task 7: Crear ExpandableMap

**Files:**
- Create: `src/components/features/ExpandableMap.tsx`
- Modify: `src/components/features/MapView.tsx`

#### Subtask 7.1: ExpandableMap

- [ ] **Step 1: Crear archivo**

```typescript
import { useState } from 'react';
import { MapPin, X, ChevronUp } from 'lucide-react';
import type { ClubPublico } from '@/types';
import { MapView } from './MapView';

export function ExpandableMap({ clubes, onSelectClub }: { clubes: ClubPublico[]; onSelectClub: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const clubesConUbicacion = clubes.filter((c) => c.latitud != null && c.longitud != null);

  if (expanded) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white animate-fade-in md:relative md:inset-auto md:z-0 md:block md:rounded-2xl md:overflow-hidden md:shadow-card">
        <div className="flex items-center justify-between border-b border-vb-gray/10 p-4">
          <div>
            <h2 className="text-lg font-bold text-vb-blue">Mapa de clubes</h2>
            <p className="text-sm text-vb-gray/60">{clubesConUbicacion.length} sedes activas</p>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="grid h-10 w-10 place-items-center rounded-full bg-vb-gray/10 text-vb-gray transition hover:bg-vb-gray/20 md:hidden"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 md:h-[430px]">
          <MapView clubes={clubes} onSelectClub={(id) => { setExpanded(false); onSelectClub(id); }} />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setExpanded(true)}
      className="cursor-pointer overflow-hidden rounded-2xl border border-vb-gray/10 bg-white shadow-card transition hover:shadow-card-hover md:hidden"
    >
      <div className="flex items-center gap-3 p-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-vb-orange-light text-vb-orange">
          <MapPin size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-vb-blue">Ver mapa de clubes</h3>
          <p className="text-sm text-vb-gray/60 truncate">
            {clubesConUbicacion.length} sedes con ubicación cargada
          </p>
        </div>
        <ChevronUp size={20} className="shrink-0 text-vb-gray/40" />
      </div>
      {/* Mini map preview - just a visual hint */}
      <div className="relative h-16 bg-vb-light overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          {clubesConUbicacion.slice(0, 3).map((_, i) => (
            <div
              key={i}
              className="absolute h-2 w-2 rounded-full bg-vb-orange"
              style={{
                left: `${20 + i * 25}%`,
                top: `${30 + (i % 2) * 20}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Guardar**

#### Subtask 7.2: MapView (ajustar para desktop)

- [ ] **Step 3: Abrir `src/components/features/MapView.tsx`**

- [ ] **Step 4: Actualizar colores de los markers para que coincidan con la nueva paleta**

Reemplazar `pathOptions` en `CircleMarker`:

```typescript
          pathOptions={{ color: '#1A237E', fillColor: '#FF6B35', fillOpacity: 0.85 }}
```

Y el botón del popup:

```typescript
              className="mt-2 rounded-lg bg-vb-orange px-3 py-1.5 text-xs font-bold text-white transition hover:bg-vb-orange/90"
```

- [ ] **Step 5: Guardar**

- [ ] **Step 6: Commit**

```bash
git add src/components/features/ExpandableMap.tsx src/components/features/MapView.tsx
git commit -m "feat: add expandable map for mobile and update map colors"
```

---

### Task 8: Actualizar Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Abrir `src/components/layout/Header.tsx`**

- [ ] **Step 2: Reemplazar contenido completo**

```typescript
import { LogOut, Settings2, Volleyball, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isAdminGlobal } from '@/lib/roles';
import { Button } from '@/components/ui/Button';

type HeaderProps = {
  onOpenBooking: () => void;
  onRefresh: () => void;
};

export function Header({ onOpenBooking, onRefresh }: HeaderProps) {
  const { session, signOut, perfil } = useAuth();
  const navigate = useNavigate();
  const canManageCatalog = isAdminGlobal(perfil?.rol);

  return (
    <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-vb-orange text-white shadow-card">
            <Volleyball size={22} />
          </span>
          <div className="hidden sm:block">
            <h1 className="text-lg font-black tracking-tight text-vb-blue">VoleyApp</h1>
            <p className="text-xs text-vb-gray/60">Canchas, turnos y partidos</p>
          </div>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Button size="sm" onClick={onOpenBooking}>
            <Plus size={16} />
            Crear partido
          </Button>
          {canManageCatalog ? (
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin')}>
              <Settings2 size={16} />
              Admin
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Actualizar
          </Button>
          {session ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut size={16} />
              Salir
            </Button>
          ) : null}
        </div>

        {/* Mobile: just user actions */}
        <div className="flex items-center gap-2 md:hidden">
          {session ? (
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-vb-gray/60 transition hover:bg-vb-gray/5 hover:text-vb-gray"
            >
              <LogOut size={20} />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Guardar**

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: redesign header with vibrant theme and responsive layout"
```

---

### Task 9: Actualizar MatchList para usar grid responsive

**Files:**
- Modify: `src/components/features/MatchList.tsx`

- [ ] **Step 1: Abrir `src/components/features/MatchList.tsx`**

- [ ] **Step 2: Reemplazar import de MatchCard por MatchCardV2 y actualizar layout**

```typescript
import { ShieldCheck, Volleyball } from 'lucide-react';
import type { PartidoPublico } from '@/types';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { MatchCardV2 } from '@/components/features/MatchCardV2';

type MatchListProps = {
  partidos: PartidoPublico[];
  loading: boolean;
  isAuthenticated: boolean;
};

export function MatchList({ partidos, loading, isAuthenticated }: MatchListProps) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-vb-blue">Partidos abiertos</h2>
        <span className="rounded-full bg-vb-orange-light px-3 py-1 text-xs font-bold text-vb-orange">
          {loading ? '...' : `${partidos.length}`}
        </span>
      </div>

      {!isAuthenticated ? (
        <Card padding="lg">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-vb-orange-light text-vb-orange">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="font-bold text-vb-blue">
                Iniciá sesión para ver y crear partidos
              </h3>
              <p className="mt-1 text-sm text-vb-gray/65">
                Las canchas se pueden explorar, pero los partidos usan tu
                usuario para cuidar reservas e inscripciones.
              </p>
            </div>
          </div>
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={180} rounded />
          ))}
        </div>
      ) : partidos.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
              <Volleyball size={32} />
            </div>
            <div>
              <h3 className="font-bold text-vb-blue">Sin partidos publicados</h3>
              <p className="mt-1 text-sm text-vb-gray/65">
                Todavía no hay partidos activos. ¡Creá el primero!
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
          {partidos.map((partido) => (
            <MatchCardV2 key={partido.id} partido={partido} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Guardar**

- [ ] **Step 4: Commit**

```bash
git add src/components/features/MatchList.tsx
git commit -m "feat: update match list with responsive grid and new cards"
```

---

### Task 10: Reestructurar HomePage

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Abrir `src/pages/HomePage.tsx`**

- [ ] **Step 2: Reemplazar contenido completo**

```typescript
import { useCallback, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePartidos } from '@/hooks/usePartidos';
import { useClubes } from '@/hooks/useClubes';
import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/layout/HeroSection';
import { BottomNav } from '@/components/layout/BottomNav';
import { ExpandableMap } from '@/components/features/ExpandableMap';
import { MatchList } from '@/components/features/MatchList';
import { BookingFlow } from '@/components/features/BookingFlow';
import { UserPanel } from '@/components/features/UserPanel';
import { AuthForm } from '@/components/features/AuthForm';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export function HomePage() {
  const { session, perfil } = useAuth();
  const isAuthenticated = session != null;

  const { partidos, loading: loadingPartidos, refresh: refreshPartidos } = usePartidos(isAuthenticated);
  const { clubes, refresh: refreshClubes } = useClubes();

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingClubId, setBookingClubId] = useState<number | null>(null);

  const openBooking = useCallback((clubId?: number) => {
    setBookingClubId(clubId ?? null);
    setBookingOpen(true);
  }, []);

  const closeBooking = useCallback(() => {
    setBookingOpen(false);
    setBookingClubId(null);
  }, []);

  const refresh = useCallback(() => {
    refreshPartidos();
    refreshClubes();
  }, [refreshPartidos, refreshClubes]);

  return (
    <div className="app-shell pb-20 md:pb-0">
      <Header onOpenBooking={() => openBooking()} onRefresh={refresh} />
      <HeroSection />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Main content */}
          <div className="grid gap-6">
            <ExpandableMap clubes={clubes} onSelectClub={(id) => openBooking(id)} />
            <MatchList partidos={partidos} loading={loadingPartidos} isAuthenticated={isAuthenticated} />
          </div>

          {/* Sidebar (desktop) */}
          <aside className="hidden content-start gap-6 lg:grid">
            {session ? (
              <UserPanel onNavigateAdmin={() => {}} />
            ) : (
              <Card padding="md">
                <AuthForm onMessage={(msg) => toast(msg)} />
              </Card>
            )}

            <Card padding="md">
              <div className="text-center">
                <h2 className="font-bold text-vb-blue">Reservar cancha</h2>
                <p className="mt-2 text-sm text-vb-gray/65">
                  Busca un club, elegí la cancha y mirá los horarios disponibles.
                </p>
                <Button className="mt-4" fullWidth onClick={() => openBooking()}>
                  Buscar y alquilar
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </main>

      {/* FAB for mobile */}
      <button
        onClick={() => openBooking()}
        className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-vb-orange text-white shadow-lg shadow-vb-orange/30 transition hover:scale-105 active:scale-95 md:hidden"
        aria-label="Crear partido"
      >
        <Plus size={28} />
      </button>

      <BottomNav />

      <BookingFlow
        initialClubId={bookingClubId}
        open={bookingOpen}
        onClose={closeBooking}
        onRefresh={refresh}
      />
    </div>
  );
}
```

- [ ] **Step 3: Guardar**

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: restructure homepage with hero, expandable map, and mobile layout"
```

---

### Task 11: Actualizar App.tsx para soportar BottomNav y layout responsive

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Abrir `src/App.tsx`**

- [ ] **Step 2: Verificar que `App.tsx` ya importe `BrowserRouter` y que las rutas estén bien**

El archivo actual ya tiene la estructura de rutas correcta. Solo verificar que no haya conflictos con el nuevo layout. El `HomePage` ahora incluye su propio `BottomNav`, `Header`, etc., por lo que `App.tsx` no necesita cambios significativos.

- [ ] **Step 3: Commit (si no hay cambios, hacer commit vacío o skip)**

---

### Task 12: Verificación Visual y Ajustes Finales

**Files:**
- All modified files

- [ ] **Step 1: Correr el servidor de desarrollo**

Run: `npm run dev`
Expected: App se vea correctamente en `http://localhost:5173`.

- [ ] **Step 2: Verificar en modo mobile (DevTools → Responsive)**

- BottomNav visible, FAB visible.
- HeroSection se ve bien.
- Cards ocupan todo el ancho.
- Mapa expandible funciona al tocar.

- [ ] **Step 3: Verificar en modo desktop**

- BottomNav NO visible.
- Sidebar lateral visible.
- Header con acciones.
- Grid de cards funciona.

- [ ] **Step 4: Hacer ajustes si es necesario**

Si algo se ve mal, ajustar padding, margins, o colores en los archivos correspondientes.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: complete vibrant volleyball redesign - mobile first"
```

---

### Task 13: Actualizar Memory.md

**Files:**
- Modify: `Memory.md`

- [ ] **Step 1: Abrir `Memory.md` y agregar sección del rediseño**

Agregar al final:

```markdown
## 2026-05-31 — Rediseño Total de UI

Se realizó un rediseño completo de la interfaz de VoleyApp con los siguientes objetivos:
- **Mobile-first**: la mayoría de usuarios acceden desde celular.
- **Identidad visual vibrante**: colores que representan el voleibol (naranja, azul, amarillo).
- **Layout reorganizado**: partidos como contenido principal, mapa expandible en mobile.

### Cambios principales:
- Nueva paleta de colores en `tailwind.config.js`.
- Componentes UI base actualizados (Button, Card, Badge).
- Nuevos componentes: `BottomNav`, `HeroSection`, `MatchCardV2`, `ExpandableMap`.
- `HomePage` reestructurada con hero, grid responsive, sidebar desktop, FAB mobile.
- Header rediseñado, compacto en mobile.
- Mapa ahora es expandible en mobile (sheet/bottom drawer).

### Decisiones de diseño:
- Bottom navigation bar en mobile para accesibilidad con el pulgar.
- FAB naranja para crear partidos rápidamente.
- Cards con progreso animado del equipo.
- Hero con buscador prominente y filt rápidos.
```

- [ ] **Step 2: Guardar**

- [ ] **Step 3: Commit**

```bash
git add Memory.md
git commit -m "docs: update memory with redesign details"
```

---

## Self-Review

**Spec coverage:**
- ✅ Paleta de colores vibrante → Task 1
- ✅ Tipografía → Tasks 1 y 2
- ✅ Mobile-first layout → Tasks 4, 5, 7, 9, 10
- ✅ BottomNav → Task 4
- ✅ HeroSection → Task 5
- ✅ MatchCardV2 con progreso → Task 6
- ✅ ExpandableMap → Task 7
- ✅ Header rediseñado → Task 8
- ✅ MatchList grid responsive → Task 9
- ✅ HomePage reestructurada → Task 10
- ✅ Memory.md → Task 13

**Placeholder scan:** No se encontraron placeholders TBD, TODO, o vagos.

**Type consistency:** Los tipos y nombres son consistentes a lo largo del plan.

**Ambiguity check:** El plan es concreto y detallado.

---

## Opciones de Ejecución

**Plan completo y guardado en `docs/superpowers/plans/2026-05-31-voleyapp-redesign.md`.**

**Dos opciones de ejecución:**

**1. Subagent-Driven (recomendado)** — Dispatcheo un subagente fresco por tarea, reviso entre tareas, iteración rápida.

**2. Inline Execution** — Ejecuto las tareas en esta sesión usando executing-plans, ejecución por lotes con checkpoints.

**¿Qué preferís?**
