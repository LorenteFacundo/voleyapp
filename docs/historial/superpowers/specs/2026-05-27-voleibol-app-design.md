# Especificación de Diseño Técnico - Aplicación de Voleibol

**Fecha:** 2026-05-27
**Estado:** Aprobado por el usuario
**Autor:** opencode (con metodología Superpowers)

---

## 1. Resumen Ejecutivo
Esta aplicación web permite a los usuarios buscar y alquilar canchas de voleibol asociadas (colaboradoras) directamente desde un mapa interactivo. Además, resuelve el problema de la falta de jugadores permitiendo organizar partidos de nivel recreativo, intermedio o competitivo, con opciones de reserva provisional híbrida para asegurar la cancha mientras se completa el grupo de juego.

---

## 2. Requerimientos de Funcionalidad (Casos de Uso)
1. **Reserva Directa:** Buscar canchas colaboradoras y pre-reservar/reservar un horario disponible con pago en el lugar física.
2. **Organización de Partidos:**
   * Crear un partido vinculando una pre-reserva de cancha.
   * Elegir nivel de juego: Recreativo, Intermedio, Competitivo.
   * Definir cupos de jugadores (Mínimo 12, Máximo 22).
   * Permitir agregar "invitados" (jugadores externos ya confirmados por el creador, reduciendo los cupos públicos disponibles).
   * Tipo de ingreso: Libre (unión directa) o requiere confirmación manual del creador.
3. **Reserva Provisional Híbrida (Ventana de 4 horas):**
   * Al crear el partido, la cancha se bloquea ("Pre-reserva") por 4 horas de manera provisional.
   * Si se anotan 12 jugadores (mínimo) en esas 4 horas, la reserva se confirma automáticamente.
   * Si no se llega a 12, el creador puede confirmar la reserva asumiendo el pago total manualmente.
   * Si vence el plazo sin confirmación, la cancha se libera automáticamente.
4. **Mapa de Ubicación:** Ver las canchas más cercanas en un mapa basándose en la geolocalización del usuario.
5. **Panel del Propietario (Canchas):** Los dueños asignados manualmente por el Admin Global pueden iniciar sesión para ver las reservas de sus canchas y configurar sus calendarios de horarios.

---

## 3. Modelo de Datos (Base de Datos Relacional)

### Tipos Enum (Custom Postgres Types en Supabase)
* `user_role` : `('jugador', 'admin_cancha', 'admin_global')`
* `game_level` : `('recreativo', 'intermedio', 'competitivo')`
* `match_status` : `('provisional', 'confirmado', 'cancelado')`
* `player_status` : `('pendiente_aprobacion', 'confirmado', 'rechazado')`

### Tabla: `users`
* `id` (UUID, Primary Key, FK a `auth.users`)
* `nombre_completo` (TEXT)
* `rol` (`user_role`, default `'jugador'`)
* `nivel_voley` (`game_level`, default `'recreativo'`)
* `created_at` (TIMESTAMP WITH TIME ZONE, default `now()`)

### Tabla: `courts`
* `id` (UUID, Primary Key, default `gen_random_uuid()`)
* `nombre` (TEXT, Not Null)
* `direccion` (TEXT, Not Null)
* `latitud` (NUMERIC, Not Null)
* `longitud` (NUMERIC, Not Null)
* `precio_hora` (NUMERIC, Not Null)
* `admin_id` (UUID, FK a `users.id`, nullable - asignado manualmente)
* `created_at` (TIMESTAMP WITH TIME ZONE, default `now()`)

### Tabla: `matches`
* `id` (UUID, Primary Key, default `gen_random_uuid()`)
* `creador_id` (UUID, FK a `users.id`, Not Null)
* `cancha_id` (UUID, FK a `courts.id`, Not Null)
* `fecha` (DATE, Not Null)
* `hora_inicio` (TIME, Not Null)
* `hora_fin` (TIME, Not Null)
* `nivel_requerido` (`game_level`, Not Null)
* `cupos_totales` (INT, Not Null, check entre 12 y 22)
* `cupos_invitados` (INT, default 0, check menor que `cupos_totales`)
* `requiere_aprobacion` (BOOLEAN, default false)
* `estado` (`match_status`, default `'provisional'`)
* `limite_provisional` (TIMESTAMP WITH TIME ZONE, Not Null)
* `created_at` (TIMESTAMP WITH TIME ZONE, default `now()`)

### Tabla: `match_players`
* `match_id` (UUID, FK a `matches.id` ON DELETE CASCADE, Not Null)
* `user_id` (UUID, FK a `users.id` ON DELETE CASCADE, Not Null)
* `estado_inscripcion` (`player_status`, default `'confirmado'`)
* *PK compuesta: (`match_id`, `user_id`)*
* `created_at` (TIMESTAMP WITH TIME ZONE, default `now()`)

---

## 4. Políticas de Seguridad (RLS en Supabase)

### Tabla `courts`
* **SELECT:** Permitido para todos los usuarios (público / anónimo).
* **ALL:** Permitido únicamente para usuarios con rol `'admin_global'`.

### Tabla `matches`
* **SELECT:** Permitido para todos los usuarios autenticados.
* **INSERT:** Permitido para cualquier usuario autenticados.
* **UPDATE:** Permitido solo si `auth.uid() = creador_id` o si el usuario es `'admin_global'`.

### Tabla `match_players`
* **SELECT:** Permitido para todos los usuarios autenticados.
* **INSERT:** Un usuario puede insertarse a sí mismo (`auth.uid() = user_id`) si hay cupos libres y el partido no está cancelado. El estado inicial será `'confirmado'` si `matches.requiere_aprobacion` es `false`, de lo contrario `'pendiente_aprobacion'`.
* **UPDATE:** Solo el creador del partido (`matches.creador_id = auth.uid()`) puede cambiar el estado de inscripción de otros jugadores de `'pendiente_aprobacion'` a `'confirmado'` o `'rechazado'`.

---

## 5. Arquitectura del Frontend (React + Tailwind CSS)

### Vistas Principales (Rutas)
* `/` : **Dashboard Principal / Mapa de Canchas**. Panel principal que geolocaliza al usuario, renderiza el mapa interactivo con Leaflet y lista partidos públicos activos en los que se puede anotar.
* `/login` y `/registro` : **Gestión de Sesión**. Autenticación integrada directamente con Supabase Auth.
* `/cancha/:id` : **Perfil de Cancha**. Detalle de la ubicación, precio, horarios y formulario de pre-reserva/organizar partido.
* `/partido/:id` : **Ficha de Partido**. Muestra la cuenta regresiva de la reserva provisional, lista de jugadores apuntados y permite que el creador apruebe solicitudes.
* `/admin` : **Panel de Control del Dueño de Cancha**. Agenda de reservas de la cancha para administrar el negocio.

---

## 6. Siguientes Pasos (Implementación)
1. Integración de la Base de Datos a través del Supabase MCP provisto por el usuario.
2. Ejecución del script SQL para estructurar la base de datos de Supabase.
3. Creación del scaffold del frontend React (Vite) en el directorio local.
4. Codificación de componentes UI e integración con Supabase Client.
