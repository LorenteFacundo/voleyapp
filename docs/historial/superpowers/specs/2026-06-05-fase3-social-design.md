# Fase 3 — Social: Spec de Diseño

**Fecha:** 2026-06-05
**Estado:** Aprobado
**Alcance:** Muro de mensajes, Badges, Ranking por puntos

---

## 1. Muro de mensajes del partido

### Descripción
Tablero simple de mensajes dentro de la página de detalle del partido (`/partido/:id`). Solo los participantes inscritos pueden leer y escribir. Sin realtime — se recarga al abrir o con botón de refresh.

### UX
- En `MatchDetailPage`, debajo de la sección de participantes
- Sección con título "Muro del partido"
- Campo de texto (textarea, max 500 chars) + botón "Enviar"
- Mensajes ordenados cronológicamente (más viejo arriba, más nuevo abajo)
- Cada mensaje: avatar (inicial del nombre), nombre del usuario, timestamp relativo ("hace 5 min", "ayer"), texto
- Empty state: "Todavía no hay mensajes. Sé el primero en saludar"
- Límite de 500 caracteres con contador
- Solo participantes con estado `confirmado` pueden escribir (no `pendiente_aprobacion`)

### Backend
- **Tabla `mensajes_partido`:**
  - `id` bigint PK (identity)
  - `partido_id` bigint FK → partidos
  - `usuario_id` uuid FK → usuarios
  - `texto` text NOT NULL (max 500 chars, validado en CHECK)
  - `created_at` timestamptz DEFAULT now()
- **RLS:**
  - SELECT: usuario es participante confirmado del partido OR es organizador
  - INSERT: usuario es participante confirmado AND usuario_id = auth.uid()
  - Sin UPDATE/DELETE para usuarios normales (admin puede borrar)
- **Query:** JOIN con `usuarios` para obtener `nombre_completo`

### Frontend
- Hook `useMensajesPartido(partidoId)` — fetch + refresh manual
- Componente `MatchMessages` — lista + input
- Función `enviarMensaje(partidoId, texto)` en `lib/booking.ts`
- Función `fetchMensajesPartido(partidoId)` en `lib/booking.ts`

---

## 2. Badges (insignias de logros)

### Descripción
Badges visuales en el perfil del jugador que se desbloquean automáticamente al cumplir condiciones. Se evalúan después de cada acción relevante.

### Badges iniciales

| ID | Nombre | Condición | Icono Lucide |
|----|--------|-----------|--------------|
| `primer_partido` | Debut | Crear o unirse al primer partido | Volleyball |
| `racha_3` | Racha de 3 | 3 partidos consecutivos sin abandonar | Flame |
| `organizador_nato` | Organizador nato | Crear 5+ partidos | Star |
| `sociable` | Sociable | Unirse a 10+ partidos | Users |
| `veterano` | Veterano | 25+ partidos totales (creados + unidos) | Trophy |
| `nivel_alto` | Nivel competitivo | Alcanzar nivel_voley >= 8 | Zap |

### Backend
- **Tabla `badges_catalogo`:**
  - `id` varchar PK (ej: 'primer_partido')
  - `nombre` text NOT NULL
  - `descripcion` text NOT NULL
  - `icono` varchar NOT NULL (nombre de Lucide icon)
- **Tabla `usuario_badges`:**
  - `id` bigint PK (identity)
  - `usuario_id` uuid FK → usuarios
  - `badge_id` varchar FK → badges_catalogo
  - `otorgado_at` timestamptz DEFAULT now()
  - UNIQUE(usuario_id, badge_id)
- **RPC `verificar_badges(usuario_id uuid)`:**
  - Evalúa cada badge del catálogo
  - Si el usuario cumple la condición y no tiene el badge, lo otorga
  - Retorna array de badges nuevos otorgados (para mostrar toast)
  - Lógica:
    - `primer_partido`: COUNT en participantes_partido + partidos donde es organizador >= 1
    - `organizador_nato`: COUNT en partidos donde es organizador >= 5
    - `sociable`: COUNT en participantes_partido >= 10
    - `veterano`: COUNT partidos (organizador + participante) >= 25
    - `nivel_alto`: nivel_voley >= 8 en usuarios
    - `racha_3`: requiere tracking de secuencia (se evalúa aparte)
- **RLS:**
  - `badges_catalogo`: lectura pública
  - `usuario_badges`: lectura pública, INSERT solo via RPC

### Frontend
- En `PerfilPage`: sección "Mis badges" con grid
- Badges obtenidos: icono a color + nombre
- Badges no obtenidos: icono en gris con "🔒" + nombre tachado
- Tooltip con descripción al hover/tap
- Toast "¡Badge desbloqueado!" cuando `verificar_badges` retorna nuevos

