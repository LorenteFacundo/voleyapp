# Fase 2 — Engagement: Spec de Diseño

**Fecha:** 2026-06-05
**Estado:** Aprobado
**Alcance:** Estadísticas de perfil, sharing/invitaciones, notificaciones in-app

---

## 1. Estadísticas de perfil

### Descripción
Agregar "partidos jugados" al perfil del usuario. Historial detallado queda oculto por ahora.

### UX
- En `PerfilPage`, junto a Nivel y Rol, agregar "Partidos jugados"
- Se cuenta: participaciones en `participantes_partido` + partidos donde es organizador (sin duplicar)

### Backend
- Columna `partidos_jugados` en `usuarios` (int, default 0, denormalizado)
- Se actualía al crear/unirse/salirse de partido (similar a `puntos_total`)

### Frontend
- Mostrar en el grid de stats del perfil

---

## 2. Sharing y links de invitación

### Descripción
Compartir un partido via link. El link usa el `token_invitacion` existente para abrir el partido directamente.

### UX
- En `MatchDetailPage`, botón "Compartir partido"
- En mobile: usa Web Share API (nativo del OS)
- En desktop: copia link al clipboard
- Link format: `https://app.com/partido/invitar/{token}`
- Nueva ruta `/partido/invitar/:token` que redirige a `/partido/:id`

### Backend
- El `token_invitacion` ya existe en la tabla `partidos`
- Nueva RPC `buscar_partido_por_token(p_token varchar)` → retorna partido_id

### Frontend
- Componente `ShareButton` con Web Share API + clipboard fallback
- Nueva ruta en App.tsx que resuelve token → id y redirige

---

## 3. Notificaciones in-app

### Descripción
Sistema de notificaciones dentro de la app. Se muestran como un panel desde el header.

### Tipos de notificación
| Tipo | Trigger | Mensaje |
|------|---------|---------|
| `nueva_inscripcion` | Alguien se une a tu partido | "{nombre} se unió a tu partido" |
| `inscripcion_aprobada` | Organizador te aprueba | "Fuiste aprobado en {partido}" |
| `partido_confirmado` | Partido alcanza cupo mínimo | "¡Tu partido se confirmó!" |
| `nuevo_mensaje` | Nuevo mensaje en el muro | "{nombre} escribió en el muro" |

### Backend
- Tabla `notificaciones`:
  - `id` bigint PK
  - `usuario_id` uuid FK (destinatario)
  - `tipo` varchar
  - `titulo` text
  - `partido_id` bigint FK (nullable)
  - `leida` boolean DEFAULT false
  - `created_at` timestamptz
- RPC `crear_notificacion(usuario_id, tipo, titulo, partido_id)` — SECURITY DEFINER
- RPC `marcar_notificacion_leida(notificacion_id)` — para el usuario
- RPC `mis_notificaciones()` — retorna las 20 más recientes del usuario
- RLS: usuario solo ve las suyas

### Frontend
- Hook `useNotificaciones`
- Componente `NotificationBell` en Header (icono + badge de no leídas)
- Componente `NotificationPanel` dropdown con lista de notificaciones
- Click en notificación navega al partido correspondiente
