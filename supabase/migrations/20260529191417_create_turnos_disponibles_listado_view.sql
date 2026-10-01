CREATE OR REPLACE VIEW public.turnos_disponibles_listado
WITH (security_invoker = true) AS
SELECT
  dt.id,
  dt.fecha,
  dt.hora_inicio,
  dt.hora_fin,
  dt.estado,
  ch.nombre_identificador AS cancha_nombre,
  ch.precio_total,
  ch.precio_sena,
  cl.id AS club_id,
  cl.nombre AS club_nombre,
  cl.direccion AS club_direccion
FROM public.disponibilidad_turnos dt
JOIN public.canchas ch ON ch.id = dt.cancha_id
JOIN public.clubes cl ON cl.id = ch.club_id
WHERE dt.estado::text = 'disponible'
  AND dt.fecha >= CURRENT_DATE
ORDER BY dt.fecha, dt.hora_inicio;

GRANT SELECT ON public.turnos_disponibles_listado TO anon, authenticated;
