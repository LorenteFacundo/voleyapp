CREATE OR REPLACE FUNCTION public.otorgar_puntos(
  p_usuario_id uuid, p_puntos int, p_motivo varchar, p_referencia_id bigint DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_nuevo_total int;
BEGIN
  INSERT INTO puntos_actividad (usuario_id, puntos, motivo, referencia_id)
  VALUES (p_usuario_id, p_puntos, p_motivo, p_referencia_id);

  UPDATE usuarios SET puntos_total = puntos_total + p_puntos
  WHERE id = p_usuario_id
  RETURNING puntos_total INTO v_nuevo_total;

  PERFORM verificar_badges(p_usuario_id);

  RETURN v_nuevo_total;
END;
$function$;
