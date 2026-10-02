-- Actualizar salirse_de_partido con partidos_jugados y notificaciones
CREATE OR REPLACE FUNCTION public.salirse_de_partido(p_partido_id bigint)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_partido partidos%ROWTYPE;
  v_nuevo_organizador participantes_partido%ROWTYPE;
  v_resultado text;
  v_nombre text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;
  IF v_partido IS NULL THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;
  IF v_partido.estado_partido = 'cancelado' THEN RAISE EXCEPTION 'El partido está cancelado'; END IF;

  IF NOT EXISTS (SELECT 1 FROM participantes_partido WHERE partido_id = p_partido_id AND usuario_id = auth.uid()) THEN
    RAISE EXCEPTION 'No estás inscrito en este partido';
  END IF;

  -- Decrementar partidos_jugados
  UPDATE usuarios SET partidos_jugados = GREATEST(0, partidos_jugados - 1) WHERE id = auth.uid();

  IF v_partido.organizador_id = auth.uid() THEN
    SELECT * INTO v_nuevo_organizador
    FROM participantes_partido
    WHERE partido_id = p_partido_id AND usuario_id != auth.uid()
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_nuevo_organizador.usuario_id IS NOT NULL THEN
      UPDATE partidos SET organizador_id = v_nuevo_organizador.usuario_id WHERE id = p_partido_id;
      DELETE FROM participantes_partido WHERE partido_id = p_partido_id AND usuario_id = auth.uid();
      SELECT nombre_completo INTO v_resultado FROM usuarios WHERE id = v_nuevo_organizador.usuario_id;
      -- Notificar al nuevo organizador
      PERFORM crear_notificacion(
        v_nuevo_organizador.usuario_id,
        'nuevo_organizador',
        'Ahora sos el organizador de un partido',
        p_partido_id
      );
      RETURN COALESCE(v_resultado, 'Otro jugador');
    ELSE
      UPDATE partidos SET estado_partido = 'cancelado' WHERE id = p_partido_id;
      DELETE FROM participantes_partido WHERE partido_id = p_partido_id AND usuario_id = auth.uid();
      RETURN 'cancelado';
    END IF;
  ELSE
    DELETE FROM participantes_partido WHERE partido_id = p_partido_id AND usuario_id = auth.uid();
    RETURN 'saliste';
  END IF;
END;
$function$;
