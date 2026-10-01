CREATE OR REPLACE VIEW public.partidos_listado
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.estado_partido,
  p.visibilidad,
  p.cupo_minimo,
  p.cupo_maximo,
  p.nivel_requerido,
  p.requiere_aprobacion,
  p.organizador_id,
  u.nombre_completo AS organizador_nombre,
  cl.nombre AS club_nombre,
  ch.nombre_identificador AS cancha_nombre,
  dt.fecha AS turno_fecha,
  dt.hora_inicio AS turno_hora_inicio,
  dt.hora_fin AS turno_hora_fin,
  (
    SELECT COUNT(*)::integer
    FROM public.participantes_partido pp
    WHERE pp.partido_id = p.id
      AND pp.estado_inscripcion IN ('confirmado', 'pendiente_aprobacion', 'pendiente_pago')
  ) AS inscriptos_count,
  (
    SELECT pp.estado_inscripcion
    FROM public.participantes_partido pp
    WHERE pp.partido_id = p.id
      AND pp.usuario_id = auth.uid()
    LIMIT 1
  ) AS mi_estado_inscripcion
FROM public.partidos p
LEFT JOIN public.usuarios u ON u.id = p.organizador_id
LEFT JOIN public.reservas r ON r.id = p.reserva_id
LEFT JOIN public.disponibilidad_turnos dt ON dt.id = r.turno_id
LEFT JOIN public.canchas ch ON ch.id = dt.cancha_id
LEFT JOIN public.clubes cl ON cl.id = ch.club_id
WHERE p.visibilidad = 'publico'
  AND p.estado_partido NOT IN ('cancelado', 'borrador');

GRANT SELECT ON public.partidos_listado TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.unirse_a_partido(p_partido_id bigint)
RETURNS public.participantes_partido
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_partido public.partidos%ROWTYPE;
  v_inscriptos integer;
  v_estado character varying;
  v_row public.participantes_partido%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Tenés que iniciar sesión para unirte a un partido.';
  END IF;

  SELECT * INTO v_partido FROM public.partidos WHERE id = p_partido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partido no encontrado.';
  END IF;

  IF v_partido.visibilidad::text <> 'publico' THEN
    RAISE EXCEPTION 'Este partido no acepta inscripciones públicas.';
  END IF;

  IF v_partido.estado_partido::text IN ('cancelado', 'borrador') THEN
    RAISE EXCEPTION 'Este partido no acepta inscripciones.';
  END IF;

  IF v_partido.organizador_id = v_user_id THEN
    RAISE EXCEPTION 'Ya sos el organizador de este partido.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Completá tu perfil antes de unirte a un partido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.participantes_partido
    WHERE partido_id = p_partido_id
      AND usuario_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Ya estás inscripto en este partido.';
  END IF;

  SELECT COUNT(*)::integer INTO v_inscriptos
  FROM public.participantes_partido
  WHERE partido_id = p_partido_id
    AND estado_inscripcion::text IN ('confirmado', 'pendiente_aprobacion', 'pendiente_pago');

  IF v_inscriptos >= v_partido.cupo_maximo THEN
    RAISE EXCEPTION 'El partido ya está completo.';
  END IF;

  v_estado := CASE
    WHEN v_partido.requiere_aprobacion THEN 'pendiente_aprobacion'
    ELSE 'confirmado'
  END;

  INSERT INTO public.participantes_partido (partido_id, usuario_id, estado_inscripcion)
  VALUES (p_partido_id, v_user_id, v_estado)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unirse_a_partido(bigint) TO authenticated;
