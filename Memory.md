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

### Fix post-rediseño:
- Se crearon páginas placeholder para las rutas del BottomNav: `/partidos`, `/canchas`, `/perfil`.
- Se actualizó `App.tsx` con las nuevas rutas.
- Se agregó formulario de login/registro en la página de Perfil (antes solo visible en sidebar desktop), solucionando pantalla en blanco en mobile.
- El servidor de desarrollo ahora corre con `--host 0.0.0.0` para acceso desde celular en la misma red.

## Proximos pasos
- Construir vistas de detalle:
  - `/cancha/:id`
  - `/partido/:id`
- Implementar funcionalidad real en las páginas `/partidos` y `/canchas` (actualmente son placeholders).
- Decidir si se corrigen los avisos heredados de PostGIS:
  - `ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;`
  - mover extension PostGIS fuera del schema `public` solo si se valida impacto.

## 2026-06-01 — Páginas de Canchas, Partidos y Detalle

### Instalación de Superpowers y MCP de Supabase
- Se instaló el plugin `superpowers` en `opencode.json` del proyecto.
- Se configuró el MCP de Supabase en `~/.config/opencode/opencode.json`.
- Se autenticó el MCP con `opencode mcp auth supabase`.
- Se instalaron las Agent Skills de Supabase (`npx skills add supabase/agent-skills`).
- Se copiaron las 31 skills del proyecto (`.agents/skills/`) al directorio global de Superpowers.
- Total de skills disponibles: 45 (14 originales + 31 del proyecto).

### Nuevos hooks
- `useAllCanchas` — lista todas las canchas con datos del club (búsqueda por nombre).
- `useMisPartidos` — partidos del usuario (organizados + inscriptos), con campo `mi_rol`.
- `useCanchaDetalle` — detalle de una cancha individual con datos del club.

### CanchasPage (`/canchas`)
- Reemplazó el placeholder con un listado real de canchas.
- Búsqueda por nombre de cancha.
- Grid responsive con fotos, precio, dirección y teléfono del club.
- Navegación a `/cancha/:id` al hacer clic.

### PartidosPage (`/partidos`)
- Reemplazó el placeholder con los partidos del usuario autenticado.
- Tabs: Todos / Organizados / Inscripto.
- Usa `MatchCardV2` para las cards (mismo diseño que HomePage).
- Navegación a `/partido/:id` al hacer clic.

### CanchaDetailPage (`/cancha/:id`)
- Vista de detalle de una cancha individual.
- Galería de fotos.
- Info de la cancha (título, descripción, precio, seña).
- Info del club (nombre, dirección, teléfono).
- Mapa con la ubicación del club.
- Horarios disponibles (reutiliza `ScheduleBoard`).
- Acciones: Alquilar cancha y Organizar partido (con formulario completo).

### Otros cambios
- Se agregó `organizador_id` al tipo `PartidoPublico`.
- Se agregó ruta `/cancha/:id` en `App.tsx` (lazy loaded).
- `npm run build` pasa correctamente.

## 2026-06-01 — Panel de Administración Completo

### Backend (Supabase RPCs)
Se crearon 13 RPCs SECURITY DEFINER en Supabase para operaciones admin:
- `is_admin()` — helper para verificar si el usuario actual es admin
- `admin_listar_clubes()` — lista todos los clubes con conteo de canchas
- `admin_actualizar_club()` — actualiza datos de un club
- `admin_eliminar_club()` — elimina un club (solo si no tiene canchas)
- `admin_listar_canchas()` — lista todas las canchas con datos del club
- `admin_actualizar_cancha()` — actualiza datos de una cancha
- `admin_eliminar_cancha()` — elimina una cancha (solo si no tiene turnos reservados)
- `admin_listar_turnos()` — lista turnos con filtros opcionales (cancha, fecha)
- `admin_eliminar_turno()` — elimina un turno (solo si no está reservado)
- `admin_listar_reservas()` — lista todas las reservas con datos del usuario y turno
- `admin_cancelar_reserva()` — cancela una reserva y libera el turno
- `admin_listar_partidos()` — lista todos los partidos con datos del organizador
- `admin_cancelar_partido()` — cancela un partido
- `admin_listar_usuarios()` — lista todos los usuarios
- `admin_actualizar_rol()` — cambia el rol de un usuario

