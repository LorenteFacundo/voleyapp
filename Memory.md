# Memory Log - Aplicacion de Voleibol

## Estado Actual
- **Fase:** Construccion inicial en marcha.
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Leaflet.
- **Backend:** Supabase conectado por MCP y autenticado con OAuth.
- **Dev server:** `http://127.0.0.1:5173`

## Hecho el 2026-05-27
- Se instalo y autentico el MCP de Supabase para el proyecto `dlrcvkwauauoalsolshl`.
- Se instalaron las Agent Skills de Supabase.
- Se detecto que Supabase ya tenia un modelo inicial en español:
  - `usuarios`
  - `clubes`
  - `administradores_club`
  - `canchas`
  - `disponibilidad_turnos`
  - `reservas`
  - `partidos`
  - `participantes_partido`
- Se adapto el plan para trabajar sobre ese modelo existente en lugar de duplicar tablas en ingles.
- Se aplicaron migraciones incrementales:
  - perfil automatico al crear usuarios en Auth;
  - roles extendidos (`jugador`, `admin_cancha`, `admin_global`, `superadmin`);
  - campos de partido: nivel requerido, aprobacion manual y expiracion de pre-reserva;
  - politicas RLS faltantes para reservas, partidos, participantes y administradores de club;
  - RPC `crear_partido` para crear reserva + partido + participante organizador;
  - vista `partidos_publicos` para lectura limpia desde el frontend.
- Se corrio Supabase Advisors:
  - quedan avisos heredados de PostGIS en `public.spatial_ref_sys` y extension `postgis` en schema public;
  - no se tocaron automaticamente porque mover PostGIS o bloquear `spatial_ref_sys` puede romper dependencias.
- Se inicializo la app React en la carpeta del proyecto.
- Se configuro `.env.local` con URL y publishable key de Supabase.
- Se construyo una primera UI funcional:
  - mapa con Leaflet;
  - login/registro con Supabase Auth;
  - perfil basico de usuario;
  - listado de partidos abiertos;
  - listado de turnos disponibles;
  - formulario para crear pre-reserva/partido.
- `npm run build` pasa correctamente.
- Verificacion en navegador integrado:
  - la app renderiza en `http://127.0.0.1:5173`;
  - no hay errores ni warnings de consola;
  - la DB esta vacia, por eso la UI muestra 0 partidos y 0 turnos.
- Se implementó el flujo de superadmin para agregar canchas completas:
  - Backend: Nuevos campos en `canchas` (título, descripción, fotos), bucket `canchas-fotos`, políticas RLS para admin_global/superadmin, y RPC `admin_crear_cancha` (que crea club, cancha y horarios, y permite reutilizar/actualizar clubes existentes con coordenadas y teléfono).
  - Frontend: Panel Admin (`/admin`) visible para roles de administrador.
  - Cuenta de usuario principal (`facundo.lorente07@gmail.com`) seteada como `superadmin`.
- Se implementó la reserva de turnos por rangos (`reservar_turno_rango`), permitiendo dividir un bloque grande (ej. 12:00 a 22:00) en varios más chicos al reservar (ej. 13:00 a 16:00).
- Se mejoró el mapa: ahora lee de una vista `public.clubes_publicos` para mostrar los pines de los clubes con ubicación registrada, incluso si no tienen partidos.

- Se implementó la UI para la **reserva de turnos por rangos** en `BookingFlow.tsx`, permitiendo a los usuarios elegir la hora de inicio y fin exacta al momento de alquilar o crear un partido (hace "split" del turno llamando a `reservar_turno_rango` antes de `crear_partido`).
- Se resolvieron bugs en el flujo de creación de partidos:
  - Se modificó `reservar_turno_rango` para aceptar el parámetro `estado_final` (solucionando el error *"El turno ya no está disponible"* al crear partidos).
  - Se modificó el `search_path` de `crear_partido` para que incluya `extensions` (solucionando el error de *"gen_random_bytes does not exist"* al generar tokens con pgcrypto).

## 2026-05-31 — Rediseño Total de UI

Se realizó un rediseño completo de la interfaz de VoleyApp con los siguientes objetivos:
- **Mobile-first**: la mayoría de usuarios acceden desde celular.
- **Identidad visual vibrante**: colores que representan el voleibol (naranja, azul, amarillo).
- **Layout reorganizado**: partidos como contenido principal, mapa expandible en mobile.

### Cambios principales:
- Nueva paleta de colores en `tailwind.config.js` (tokens `vb-*`).
- Componentes UI base actualizados (Button, Card, Badge) con colores vibrantes.
- Nuevos componentes:
  - `BottomNav` — navegación inferior mobile (Inicio, Partidos, Canchas, Perfil).
  - `HeroSection` — banner azul con buscador prominente y filtros rápidos.
  - `MatchCardV2` — cards de partidos con barra de progreso animada.
  - `ExpandableMap` — mapa tipo sheet en mobile, se expande a pantalla completa.
- `HomePage` reestructurada con hero, grid responsive, sidebar desktop, FAB mobile.
- `Header` rediseñado — compacto en mobile, expandido en desktop.
- Mapa con nuevos colores de markers (azul/naranja).
- Animaciones mejoradas (slideUp con stagger, progress bar animada).

### Decisiones de diseño:
- Bottom navigation bar en mobile para accesibilidad con el pulgar.
- FAB naranja en mobile para crear partidos rápidamente.
- Cards con progreso animado del equipo.
- Hero con buscador prominente y chips de filtro.
- Mapa se muestra como preview en mobile y se expande al tocar.

## Proximos pasos
- Construir vistas de detalle:
  - `/cancha/:id`
  - `/partido/:id`
- Implementar rutas para BottomNav: `/partidos`, `/canchas`, `/perfil`.
- Decidir si se corrigen los avisos heredados de PostGIS:
  - `ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;`
  - mover extension PostGIS fuera del schema `public` solo si se valida impacto.
