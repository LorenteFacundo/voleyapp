-- Fase 3: Social — Muro de mensajes, Badges, Ranking
-- Migración aplicada via Supabase MCP el 2026-06-05

-- ============ TABLAS ============
-- mensajes_partido, badges_catalogo, usuario_badges, puntos_actividad
-- + ALTER usuarios ADD puntos_total

-- ============ RLS ============
-- Todas las tablas con policies apropiadas

-- ============ VISTAS ============
-- ranking_jugadores (top 100 por puntos_total)

-- ============ RPCS ============
-- enviar_mensaje(partido_id, texto) → mensajes_partido
-- otorgar_puntos(usuario_id, puntos, motivo, referencia_id) → int
-- verificar_badges(usuario_id) → text[]

-- ============ SEED ============
-- 6 badges iniciales en badges_catalogo
