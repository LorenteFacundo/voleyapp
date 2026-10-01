-- Vista ranking
CREATE OR REPLACE VIEW public.ranking_jugadores
WITH (security_invoker = true) AS
SELECT
  u.id,
  u.nombre_completo,
  u.nivel_voley,
  u.puntos_total,
  ROW_NUMBER() OVER (ORDER BY u.puntos_total DESC) AS posicion
FROM public.usuarios u
WHERE u.puntos_total > 0
ORDER BY u.puntos_total DESC
LIMIT 100;
