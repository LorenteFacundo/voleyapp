-- Agregar validación de nivel_requerido al unirse a un partido
CREATE OR REPLACE FUNCTION public.unirse_a_partido(p_partido_id bigint)
RETURNS participantes_partido
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partido partidos%ROWTYPE;
  v_usuario usuarios%ROWTYPE;
  v_jugadores_confirmados integer;
  v_inscripcion participantes_partido%ROWTYPE;
  v_estado_inscripcion text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;
  IF v_partido IS NULL THEN
    RAISE EXCEPTION 'Partido no encontrado';
  END IF;

  IF v_partido.estado_partido NOT IN ('abierto', 'confirmado') THEN
    RAISE EXCEPTION 'El partido no está abierto para inscripciones';
  END IF;

  SELECT * INTO v_inscripcion
  FROM participantes_partido
  WHERE partido_id = p_partido_id AND usuario_id = auth.uid();

  IF v_inscripcion IS NOT NULL THEN
    RAISE EXCEPTION 'Ya estás inscrito en este partido';
  END IF;

  -- Validación de nivel requerido
  SELECT * INTO v_usuario FROM usuarios WHERE id = auth.uid();
  IF v_partido.nivel_requerido = 'intermedio' AND (v_usuario.nivel_voley IS NULL OR v_usuario.nivel_voley < 3) THEN
    RAISE EXCEPTION 'Nivel de vóley insuficiente. Se requiere nivel intermedio (3+).';
  END IF;
  IF v_partido.nivel_requerido = 'competitivo' AND (v_usuario.nivel_voley IS NULL OR v_usuario.nivel_voley < 6) THEN
    RAISE EXCEPTION 'Nivel de vóley insuficiente. Se requiere nivel competitivo (6+).';
  END IF;

  SELECT COUNT(*) INTO v_jugadores_confirmados
  FROM participantes_partido
  WHERE partido_id = p_partido_id
  AND estado_inscripcion IN ('confirmado', 'pendiente_aprobacion');

  IF v_jugadores_confirmados >= v_partido.cupo_maximo THEN
    RAISE EXCEPTION 'El partido está lleno';
  END IF;

  IF v_partido.requiere_aprobacion THEN
    v_estado_inscripcion := 'pendiente_aprobacion';
  ELSE
    v_estado_inscripcion := 'confirmado';
  END IF;

  INSERT INTO participantes_partido (
    partido_id,
    usuario_id,
    estado_inscripcion,
    monto_sena_aportado
  ) VALUES (
    p_partido_id,
    auth.uid(),
    v_estado_inscripcion,
    0
  )
  RETURNING * INTO v_inscripcion;

  RETURN v_inscripcion;
END;
$$;
