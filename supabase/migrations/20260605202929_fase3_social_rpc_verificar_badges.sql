CREATE OR REPLACE FUNCTION public.verificar_badges(p_usuario_id uuid)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_nuevos text[] := '{}';
  v_count int;
  v_nivel int;
BEGIN
  -- primer_partido
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'primer_partido') THEN
    SELECT COUNT(*) INTO v_count FROM (
      SELECT partido_id FROM participantes_partido WHERE usuario_id = p_usuario_id
      UNION
      SELECT id FROM partidos WHERE organizador_id = p_usuario_id
    ) t;
    IF v_count >= 1 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'primer_partido');
      v_nuevos := array_append(v_nuevos, 'primer_partido');
    END IF;
  END IF;

  -- organizador_nato
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'organizador_nato') THEN
    SELECT COUNT(*) INTO v_count FROM partidos WHERE organizador_id = p_usuario_id;
    IF v_count >= 5 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'organizador_nato');
      v_nuevos := array_append(v_nuevos, 'organizador_nato');
    END IF;
  END IF;

  -- sociable
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'sociable') THEN
    SELECT COUNT(*) INTO v_count FROM participantes_partido WHERE usuario_id = p_usuario_id;
    IF v_count >= 10 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'sociable');
      v_nuevos := array_append(v_nuevos, 'sociable');
    END IF;
  END IF;

  -- veterano
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'veterano') THEN
    SELECT COUNT(*) INTO v_count FROM (
      SELECT partido_id FROM participantes_partido WHERE usuario_id = p_usuario_id
      UNION ALL
      SELECT id FROM partidos WHERE organizador_id = p_usuario_id
    ) t;
    IF v_count >= 25 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'veterano');
      v_nuevos := array_append(v_nuevos, 'veterano');
    END IF;
  END IF;

  -- nivel_alto
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'nivel_alto') THEN
    SELECT nivel_voley INTO v_nivel FROM usuarios WHERE id = p_usuario_id;
    IF v_nivel >= 8 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'nivel_alto');
      v_nuevos := array_append(v_nuevos, 'nivel_alto');
    END IF;
  END IF;

  -- racha_3
  IF NOT EXISTS (SELECT 1 FROM usuario_badges WHERE usuario_id = p_usuario_id AND badge_id = 'racha_3') THEN
    WITH partidos_usuario AS (
      SELECT t.fecha FROM participantes_partido pp
        JOIN partidos p ON p.id = pp.partido_id
        JOIN reservas r ON r.id = p.reserva_id
        JOIN disponibilidad_turnos t ON t.id = r.turno_id
        WHERE pp.usuario_id = p_usuario_id
      UNION
      SELECT t.fecha FROM partidos p
        JOIN reservas r ON r.id = p.reserva_id
        JOIN disponibilidad_turnos t ON t.id = r.turno_id
        WHERE p.organizador_id = p_usuario_id
    ),
    fechas_ordenadas AS (
      SELECT fecha, LAG(fecha) OVER (ORDER BY fecha DESC) AS fecha_anterior
      FROM partidos_usuario ORDER BY fecha DESC LIMIT 3
    )
    SELECT COUNT(*) INTO v_count FROM fechas_ordenadas
    WHERE fecha_anterior IS NOT NULL AND (fecha_anterior - fecha) <= 7;
    IF v_count >= 2 THEN
      INSERT INTO usuario_badges (usuario_id, badge_id) VALUES (p_usuario_id, 'racha_3');
      v_nuevos := array_append(v_nuevos, 'racha_3');
    END IF;
  END IF;

  RETURN v_nuevos;
END;
$function$;
