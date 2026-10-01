-- Names and play level remain public for rosters; account email stays private.
revoke select on public.usuarios from public, anon, authenticated;
grant select (id, nombre_completo, nivel_voley, rol, puntos_total, partidos_jugados, created_at)
  on public.usuarios to anon, authenticated;

