# Guía de Portabilidad — VoleyApp

> Documento para recrear este proyecto en otro entorno CLI o pasarlo a otra máquina.

---

## 1. Requisitos Previos

| Herramienta | Versión mínima |
|-------------|---------------|
| Node.js     | 18+           |
| npm         | 9+            |
| Git         | 2.x           |

---

## 2. Clonar el Repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd "Aplicacion de Voleibol"
```

---

## 3. Instalar Dependencias

```bash
npm install
```

### Dependencias Principales (package.json)

| Paquete | Uso |
|---------|-----|
| `react`, `react-dom` | UI |
| `react-router-dom` | Rutas SPA |
| `@supabase/supabase-js` | Backend (Auth, DB, RLS) |
| `leaflet`, `react-leaf` | Mapas interactivos |
| `lucide-react` | Iconos |
| `sonner` | Notificaciones toast |
| `clsx` | Clases condicionales |

### DevDependencies

| Paquete | Uso |
|---------|-----|
| `vite` | Bundler |
| `typescript` | Tipado |
| `tailwindcss`, `postcss`, `autoprefixer` | CSS |
| `@vitejs/plugin-react` | Plugin Vite para React |

---

## 4. Variables de Entorno

Crear archivo `.env` o `.env.local` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://<TU_PROYECTO_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<TU_KEY>
```

> **Nota:** No commitear este archivo. Ya está en `.gitignore`.

---

## 5. Configuración de Supabase (MCP)

### 5.1 Archivo de Configuración MCP

En `~/.config/opencode/opencode.json` (global) o en el `opencode.json` del proyecto:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "supabase": {
      "type": "remote",
      "url": "https://mcp.supabase.com/mcp?project_ref=<TU_PROJECT_REF>",
      "enabled": true
    }
  }
}
```

### 5.2 Autenticación del MCP

```bash
opencode mcp auth supabase
```

Esto abre el navegador para completar el flujo OAuth con Supabase.

### 5.3 Instalar Agent Skills de Supabase

```bash
npx skills add supabase/agent-skills
```

---

## 6. Configuración de Superpowers (Opcional)

Para tener las skills de agente en todos los proyectos:

En `opencode.json` del proyecto:

```json
{
  "plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]
}
```

Las skills se instalan automáticamente al reiniciar OpenCode.

---

## 7. Esquema de Base de Datos (Supabase)

El proyecto usa las siguientes tablas (ya creadas en Supabase):

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Perfiles de usuario (extiende auth.users) |
| `clubes` | Clubes/organizaciones de canchas |
| `administradores_club` | Relación club ↔ admin |
| `canchas` | Canchas de voleibol |
| `horarios_semanales` | Horarios recurrentes por día de la semana (con precio por franja) |
| `disponibilidad_turnos` | Turnos concretos (solo se crean al reservar) |
| `reservas` | Reservas de turnos |
| `partidos` | Partidos creados |
| `participantes_partido` | Jugadores inscritos en partidos |

### Vistas

| Vista | Descripción |
|-------|-------------|
| `partidos_publicos` | Lectura limpia de partidos para el frontend |
| `clubes_publicos` | Clubes con ubicación para el mapa |

### Funciones RPC

| Función | Descripción |
|---------|-------------|
| `crear_partido` | Crea reserva + partido + organizador en una transacción |
| `reservar_turno_rango` | Divide un turno grande en bloques más chicos |

### Políticas RLS

- `usuarios`: Lectura pública, escritura solo del propio usuario.
- `canchas`: Lectura pública, escritura solo para `admin_global` / `superadmin`.
- `partidos`: Lectura pública, creación autenticada, edición solo del creador.
- `participantes_partido`: Lectura pública, inserción autenticada, aprobación solo del creador.
- `reservas`: Lectura del propio usuario, escritura autenticada.

### Roles de Usuario

| Rol | Permisos |
|-----|----------|
| `jugador` | Crear y unirse a partidos |
| `admin_cancha` | Gestionar reservas de su cancha |
| `admin_global` | Cargar canchas y asignar administradores |
| `superadmin` | Control total del sistema |

---

## 8. Configuración del Proyecto

### 8.1 Vite (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

### 8.2 TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "ignoreDeprecations": "6.0"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 8.3 Tailwind CSS (`tailwind.config.js`)

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
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
  },
  plugins: [],
};
```

