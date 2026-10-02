CREATE OR REPLACE VIEW public.clubes_mapa
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.nombre,
  c.direccion,
  COALESCE(NULLIF(TRIM(split_part(c.direccion, ',', 2)), ''), 'Sin zona') AS neighborhood,
  ST_Y(c.ubicacion::geometry) AS latitude,
  ST_X(c.ubicacion::geometry) AS longitude,
  (
    SELECT COUNT(*)::integer
    FROM public.canchas ch
    WHERE ch.club_id = c.id
  ) AS courts,
  (
    SELECT COUNT(*)::integer
    FROM public.disponibilidad_turnos dt
    JOIN public.canchas ch ON ch.id = dt.cancha_id
    WHERE ch.club_id = c.id
      AND dt.estado = 'disponible'
      AND dt.fecha >= CURRENT_DATE
  ) AS available_slots
FROM public.clubes c
WHERE c.ubicacion IS NOT NULL;

GRANT SELECT ON public.clubes_mapa TO anon, authenticated;
