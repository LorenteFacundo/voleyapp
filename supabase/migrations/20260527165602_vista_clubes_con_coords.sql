create or replace view public.clubes_publicos as
select
  cl.id,
  cl.nombre,
  cl.direccion,
  cl.telefono,
  case when cl.ubicacion is null then null::double precision else st_y(cl.ubicacion::geometry) end as latitud,
  case when cl.ubicacion is null then null::double precision else st_x(cl.ubicacion::geometry) end as longitud
from public.clubes cl;

grant select on public.clubes_publicos to anon, authenticated;
