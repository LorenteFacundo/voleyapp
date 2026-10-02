-- RPC: crear notificación (llamado desde triggers o funciones)
CREATE OR REPLACE FUNCTION public.crear_notificacion(
  p_usuario_id uuid, p_tipo varchar, p_titulo text, p_partido_id bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO notificaciones (usuario_id, tipo, titulo, partido_id)
  VALUES (p_usuario_id, p_tipo, p_titulo, p_partido_id);
END;
$function$;

-- RPC: marcar notificación como leída
CREATE OR REPLACE FUNCTION public.marcar_notificacion_leida(p_notificacion_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  UPDATE notificaciones SET leida = true
  WHERE id = p_notificacion_id AND usuario_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Notificación no encontrada'; END IF;
END;
$function$;

-- RPC: marcar todas como leídas
CREATE OR REPLACE FUNCTION public.marcar_todas_leidas()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  UPDATE notificaciones SET leida = true
  WHERE usuario_id = auth.uid() AND leida = false;
END;
$function$;

-- RPC: mis notificaciones (20 más recientes)
CREATE OR REPLACE FUNCTION public.mis_notificaciones()
RETURNS SETOF json
LANGUAGE sql SECURITY DEFINER
AS $function$
  SELECT json_build_object(
    'id', n.id,
    'tipo', n.tipo,
    'titulo', n.titulo,
    'partido_id', n.partido_id,
    'leida', n.leida,
    'created_at', n.created_at
  )
  FROM notificaciones n
  WHERE n.usuario_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT 20;
$function$;

-- RPC: buscar partido por token de invitación
CREATE OR REPLACE FUNCTION public.buscar_partido_por_token(p_token varchar)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER
AS $function$
  SELECT id FROM partidos WHERE token_invitacion = p_token AND estado_partido <> 'cancelado'
  LIMIT 1;
$function$;
