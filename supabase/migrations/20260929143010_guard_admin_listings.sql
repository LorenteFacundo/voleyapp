-- Restrict legacy SECURITY DEFINER admin endpoints and guard every listing.
-- Existing admin mutations already enforce public.is_admin(); this migration
-- removes anonymous execution and closes unguarded read endpoints.
create or replace function public.admin_listar_clubes() returns setof json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not (select private.is_admin_global()) then raise exception 'No autorizado'; end if;
  return query select json_build_object('id', c.id, 'nombre', c.nombre, 'direccion', c.direccion,
    'telefono', c.telefono, 'latitud', ST_Y(c.ubicacion::geometry), 'longitud', ST_X(c.ubicacion::geometry),
    'created_at', c.created_at, 'canchas_count', (select count(*) from public.canchas where club_id=c.id))
  from public.clubes c order by c.nombre;
end $$;

create or replace function public.admin_listar_canchas() returns setof json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not (select private.is_admin_global()) then raise exception 'No autorizado'; end if;
  return query select json_build_object('id', ca.id, 'club_id', ca.club_id,
    'club_nombre', (select nombre from public.clubes where id=ca.club_id),
    'titulo', ca.titulo, 'nombre_identificador', ca.nombre_identificador,
    'descripcion', ca.descripcion, 'precio_total', ca.precio_total,
    'precio_sena', ca.precio_sena, 'fotos', ca.fotos,
    'turnos_count', (select count(*) from public.disponibilidad_turnos where cancha_id=ca.id))
  from public.canchas ca order by ca.titulo;
end $$;

create or replace function public.admin_listar_turnos(p_cancha_id int default null,
  p_fecha_desde text default null, p_fecha_hasta text default null) returns setof json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not (select private.is_admin_global()) then raise exception 'No autorizado'; end if;
  return query select json_build_object('id', t.id, 'cancha_id', t.cancha_id,
    'cancha_titulo', (select titulo from public.canchas where id=t.cancha_id),
    'club_nombre', (select cl.nombre from public.clubes cl join public.canchas ca on ca.club_id=cl.id where ca.id=t.cancha_id),
    'fecha', t.fecha, 'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin, 'estado', t.estado)
  from public.disponibilidad_turnos t
  where (p_cancha_id is null or t.cancha_id=p_cancha_id)
    and (p_fecha_desde is null or t.fecha>=p_fecha_desde::date)
    and (p_fecha_hasta is null or t.fecha<=p_fecha_hasta::date)
  order by t.fecha desc, t.hora_inicio;
end $$;

create or replace function public.admin_listar_turnos_cancha(p_cancha_id int) returns setof json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not (select private.is_admin_global()) then raise exception 'No autorizado'; end if;
  return query select json_build_object('id', t.id, 'cancha_id', t.cancha_id,
    'fecha', t.fecha, 'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin, 'estado', t.estado)
  from public.disponibilidad_turnos t where t.cancha_id=p_cancha_id
  order by t.fecha desc, t.hora_inicio;
end $$;

create or replace function public.admin_listar_reservas() returns setof json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not (select private.is_admin_global()) then raise exception 'No autorizado'; end if;
  return query select json_build_object('id', r.id, 'turno_id', r.turno_id, 'usuario_id', r.usuario_id,
    'usuario_nombre', (select nombre_completo from public.usuarios where id=r.usuario_id),
    'usuario_email', (select email from public.usuarios where id=r.usuario_id),
    'cancha_titulo', (select ca.titulo from public.canchas ca join public.disponibilidad_turnos t on t.cancha_id=ca.id where t.id=r.turno_id),
    'club_nombre', (select cl.nombre from public.clubes cl join public.canchas ca on ca.club_id=cl.id join public.disponibilidad_turnos t on t.cancha_id=ca.id where t.id=r.turno_id),
    'fecha', (select fecha from public.disponibilidad_turnos where id=r.turno_id),
    'hora_inicio', (select hora_inicio from public.disponibilidad_turnos where id=r.turno_id),
    'hora_fin', (select hora_fin from public.disponibilidad_turnos where id=r.turno_id),
    'monto_sena_pagado', r.monto_sena_pagado, 'estado_pago', r.estado_pago, 'created_at', r.created_at)
  from public.reservas r order by r.created_at desc;
end $$;

create or replace function public.admin_listar_partidos() returns setof json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not (select private.is_admin_global()) then raise exception 'No autorizado'; end if;
  return query select json_build_object('id', p.id, 'organizador_id', p.organizador_id,
    'organizador_nombre', (select nombre_completo from public.usuarios where id=p.organizador_id),
    'organizador_email', (select email from public.usuarios where id=p.organizador_id),
    'cancha_titulo', (select ca.titulo from public.canchas ca join public.disponibilidad_turnos t on t.cancha_id=ca.id join public.reservas r on r.turno_id=t.id where r.id=p.reserva_id),
    'club_nombre', (select cl.nombre from public.clubes cl join public.canchas ca on ca.club_id=cl.id join public.disponibilidad_turnos t on t.cancha_id=ca.id join public.reservas r on r.turno_id=t.id where r.id=p.reserva_id),
    'fecha', (select t.fecha from public.disponibilidad_turnos t join public.reservas r on r.turno_id=t.id where r.id=p.reserva_id),
    'hora_inicio', (select t.hora_inicio from public.disponibilidad_turnos t join public.reservas r on r.turno_id=t.id where r.id=p.reserva_id),
    'hora_fin', (select t.hora_fin from public.disponibilidad_turnos t join public.reservas r on r.turno_id=t.id where r.id=p.reserva_id),
    'nivel_requerido', p.nivel_requerido, 'estado_partido', p.estado_partido,
    'cupo_minimo', p.cupo_minimo, 'cupo_maximo', p.cupo_maximo,
    'jugadores_confirmados', (select count(*) from public.participantes_partido where partido_id=p.id and estado_inscripcion='confirmado'),
    'requiere_aprobacion', p.requiere_aprobacion)
  from public.partidos p order by p.id desc;
end $$;

create or replace function public.admin_listar_horarios_semanales(p_cancha_id int) returns setof json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not (select private.is_admin_global()) then raise exception 'No autorizado'; end if;
  return query select json_build_object('id', h.id, 'cancha_id', h.cancha_id, 'dia_semana', h.dia_semana,
    'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin, 'precio_total', h.precio_total,
    'precio_sena', h.precio_sena, 'activo', h.activo)
  from public.horarios_semanales h where h.cancha_id=p_cancha_id and h.activo=true
  order by h.dia_semana, h.hora_inicio;
end $$;

-- Admin mutations already check the global-admin helper; keep them callable only
-- by authenticated users (and service_role, whose explicit grants are preserved).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'admin_%'
  loop
    execute format('revoke execute on function %s from public, anon', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

