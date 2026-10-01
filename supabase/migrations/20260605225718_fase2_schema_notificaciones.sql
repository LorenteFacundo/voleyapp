-- ============ FASE 2: ENGAGEMENT ============

-- Agregar partidos_jugados a usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS partidos_jugados int DEFAULT 0;

-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo varchar NOT NULL,
  titulo text NOT NULL,
  partido_id bigint REFERENCES public.partidos(id) ON DELETE SET NULL,
  leida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve sus notificaciones" ON public.notificaciones
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "Usuario actualiza sus notificaciones" ON public.notificaciones
  FOR UPDATE USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
