-- Paso faltante del historial: antes de 20260605183711 las vistas de partidos se
-- eliminaron a mano para poder reordenar sus columnas (CREATE OR REPLACE VIEW no
-- permite insertar organizador_id en la segunda posición).
--
-- En el proyecto productivo ya está aplicado; registrarlo con
--   supabase migration repair --status applied 20260605183700
-- La guarda lo vuelve inocuo: solo actúa si la vista conserva el formato previo.
do $reconstruccion$
begin
  if to_regclass('public.partidos_publicos') is not null and not exists (
    select 1 from pg_attribute
    where attrelid = 'public.partidos_publicos'::regclass
      and attnum = 2 and attname = 'organizador_id'
  ) then
    drop view if exists public.partido_detalle;
    drop view public.partidos_publicos;
  end if;
end
$reconstruccion$;