### 8.4 PostCSS (`postcss.config.js`)

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## 9. Estructura de Archivos

```
Aplicacion de Voleibol/
├── .agents/skills/          # Skills de agente (Supabase, etc.)
├── docs/superpowers/        # Documentación de diseño y planes
├── public/
├── src/
│   ├── components/
│   │   ├── admin/             # Componentes del panel de administración
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── CanchasTable.tsx
│   │   │   ├── ClubesTable.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── PartidosTable.tsx
│   │   │   ├── ReservasTable.tsx
│   │   │   ├── TurnosTable.tsx
│   │   │   └── UsuariosTable.tsx
│   │   ├── features/        # Componentes de negocio
│   │   │   ├── AdminPanel.tsx
│   │   │   ├── AuthForm.tsx
│   │   │   ├── BookingFlow.tsx
│   │   │   ├── ExpandableMap.tsx
│   │   │   ├── MapView.tsx
│   │   │   ├── MatchCard.tsx
│   │   │   ├── MatchCardV2.tsx
│   │   │   ├── MatchList.tsx
│   │   │   ├── ScheduleBoard.tsx
│   │   │   └── UserPanel.tsx
│   │   ├── layout/          # Componentes de layout
│   │   │   ├── BottomNav.tsx
│   │   │   ├── Header.tsx
│   │   │   └── HeroSection.tsx
│   │   └── ui/              # Componentes UI base
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Skeleton.tsx
│   │       └── Tabs.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── hooks/
│   │   ├── useAdminData.ts
│   │   ├── useAllCanchas.ts
│   │   ├── useAuth.ts
│   │   ├── useCanchaDetalle.ts
│   │   ├── useCanchas.ts
│   │   ├── useClubes.ts
│   │   ├── useGeolocation.ts
│   │   ├── useMisPartidos.ts
│   │   ├── usePartidoDetalle.ts
│   │   ├── usePartidos.ts
│   │   └── useTurnos.ts
│   ├── lib/
│   │   ├── admin.ts
│   │   ├── booking.ts
│   │   ├── format.ts
│   │   ├── roles.ts
│   │   └── supabase.ts
│   ├── pages/
│   │   ├── AdminPage.tsx
│   │   ├── CanchaDetailPage.tsx
│   │   ├── CanchasPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── MatchDetailPage.tsx
│   │   ├── PartidosPage.tsx
│   │   └── PerfilPage.tsx
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env                     # Variables de entorno (NO commitear)
├── .env.local
├── index.html
├── opencode.json            # Configuración de OpenCode
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 10. Comandos de Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# Iniciar con acceso desde celular en la misma red
npm run dev -- --host 0.0.0.0

# Build de producción
npm run build

# Preview del build
npm run preview

# Type checking
npm run lint
```

---

## 11. Estado Actual

- Vista de detalle de cancha (`/cancha/:id`) ✅
- Vista de detalle de partido (`/partido/:id`) ✅
- Funcionalidad real en `/partidos` y `/canchas` ✅
- Panel de administración completo con 6 secciones ✅
- Sistema de turnos semanales recurrentes ✅

### Próximos Pasos (Pendientes)

- [ ] Evaluar si corregir avisos heredados de PostGIS
- [ ] Configurar flujo de pago en el lugar

---

## 12. Notas de Migración

- El proyecto usa **rutas en español** para las tablas de Supabase (no inglés).
- El esquema de DB ya está creado y poblado en el proyecto de Supabase `dlrcvkwauauoalsolshl`.
- Las keys de Supabase son **publishable** (no secretas), seguras para frontend.
- El servidor de desarrollo corre en `http://127.0.0.1:5173` por defecto.
- Para acceso desde celular en la misma red, usar `--host 0.0.0.0`.
