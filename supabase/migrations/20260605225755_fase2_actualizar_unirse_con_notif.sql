-- Actualizar unirse_a_partido para incrementar partidos_jugados y notificar
CREATE OR REPLACE FUNCTION public.unirse_a_partido(p_partido_id bigint)
RETURNS participantes_partido
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_partido partidos%ROWTYPE;
  v_usuario usuarios%ROWTYPE;
  v_jugadores_confirmados integer;
  v_inscripcion participantes_partido%ROWTYPE;
  v_estado_inscripcion text;
  v_nombre text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;
  IF v_partido IS NULL THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;

  IF v_partido.estado_partido NOT IN ('abierto', 'confirmado') THEN
    RAISE EXCEPTION 'El partido no está abierto para inscripciones';
  END IF;

  SELECT * INTO v_inscripcion FROM participantes_partido
  WHERE partido_id = p_partido_id AND usuario_id = auth.uid();
  IF v_inscripcion IS NOT NULL THEN RAISE EXCEPTION 'Ya estás inscrito en este partido'; END IF;

  SELECT * INTO v_usuario FROM usuarios WHERE id = auth.uid();
  IF v_partido.nivel_requerido = 'intermedio' AND (v_usuario.nivel_voley IS NULL OR v_usuario.nivel_voley < 3) THEN
    RAISE EXCEPTION 'Nivel de vóley insuficiente. Se requiere nivel intermedio (3+).';
  END IF;
  IF v_partido.nivel_requerido = 'competitivo' AND (v_usuario.nivel_voley IS NULL OR v_usuario.nivel_voley < 6) THEN
    RAISE EXCEPTION 'Nivel de vóley insuficiente. Se requiere nivel competitivo (6+).';
  END IF;

  SELECT COUNT(*) INTO v_jugadores_confirmados FROM participantes_partido
  WHERE partido_id = p_partido_id AND estado_inscripcion IN ('confirmado', 'pendiente_aprobacion');

  IF v_jugadores_confirmados >= v_partido.cupo_maximo THEN
    RAISE EXCEPTION 'El partido está lleno';
  END IF;

  v_estado_inscripcion := CASE WHEN v_partido.requiere_aprobacion THEN 'pendiente_aprobacion' ELSE 'confirmado' END;

  INSERT INTO participantes_partido (partido_id, usuario_id, estado_inscripcion, monto_sena_aportado)
  VALUES (p_partido_id, auth.uid(), v_estado_inscripcion, 0)
  RETURNING * INTO v_inscripcion;

  -- Incrementar partidos_jugados
  UPDATE usuarios SET partidos_jugados = partidos_jugados + 1 WHERE id = auth.uid();

  -- Notificar al organizador
  SELECT nombre_completo INTO v_nombre FROM usuarios WHERE id = auth.uid();
  PERFORM crear_notificacion(
    v_partido.organizador_id,
    'nueva_inscripcion',
    COALESCE(v_nombre, 'Alguien') || ' se unió a tu partido',
    p_partido_id
  );

  -- Verificar si se alcanzó el cupo mínimo → notificar a todos
  IF v_jugadores_confirmados + 1 >= v_partido.cupo_minimo AND v_partido.estado_partido = 'abierto' THEN
    -- Notificar a todos los inscritos
    INSERT INTO notificaciones (usuario_id, tipo, titulo, partido_id)
    SELECT pp.usuario_id, 'partido_confirmado', '¡Tu partido se confirmó!', p_partido_id
    FROM participantes_partido pp
    WHERE pp.partido_id = p_partido_id AND pp.usuario_id != auth.uid();
  END IF;

  RETURN v_inscripcion;
END;
$function$;
