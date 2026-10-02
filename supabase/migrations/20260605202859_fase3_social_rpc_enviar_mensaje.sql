CREATE OR REPLACE FUNCTION public.enviar_mensaje(p_partido_id bigint, p_texto text)
RETURNS mensajes_partido
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_mensaje mensajes_partido%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF char_length(trim(p_texto)) = 0 THEN RAISE EXCEPTION 'El mensaje no puede estar vacío'; END IF;
  IF char_length(p_texto) > 500 THEN RAISE EXCEPTION 'El mensaje no puede superar 500 caracteres'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM participantes_partido
    WHERE partido_id = p_partido_id AND usuario_id = auth.uid() AND estado_inscripcion = 'confirmado'
  ) THEN
    RAISE EXCEPTION 'Solo participantes confirmados pueden escribir mensajes';
  END IF;

  INSERT INTO mensajes_partido (partido_id, usuario_id, texto)
  VALUES (p_partido_id, auth.uid(), trim(p_texto))
  RETURNING * INTO v_mensaje;

  RETURN v_mensaje;
END;
$function$;
