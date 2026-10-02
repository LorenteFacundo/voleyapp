-- ============ RLS ============
ALTER TABLE public.mensajes_partido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_actividad ENABLE ROW LEVEL SECURITY;

-- badges_catalogo: lectura pública
CREATE POLICY "Badges visibles para todos" ON public.badges_catalogo FOR SELECT USING (true);

-- usuario_badges: lectura pública
CREATE POLICY "Badges de usuario visibles" ON public.usuario_badges FOR SELECT USING (true);

-- mensajes_partido: lectura/escritura solo para participantes confirmados
CREATE POLICY "Mensajes visibles para participantes" ON public.mensajes_partido FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.participantes_partido pp
    WHERE pp.partido_id = mensajes_partido.partido_id
      AND pp.usuario_id = auth.uid()
      AND pp.estado_inscripcion = 'confirmado'
  )
);

CREATE POLICY "Participantes envían mensajes" ON public.mensajes_partido FOR INSERT WITH CHECK (
  usuario_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.participantes_partido pp
    WHERE pp.partido_id = mensajes_partido.partido_id
      AND pp.usuario_id = auth.uid()
      AND pp.estado_inscripcion = 'confirmado'
  )
);

-- puntos_actividad: lectura propia
CREATE POLICY "Usuario ve sus puntos" ON public.puntos_actividad FOR SELECT USING (usuario_id = auth.uid());
