# VoleyApp Rediseño Total — Diseño

## Fecha
2026-05-31

## Contexto
VoleyApp es una aplicación web React + Vite + Tailwind CSS para reservar canchas y organizar partidos de voleibol. Se conecta a Supabase para autenticación, base de datos y almacenamiento. Actualmente tiene una estructura funcional pero con un diseño minimalista que no refleja la energía del deporte.

## Objetivos
1. Crear una identidad visual que represente el voleibol: profesional, accesible, vibrante.
2. Rediseñar mobile-first, ya que la mayoría de usuarios accede desde celular.
3. Reorganizar el layout para enfocar los partidos como contenido principal.
4. Incorporar un mapa expandible (preview mini → pantalla completa) en mobile.
5. Mantener el código limpio, legible, escalable y fácil de entender.

## Identidad Visual

### Paleta de Colores
| Token | Hex | Uso |
|-------|-----|-----|
| `--vb-orange` | `#FF6B35` | CTAs primarios, acentos de energía, progreso activo |
| `--vb-blue` | `#1A237E` | Fondos oscuros, header, footer, texto de títulos |
| `--vb-yellow` | `#FFD23F` | Destacados, badges de nivel, estrellas, alertas amistosas |
| `--vb-white` | `#FFFFFF` | Fondos de cards, texto sobre oscuro |
| `--vb-gray` | `#2D3436` | Texto body, bordes sutiles |
| `--vb-light` | `#F8F9FA` | Fondo de la app |
| `--vb-orange-light` | `#FFF3ED` | Fondos de secciones destacadas, hover suave |
| `--vb-green` | `#00C853` | Estados positivos, confirmaciones |
| `--vb-red` | `#FF3D00` | Estados negativos, cupo lleno, alertas |

### Tipografía
- **Display**: `Outfit` (ya está en el proyecto), pesos 700-900. Títulos, hero, números grandes.
- **Body**: `DM Sans` (ya está en el proyecto), pesos 400-600. Todo el texto de lectura.
- Títulos: 24-32px en mobile, 36-48px en desktop.
- Body: 14-16px, interlineado 1.5.

### Principios de Diseño
- **Energía + Profesionalismo**: formas redondeadas (border-radius 12-16px) combinadas con sombras dinámicas.
- **Accesibilidad**: contraste WCAG AA mínimo, tamaños de touch target ≥ 44px en mobile.
- **Jerarquía clara**: espaciado generoso (8px base grid), secciones bien delimitadas.

## Arquitectura del Layout (Mobile-First)

### Navegación
- **Bottom Navigation Bar** (mobile): 4 pestañas — Inicio, Partidos, Canchas, Perfil.
- **Top Header** (desktop): Logo + links horizontales + acciones de usuario.
- El header en mobile es compacto (logo + menú hamburguesa si es necesario para admin).

### Página de Inicio (HomePage)
1. **Hero / Buscador**
   - Ilustración o imagen deportiva sutil (SVG o gradiente con silueta de pelota/red).
   - Headline: "Encontrá tu próximo partido".
   - Buscador prominente: input grande con ícono de lupa, placeholder "¿Dónde querés jugar hoy?".
   - Chips rápidos de filtros: "Hoy", "Este finde", "Mi nivel".

2. **Lista de Partidos (contenido principal)**
   - Cards grandes, ocupando casi todo el ancho en mobile.
   - Cada card muestra:
     - Nombre del club + cancha (texto bold).
     - Badge de nivel (color `--vb-yellow`).
     - Fecha y hora con íconos.
     - Precio (destacado).
     - Contador de jugadores confirmados / cupo máximo.
     - **Barra de progreso animada** que muestra cuántos faltan para completar el equipo.
     - Badge "Inscripto" o "Lleno" si aplica.
   - Grid: 1 columna en mobile, 2 en tablet, 3 en desktop.
   - Ordenados por fecha/hora más cercana.

3. **Mapa Expandible**
   - Aparece como una **pestaña en la parte inferior** de la pantalla (sheet/bottom drawer).
   - Estado normal: mini preview con 2-3 puntos de clubes cercanos y un texto "Ver mapa de clubes".
   - Al tocar o deslizar hacia arriba: se expande a pantalla completa con el mapa de Leaflet y todos los clubes.
   - Botón "✕" o swipe down para cerrar.
   - En desktop: el mapa es un panel lateral derecho de tamaño fijo (no expandible).

