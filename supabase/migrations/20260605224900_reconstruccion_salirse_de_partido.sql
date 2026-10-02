-- Paso faltante del historial: salirse_de_partido pasó de devolver void a text,
-- y para eso la función anterior se eliminó a mano antes de 20260605224947.
--
-- En el proyecto productivo ya está aplicado; registrarlo con
--   supabase migration repair --status applied 20260605224900
-- La guarda lo vuelve inocuo: solo actúa si la función todavía devuelve void.
do $reconstruccion$
begin
  if exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.salirse_de_partido(bigint)')
      and prorettype = 'void'::regtype
  ) then
    drop function public.salirse_de_partido(bigint);
  end if;
end
$reconstruccion$;