### Nota sobre `racha_3`
La racha requiere tracking temporal. Se implementa verificando los últimos 3 partidos del usuario y si fueron consecutivos (sin gaps de más de 7 días). Se evalúa en `verificar_badges` con una query que ordena partidos por fecha.

---

## 3. Ranking por puntos de actividad

### Descripción
Sistema de puntos que acumula el jugador por actividad en la plataforma. Se muestra en el perfil y en un leaderboard público.

### Tabla de puntos

| Acción | Puntos | Trigger |
|--------|--------|---------|
| Crear un partido | +10 | `crear_partido` / `crear_partido_virtual` |
| Unirse a un partido | +5 | `unirse_a_partido` |
| Completar un partido (estado → confirmado) | +15 | Cambio de estado del partido |
| Recibir aprobación | +3 | Update de `estado_inscripcion` a `confirmado` |

### Backend
- **Tabla `puntos_actividad`:**
  - `id` bigint PK (identity)
  - `usuario_id` uuid FK → usuarios
  - `puntos` int NOT NULL
  - `motivo` varchar NOT NULL (ej: 'crear_partido', 'unirse', 'completar', 'aprobacion')
  - `referencia_id` bigint (ej: partido_id, nullable)
  - `created_at` timestamptz DEFAULT now()
- **Columna en `usuarios`:** `puntos_total` int DEFAULT 0 (denormalizado para performance)
- **RPC `otorgar_puntos(usuario_id uuid, puntos int, motivo varchar, referencia_id bigint DEFAULT NULL)`:**
  - INSERT en `puntos_actividad`
  - UPDATE `usuarios.puntos_total` = `puntos_total` + puntos
  - Retorna el nuevo total
  - Después de otorgar, llama a `verificar_badges(usuario_id)`
- **Vista `ranking_jugadores`:**
  - SELECT de `usuarios` con `puntos_total`, ordenado DESC
  - Incluye: id, nombre_completo, nivel_voley, puntos_total, ranking position
  - Limitada a top 100
- **RLS:**
  - `puntos_actividad`: lectura propia, INSERT solo via RPC
  - `ranking_jugadores`: lectura pública

### Frontend
- En `PerfilPage`: "Puntos de actividad: 1250" con desglose reciente
- Nueva sección en HomePage o page dedicada `/ranking`:
  - Leaderboard con top 20
  - Posición del usuario actual destacada
  - Cada fila: posición, avatar, nombre, nivel, puntos
- `BottomNav` puede actualizarse con item "Ranking" (opcional, evaluar si no sobrecarga)

### Integración con RPCs existentes
Las llamadas a `otorgar_puntos` se agregan al final de:
- `crear_partido` y `crear_partido_virtual` → +10 puntos
- `unirse_a_partido` → +5 puntos
- `salirse_de_partido` → -5 puntos (penalización leve)

Para "completar partido" se necesita un mecanismo. Opciones:
- **Opción A:** RPC `completar_partido(partido_id)` que cambia estado y otorga puntos
- **Opción B:** Trigger en UPDATE de `partidos.estado_partido` cuando pasa a `confirmado`

**Recomendación:** Opción A (RPC explícita) — más controlable y auditable.

---

## Orden de implementación

```
1. Migración SQL:
   - Tablas: mensajes_partido, badges_catalogo, usuario_badges, puntos_actividad
   - Alter tabla usuarios: agregar puntos_total
   - RPCs: enviar_mensaje, verificar_badges, otorgar_puntos, completar_partido
   - Vista: ranking_jugadores
   - RLS policies
   - Seed badges_catalogo

2. Muro de mensajes:
   - Hook useMensajesPartido
   - Componente MatchMessages
   - Integración en MatchDetailPage

3. Sistema de puntos:
   - Función otorgarPuntos en booking.ts
   - Integración en crear_partido, unirse, salirse

4. Badges:
   - Hook useBadges
   - Sección en PerfilPage
   - Toast de desbloqueo

5. Ranking:
   - Hook useRanking
   - Sección/Componente RankingBoard
   - Integración en HomePage o page dedicada

6. Integración cruzada:
   - Llamar verificar_badges después de otorgar_puntos
   - Llamar otorgar_puntos desde flujos existentes
```

---

## Dependencias y riesgos

- **Sin realtime:** El muro de mensajes es pull-based, no push. Si el usuario quiere ver mensajes nuevos, debe hacer refresh. Esto es intencional para simplificar.
- **Racha de 3:** La evaluación de racha puede ser compleja. Se puede simplificar verificando los últimos 3 partidos por fecha sin gap > 7 días.
- **Puntos negativos:** `salirse_de_partido` resta puntos. Esto puede frustrar usuarios si se equivocan. Considerar: ¿solo restar si se sale después de confirmado?
- **Badges no retroactivos:** Al implementar, los usuarios existentes no tendrán badges. Se puede hacer un script de backfill una vez.