4. **Acción flotante (FAB)**
   - Botón circular naranja "+" en la esquina inferior derecha (encima del bottom nav) para crear un partido rápido.

### Página de Detalle de Partido (MatchDetailPage)
- Header con nombre del club y botón volver.
- Info completa: fecha, hora, cancha, nivel, precio, organizador.
- Lista de jugadores confirmados (avatares).
- Botón de inscripción grande y prominente (naranja si estás por inscribirte, verde si ya estás inscripto).
- Sección de reglas o notas del partido.

### Página de Admin (AdminPage)
- Mismo layout general pero con sidebar/contexto de administración.
- Mantener la coherencia visual.

### Autenticación
- Login/Register en modal o pantalla dedicada con fondo deportivo.
- Inputs grandes y amigables.

## Componentes UI Nuevos / Modificados

### Nuevos componentes:
- `BottomNav`: Barra de navegación inferior mobile.
- `HeroSection`: Banner con buscador y chips.
- `MatchCardV2`: Rediseño completo de la card de partido.
- `ExpandableMap`: Wrapper del mapa con comportamiento de sheet en mobile.
- `FAB`: Botón de acción flotante.
- `FilterChips`: Chips de filtro rápido.

### Modificados:
- `Header`: Compacto en mobile, expandido en desktop.
- `Button`: Nuevas variantes con colores vibrantes.
- `Card`: Bordes más redondeados, sombras más suaves, hover states.
- `Badge`: Colores según paleta nueva.
- `MapView`: Integrado dentro de `ExpandableMap`.

## Animaciones y Transiciones
- **Entrada de cards**: `slideUp` con stagger (50ms entre cada card).
- **Hover de cards**: `translateY(-4px)` + sombra más profunda.
- **Mapa expandible**: transición de altura suave (300ms ease-out).
- **Bottom nav**: active state con indicador animado (pequeña barra o punto).
- **Barra de progreso**: animación de ancho al cargar.
- **Toast/sonner**: mantener el actual, colores actualizados.

## Responsive Breakpoints
- **Mobile**: < 768px — Bottom nav, cards 1 columna, mapa expandible.
- **Tablet**: 768px - 1024px — Header expandido, cards 2 columnas, mapa lateral.
- **Desktop**: > 1024px — Header con links, cards 2-3 columnas, sidebar de perfil/mapas.

## Escalabilidad
- El sistema de componentes se mantiene modular. Cada nuevo componente vive en su propio archivo con props tipadas.
- La paleta de colores se define en Tailwind config para evitar hardcodeo.
- Las animaciones se centralizan en `index.css` o utilidades de Tailwind.
- El mapa expandible es un wrapper, por lo que el `MapView` existente se reutiliza sin cambios de lógica.

## Archivos Afectados
- `tailwind.config.js`: Nuevos colores, sombras, animaciones.
- `src/index.css`: Variables CSS, clases utilitarias, estilos globales.
- `src/App.tsx`: Posible restructura de rutas si agregamos BottomNav.
- `src/pages/HomePage.tsx`: Reestructura completa.
- `src/components/layout/Header.tsx`: Rediseño.
- `src/components/features/MatchCard.tsx`: Rediseño.
- `src/components/features/MatchList.tsx`: Layout de grid.
- `src/components/features/MapView.tsx`: Integrar en ExpandableMap.
- Nuevos archivos en `src/components/ui/` y `src/components/layout/`.

## Notas de Implementación
- Mantener la lógica existente (hooks, contextos, supabase) intacta. Solo cambiar presentación.
- Usar `clsx` y `tailwind-merge` para clases condicionales.
- No agregar dependencias nuevas a menos que sea estrictamente necesario.
- Probar en mobile (simulado) después de cada sección.

## Out of Scope (por ahora)
- Cambios en el backend o schema de Supabase.
- Nuevas funcionalidades (chat, notificaciones push, pagos).
- Modificación de la página de Admin (solo coherencia visual básica).
- Tests automáticos (se pueden agregar después).

## Aprobado por
Usuario: "si esta diseño me gusta, segui para delante"
