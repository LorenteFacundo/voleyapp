-- Recrear partidos_publicos con organizador_id
CREATE OR REPLACE VIEW public.partidos_publicos AS
 SELECT p.id,
    p.organizador_id,
    p.visibilidad,
    p.estado_partido,
    p.cupo_minimo,
    p.cupo_maximo,
    p.cantidad_invitados_anonimos,
    p.nivel_requerido,
    p.requiere_aprobacion,
    p.expira_pre_reserva_at,
    p.token_invitacion,
    r.id AS reserva_id,
    r.expira_at AS reserva_expira_at,
    t.id AS turno_id,
    t.fecha,
    t.hora_inicio,
    t.hora_fin,
    c.id AS cancha_id,
    c.nombre_identificador AS cancha_nombre,
    c.precio_total,
    c.precio_sena,
    cl.id AS club_id,
    cl.nombre AS club_nombre,
    cl.direccion,
        CASE
            WHEN (cl.ubicacion IS NULL) THEN NULL::double precision
            ELSE st_y((cl.ubicacion)::geometry)
        END AS latitud,
        CASE
            WHEN (cl.ubicacion IS NULL) THEN NULL::double precision
            ELSE st_x((cl.ubicacion)::geometry)
        END AS longitud,
    (COALESCE(( SELECT (count(*))::integer AS count
           FROM participantes_partido pp
          WHERE ((pp.partido_id = p.id) AND ((pp.estado_inscripcion)::text = ANY (ARRAY['confirmado'::text, 'pendiente_pago'::text, 'pendiente_aprobacion'::text])))), 0) + COALESCE(p.cantidad_invitados_anonimos, 0)) AS jugadores_confirmados,
    ( SELECT pp.estado_inscripcion
           FROM participantes_partido pp
          WHERE ((pp.partido_id = p.id) AND (pp.usuario_id = auth.uid()))
         LIMIT 1) AS mi_estado_inscripcion
   FROM ((((partidos p
     JOIN reservas r ON ((r.id = p.reserva_id)))
     JOIN disponibilidad_turnos t ON ((t.id = r.turno_id)))
     JOIN canchas c ON ((c.id = t.cancha_id)))
     JOIN clubes cl ON ((cl.id = c.club_id)))
  WHERE (((p.visibilidad)::text = ANY (ARRAY['publico'::text, 'enlace'::text])) AND ((p.estado_partido)::text <> 'cancelado'::text));

-- Recrear partido_detalle (dependía de partidos_publicos por CASCADE)
CREATE OR REPLACE VIEW public.partido_detalle AS
 SELECT p.id,
    p.visibilidad,
    p.estado_partido,
    p.cupo_minimo,
    p.cupo_maximo,
    p.cantidad_invitados_anonimos,
    p.nivel_requerido,
    p.requiere_aprobacion,
    p.expira_pre_reserva_at,
    p.token_invitacion,
    p.organizador_id,
    r.id AS reserva_id,
    r.expira_at AS reserva_expira_at,
    t.id AS turno_id,
    t.fecha,
    t.hora_inicio,
    t.hora_fin,
    c.id AS cancha_id,
    c.nombre_identificador AS cancha_nombre,
    c.precio_total,
    c.precio_sena,
    cl.id AS club_id,
    cl.nombre AS club_nombre,
    cl.direccion,
        CASE
            WHEN (cl.ubicacion IS NULL) THEN NULL::double precision
            ELSE st_y((cl.ubicacion)::geometry)
        END AS latitud,
        CASE
            WHEN (cl.ubicacion IS NULL) THEN NULL::double precision
            ELSE st_x((cl.ubicacion)::geometry)
        END AS longitud,
    (COALESCE(( SELECT (count(*))::integer AS count
           FROM participantes_partido pp
          WHERE ((pp.partido_id = p.id) AND ((pp.estado_inscripcion)::text = ANY (ARRAY['confirmado'::text, 'pendiente_pago'::text, 'pendiente_aprobacion'::text])))), 0) + COALESCE(p.cantidad_invitados_anonimos, 0)) AS jugadores_confirmados,
    ( SELECT json_agg(json_build_object('usuario_id', pp.usuario_id, 'nombre', u.nombre_completo, 'estado_inscripcion', pp.estado_inscripcion, 'created_at', pp.created_at)) AS json_agg
           FROM (participantes_partido pp
             LEFT JOIN usuarios u ON ((u.id = pp.usuario_id)))
          WHERE ((pp.partido_id = p.id) AND ((pp.estado_inscripcion)::text = ANY (ARRAY['confirmado'::text, 'pendiente_pago'::text, 'pendiente_aprobacion'::text])))) AS participantes,
    ( SELECT pp.estado_inscripcion
           FROM participantes_partido pp
          WHERE ((pp.partido_id = p.id) AND (pp.usuario_id = auth.uid()))
         LIMIT 1) AS mi_estado_inscripcion
   FROM ((((partidos p
     JOIN reservas r ON ((r.id = p.reserva_id)))
     JOIN disponibilidad_turnos t ON ((t.id = r.turno_id)))
     JOIN canchas c ON ((c.id = t.cancha_id)))
     JOIN clubes cl ON ((cl.id = c.club_id)))
  WHERE (((p.visibilidad)::text = ANY (ARRAY['publico'::text, 'enlace'::text])) AND ((p.estado_partido)::text <> 'cancelado'::text));

-- Asegurar que las vistas usan security_invoker
ALTER VIEW public.partidos_publicos SET (security_invoker = true);
ALTER VIEW public.partido_detalle SET (security_invoker = true);