### Frontend (Componentes Admin)
Nuevos componentes en `src/components/admin/`:
- `AdminDashboard.tsx` — dashboard principal con 6 tabs (Clubes, Canchas, Turnos, Reservas, Partidos, Usuarios)
- `ClubesTable.tsx` — tabla de clubes con editar/eliminar
- `CanchasTable.tsx` — tabla de canchas con editar/eliminar
- `TurnosTable.tsx` — tabla de turnos con filtro por fecha y eliminar
- `ReservasTable.tsx` — tabla de reservas con cancelar
- `PartidosTable.tsx` — tabla de partidos con cancelar
- `UsuariosTable.tsx` — tabla de usuarios con cambio de rol
- `ConfirmDialog.tsx` — diálogo de confirmación reutilizable

### Funciones admin en `admin.ts`
Se agregaron 12 funciones CRUD:
- `adminListarClubes`, `adminActualizarClub`, `adminEliminarClub`
- `adminListarCanchas`, `adminActualizarCancha`, `adminEliminarCancha`
- `adminListarTurnos`, `adminEliminarTurno`
- `adminListarReservas`, `adminCancelarReserva`
- `adminListarPartidos`, `adminCancelarPartido`
- `adminListarUsuarios`, `adminActualizarRol`

### Tipos admin en `types/index.ts`
- `ClubAdmin`, `CanchaAdmin`, `TurnoAdmin`, `ReservaAdmin`, `PartidoAdmin`, `UsuarioAdmin`

### Cambios en AdminPage
- Ahora renderiza `AdminDashboard` como vista principal
- Mantiene `AdminPanel` para crear nuevas canchas (accesible desde el dashboard)

### Fix 2026-06-01 — Arreglos de foreign keys y gestión de turnos

**Problema 1:** No se podían cancelar reservas ni eliminar turnos reservados porque violaban foreign key constraints con `partidos`.

**Fix en backend:**
- `admin_cancelar_reserva()` — ahora borra los `participantes_partido` y el `partido` vinculado antes de borrar la reserva.
- `admin_eliminar_turno()` — ahora borra la reserva y el partido vinculado antes de borrar el turno.

**Nuevas RPCs:**
- `admin_crear_turno(cancha_id, fecha, hora_inicio, hora_fin)` — agrega un turno a una cancha.
- `admin_listar_turnos_cancha(cancha_id)` — lista los turnos de una cancha específica.

**Nuevas funciones en `admin.ts`:**
- `adminListarTurnosCancha(canchaId)`
- `adminCrearTurno({ canchaId, fecha, horaInicio, horaFin })`

**Mejora en frontend:**
- `CanchasTable.tsx` — el modal de edición ahora incluye una sección "Turnos disponibles" donde se pueden:
  - Ver todos los turnos de la cancha (fecha, hora, estado)
  - Agregar nuevos turnos (con inputs de fecha, inicio y fin)
  - Eliminar turnos individuales

### Estado
- `npm run build` pasa correctamente
- Emanuel Lorente (`xxmaxgorxx@gmail.com`) configurado como `admin_global`

## 2026-06-01 — Sistema de Turnos Semanal Recurrente

### Problema
El sistema anterior requería crear turnos individuales por cada fecha (ej: 365 turnos por año). Muy engorroso para el admin.

### Solución: Horarios Semanales
Nuevo modelo donde el admin define horarios por día de la semana (Lunes a Domingo), y el sistema genera virtualmente los turnos para las próximas 5 semanas.

