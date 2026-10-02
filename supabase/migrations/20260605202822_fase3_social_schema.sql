-- ============ TABLAS ============

-- Mensajes del partido
CREATE TABLE IF NOT EXISTS public.mensajes_partido (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  partido_id bigint NOT NULL REFERENCES public.partidos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  texto text NOT NULL CHECK (char_length(texto) > 0 AND char_length(texto) <= 500),
  created_at timestamptz DEFAULT now()
);

-- Catálogo de badges
CREATE TABLE IF NOT EXISTS public.badges_catalogo (
  id varchar PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text NOT NULL,
  icono varchar NOT NULL
);

-- Badges otorgados a usuarios
CREATE TABLE IF NOT EXISTS public.usuario_badges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  badge_id varchar NOT NULL REFERENCES public.badges_catalogo(id),
  otorgado_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, badge_id)
);

-- Puntos de actividad
CREATE TABLE IF NOT EXISTS public.puntos_actividad (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  puntos int NOT NULL,
  motivo varchar NOT NULL,
  referencia_id bigint,
  created_at timestamptz DEFAULT now()
);

-- Agregar puntos_total a usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS puntos_total int DEFAULT 0;
