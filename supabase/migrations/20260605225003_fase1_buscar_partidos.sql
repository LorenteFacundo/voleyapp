CREATE OR REPLACE FUNCTION public.buscar_partidos(
  p_nivel text DEFAULT NULL,
  p_texto text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL,
  p_radio_km int DEFAULT NULL
)
RETURNS SETOF json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT json_build_object(
    'id', pp.id, 'organizador_id', pp.organizador_id,
    'estado_partido', pp.estado_partido, 'cupo_minimo', pp.cupo_minimo,
    'cupo_maximo', pp.cupo_maximo, 'cantidad_invitados_anonimos', pp.cantidad_invitados_anonimos,
    'nivel_requerido', pp.nivel_requerido, 'requiere_aprobacion', pp.requiere_aprobacion,
    'expira_pre_reserva_at', pp.expira_pre_reserva_at,
    'fecha', pp.fecha, 'hora_inicio', pp.hora_inicio, 'hora_fin', pp.hora_fin,
    'cancha_nombre', pp.cancha_nombre, 'precio_total', pp.precio_total,
    'precio_sena', pp.precio_sena, 'club_nombre', pp.club_nombre,
    'direccion', pp.direccion, 'latitud', pp.latitud, 'longitud', pp.longitud,
    'jugadores_confirmados', pp.jugadores_confirmados,
    'mi_estado_inscripcion', pp.mi_estado_inscripcion
  )
  FROM partidos_publicos pp
  JOIN clubes cl ON cl.nombre = pp.club_nombre
  WHERE
    (p_nivel IS NULL OR pp.nivel_requerido = p_nivel)
    AND (p_texto IS NULL OR (
      pp.club_nombre ILIKE '%' || p_texto || '%'
      OR pp.cancha_nombre ILIKE '%' || p_texto || '%'
      OR COALESCE(pp.direccion, '') ILIKE '%' || p_texto || '%'
    ))
    AND (p_radio_km IS NULL OR p_lat IS NULL OR p_lng IS NULL OR
      ST_DWithin(cl.ubicacion, ST_MakePoint(p_lng, p_lat)::geography, p_radio_km * 1000)
    )
  ORDER BY pp.fecha ASC, pp.hora_inicio ASC;
END;
$function$;