### Nueva tabla `horarios_semanales`
- `id`, `cancha_id`, `dia_semana` (0=Dom, 1=Lun, ..., 6=Sáb)
- `hora_inicio`, `hora_fin`
- `precio_total`, `precio_sena` — precio por franja (puede variar por día/hora)
- `activo`

### Nuevas RPCs
- `admin_listar_horarios_semanales(p_cancha_id)` — lista horarios de una cancha
- `admin_guardar_horarios_semanales(p_cancha_id, p_horarios jsonb)` — reemplaza todos los horarios
- `admin_eliminar_horario_semanal(p_horario_id)` — elimina un horario
- `obtener_turnos_disponibles(p_cancha_id, p_desde, p_hasta)` — genera turnos virtuales cruzando horarios_semanales con disponibilidad_turnos

### Cambios en frontend
- `useTurnos.ts` — ahora usa `obtenerTurnosDisponibles` (RPC) en vez de leer directo de `disponibilidad_turnos`
- `ScheduleBoard.tsx` — muestra precio por franja
- `BookingFlow.tsx` — usa precio del horario semanal
- `CanchasTable.tsx` — grilla semanal visual (7 columnas: Lun-Dom) para definir horarios
- `types/index.ts` — nuevos tipos `HorarioSemanal`, `TurnoVirtual`, `DIA_SEMANA_LABEL`, `DIA_SEMANA_CORTO`

### Flujo
1. Admin define horarios semanales por cancha (ej: Lunes 18:00-20:00 $35.000)
2. Sistema genera virtualmente los turnos para 5 semanas
3. Al reservar, se crea registro concreto en `disponibilidad_turnos`
4. Los turnos reservados se marcan como "Ocupado" automáticamente

### Fix 2026-06-01 — Turnos virtuales no aparecían

**Problema 1:** Bug en SQL — `p_dia` en vez de `p_hasta` en el loop de `obtener_turnos_disponibles`.

**Problema 2:** `ScheduleBoard` usaba `turno.id` para selección, pero turnos virtuales tienen `id: null`.

**Fix:**
- SQL corregido por el usuario (re-ejecutado)
- Nueva función `turnoKey(turno)` en `booking.ts` — genera clave única: `id` si existe, sino `fecha-hora_inicio-hora_fin`
- `ScheduleBoard.tsx` — ahora usa `selectedTurnoKey` (string) en vez de `selectedTurnoId`
- `BookingFlow.tsx` y `CanchaDetailPage.tsx` — pasan `turnoKey(selectedTurno)` al ScheduleBoard
- Se removió `customTurnoRef` de BookingFlow (ya no es necesario)

### Fix 2026-06-01 — No se podía reservar turnos virtuales

**Problema:** `reservar_turno_rango` buscaba un turno concreto en `disponibilidad_turnos`, pero los turnos virtuales no existen en la tabla.

**Fix:**
- Nuevos RPCs en Supabase:
  - `reservar_turno_virtual` — crea el turno concreto + reserva en una transacción
  - `crear_partido_virtual` — crea turno + reserva + partido + organizador en una transacción
- Nuevas funciones en `admin.ts`:
  - `reservarTurnoVirtual()` — para turnos virtuales
  - `crearPartidoVirtual()` — para crear partidos desde turnos virtuales
- `BookingFlow.tsx` y `CanchaDetailPage.tsx` — ahora detectan si el turno es virtual (`id === null`) y usan las funciones correspondientes

### Mejora UX 2026-06-01 — Selector de fecha en ScheduleBoard

**Problema:** El usuario tenía que hacer mucho scroll para ver todos los horarios disponibles.

**Fix:** `ScheduleBoard.tsx` rediseñado:
- Selector de fechas horizontal (scroll horizontal compacto) con día, número y mes
- Al seleccionar una fecha, se muestran solo los horarios de esa fecha
- Fechas sin turnos disponibles se muestran deshabilitadas
- Mucho más compacto y fácil de usar
