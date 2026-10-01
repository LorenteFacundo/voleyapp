-- PENDING ONLY: not applied to Supabase production; kept outside migrations to prevent accidental deployment.
-- Requires an isolated, reviewed rollout with a verified backup and frontend flag validation.
-- Public browsing exposes only public matches. Link-only matches are fetched
-- through the token-checking detail RPC below; invitation secrets stay private.
create or replace view public.partidos_publicos as
select p.id,p.organizador_id,p.visibilidad,p.estado_partido,p.cupo_minimo,p.cupo_maximo,
  p.cantidad_invitados_anonimos,p.nivel_requerido,p.requiere_aprobacion,p.expira_pre_reserva_at,
  case when p.organizador_id=auth.uid() then p.token_invitacion else null::varchar end as token_invitacion,
  r.id as reserva_id,r.expira_at as reserva_expira_at,t.id as turno_id,t.fecha,t.hora_inicio,t.hora_fin,
  c.id as cancha_id,c.nombre_identificador as cancha_nombre,c.precio_total,c.precio_sena,
  cl.id as club_id,cl.nombre as club_nombre,cl.direccion,
  case when cl.ubicacion is null then null::double precision else st_y(cl.ubicacion::geometry) end as latitud,
  case when cl.ubicacion is null then null::double precision else st_x(cl.ubicacion::geometry) end as longitud,
  coalesce((select count(*)::int from public.participantes_partido pp where pp.partido_id=p.id
    and pp.estado_inscripcion in ('confirmado','pendiente_pago','pendiente_aprobacion')),0)
    +coalesce(p.cantidad_invitados_anonimos,0) as jugadores_confirmados,
  (select pp.estado_inscripcion from public.participantes_partido pp
    where pp.partido_id=p.id and pp.usuario_id=auth.uid() limit 1) as mi_estado_inscripcion
from public.partidos p join public.reservas r on r.id=p.reserva_id
join public.disponibilidad_turnos t on t.id=r.turno_id
join public.canchas c on c.id=t.cancha_id join public.clubes cl on cl.id=c.club_id
where p.visibilidad='publico' and p.estado_partido<>'cancelado';

create or replace view public.partido_detalle as
select p.id,p.visibilidad,p.estado_partido,p.cupo_minimo,p.cupo_maximo,
  p.cantidad_invitados_anonimos,p.nivel_requerido,p.requiere_aprobacion,p.expira_pre_reserva_at,
  case when p.organizador_id=auth.uid() then p.token_invitacion else null::varchar end as token_invitacion,
  p.organizador_id,r.id as reserva_id,r.expira_at as reserva_expira_at,t.id as turno_id,
  t.fecha,t.hora_inicio,t.hora_fin,c.id as cancha_id,c.nombre_identificador as cancha_nombre,
  c.precio_total,c.precio_sena,cl.id as club_id,cl.nombre as club_nombre,cl.direccion,
  case when cl.ubicacion is null then null::double precision else st_y(cl.ubicacion::geometry) end as latitud,
  case when cl.ubicacion is null then null::double precision else st_x(cl.ubicacion::geometry) end as longitud,
  coalesce((select count(*)::int from public.participantes_partido pp where pp.partido_id=p.id
    and pp.estado_inscripcion in ('confirmado','pendiente_pago','pendiente_aprobacion')),0)
    +coalesce(p.cantidad_invitados_anonimos,0) as jugadores_confirmados,
  (select json_agg(json_build_object('usuario_id',case when p.organizador_id=auth.uid()
      or pp.usuario_id=auth.uid() then pp.usuario_id else null end,
      'nombre',u.nombre_completo,'estado_inscripcion',pp.estado_inscripcion,'created_at',pp.created_at))
   from public.participantes_partido pp left join public.usuarios u on u.id=pp.usuario_id
   where pp.partido_id=p.id and pp.estado_inscripcion in ('confirmado','pendiente_pago','pendiente_aprobacion')) as participantes,
  (select pp.estado_inscripcion from public.participantes_partido pp
    where pp.partido_id=p.id and pp.usuario_id=auth.uid() limit 1) as mi_estado_inscripcion
from public.partidos p join public.reservas r on r.id=p.reserva_id
join public.disponibilidad_turnos t on t.id=r.turno_id
join public.canchas c on c.id=t.cancha_id join public.clubes cl on cl.id=c.club_id
where p.estado_partido<>'cancelado' and (p.visibilidad='publico'
  or p.organizador_id=auth.uid() or exists (select 1 from public.participantes_partido pp
    where pp.partido_id=p.id and pp.usuario_id=auth.uid()));

create or replace view public.partidos_explorar as
select p.id,p.organizador_id,p.estado_partido,p.cupo_minimo,p.cupo_maximo,
  p.cantidad_invitados_anonimos,p.nivel_requerido,p.requiere_aprobacion,
  p.expira_pre_reserva_at,t.fecha,t.hora_inicio,t.hora_fin,
  c.nombre_identificador as cancha_nombre,c.precio_total,c.precio_sena,
  cl.nombre as club_nombre,cl.direccion,
  st_y(cl.ubicacion::geometry) as latitud,st_x(cl.ubicacion::geometry) as longitud,
  ((select count(*) from public.participantes_partido pp where pp.partido_id=p.id
    and pp.estado_inscripcion in ('confirmado','pendiente_pago','pendiente_aprobacion'))
    + p.cantidad_invitados_anonimos)::int as jugadores_confirmados,
  (select pp.estado_inscripcion from public.participantes_partido pp
    where pp.partido_id=p.id and pp.usuario_id=auth.uid() limit 1) as mi_estado_inscripcion
from public.partidos p join public.reservas r on r.id=p.reserva_id
join public.disponibilidad_turnos t on t.id=r.turno_id
join public.canchas c on c.id=t.cancha_id join public.clubes cl on cl.id=c.club_id
where p.visibilidad='publico' and p.estado_partido='confirmado';
revoke all on public.partidos_explorar from public,anon,authenticated;
grant select on public.partidos_explorar to anon,authenticated;

create or replace function public.pilot_partido_detalle(p_id bigint,p_token text default null) returns json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_partido public.partidos%rowtype;
begin
  select * into v_partido from public.partidos where id=p_id;
  if not found or v_partido.estado_partido='cancelado' or
    (v_partido.visibilidad='privado' and v_partido.organizador_id is distinct from auth.uid()) or
    (v_partido.visibilidad='enlace' and v_partido.organizador_id is distinct from auth.uid()
      and p_token is distinct from v_partido.token_invitacion
      and not exists (select 1 from public.participantes_partido pp
        where pp.partido_id=v_partido.id and pp.usuario_id=auth.uid()))
    then return null; end if;
  return (select json_build_object(
    'id',p.id,'organizador_id',p.organizador_id,'estado_partido',p.estado_partido,
    'cupo_minimo',p.cupo_minimo,'cupo_maximo',p.cupo_maximo,
    'cantidad_invitados_anonimos',p.cantidad_invitados_anonimos,
    'nivel_requerido',p.nivel_requerido,'requiere_aprobacion',p.requiere_aprobacion,
    'expira_pre_reserva_at',p.expira_pre_reserva_at,'fecha',t.fecha,
    'hora_inicio',t.hora_inicio,'hora_fin',t.hora_fin,
    'cancha_nombre',c.nombre_identificador,'precio_total',c.precio_total,
    'precio_sena',c.precio_sena,'club_nombre',cl.nombre,'direccion',cl.direccion,
    'latitud',st_y(cl.ubicacion::geometry),'longitud',st_x(cl.ubicacion::geometry),
    'reserva_id',case when p.organizador_id=auth.uid() then r.id else null end,
    'reserva_expira_at',case when p.organizador_id=auth.uid() then r.expira_at else null end,
    'turno_id',case when p.organizador_id=auth.uid() then t.id else null end,
    'cancha_id',c.id,'club_id',cl.id,
    'jugadores_confirmados',p.cantidad_invitados_anonimos+
      (select count(*) from public.participantes_partido pp where pp.partido_id=p.id
        and pp.estado_inscripcion in ('confirmado','pendiente_pago','pendiente_aprobacion')),
    'mi_estado_inscripcion',(select pp.estado_inscripcion from public.participantes_partido pp
      where pp.partido_id=p.id and pp.usuario_id=auth.uid() limit 1),
    'token_invitacion',case when p.organizador_id=auth.uid() then p.token_invitacion else null end,
    'participantes',(select coalesce(json_agg(json_build_object('usuario_id',case
      when p.organizador_id=auth.uid() or pp.usuario_id=auth.uid() then pp.usuario_id else null end,
      'nombre',u.nombre_completo,'estado_inscripcion',pp.estado_inscripcion,
      'created_at',pp.created_at)),'[]'::json)
      from public.participantes_partido pp left join public.usuarios u on u.id=pp.usuario_id
      where pp.partido_id=p.id and pp.estado_inscripcion<>'rechazado')
  ) from public.partidos p join public.reservas r on r.id=p.reserva_id
    join public.disponibilidad_turnos t on t.id=r.turno_id
    join public.canchas c on c.id=t.cancha_id join public.clubes cl on cl.id=c.club_id
  where p.id=p_id);
end $$;
revoke all on function public.pilot_partido_detalle(bigint,text) from public,anon,authenticated;
grant execute on function public.pilot_partido_detalle(bigint,text) to anon,authenticated;

-- Preserve the invite URL flow while requiring the invitation token on link-only joins.
create or replace function public.pilot_unirse_a_partido(p_partido_id bigint,p_token text default null)
returns public.participantes_partido
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_partido public.partidos%rowtype;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  perform private.pilot_assert_new_booking_allowed();
  select * into v_partido from public.partidos where id=p_partido_id for update;
  if not found then raise exception 'Partido no encontrado'; end if;
  if v_partido.visibilidad<>'publico' and v_partido.organizador_id is distinct from auth.uid()
    and p_token is distinct from v_partido.token_invitacion
    and not exists (select 1 from public.participantes_partido pp
      where pp.partido_id=p_partido_id and pp.usuario_id=auth.uid()) then
    raise exception 'Necesitás el enlace de invitación para entrar a este partido';
  end if;
  return public.unirse_a_partido(p_partido_id);
end $$;
revoke all on function public.pilot_unirse_a_partido(bigint,text) from public,anon,authenticated;
grant execute on function public.pilot_unirse_a_partido(bigint,text) to authenticated;
revoke all on function public.unirse_a_partido(bigint) from public,anon,authenticated;

create or replace function public.pilot_resolver_participante(p_partido_id bigint,
  p_usuario_id uuid,p_aprobar boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.partidos%rowtype;
begin
  select * into p from public.partidos where id=p_partido_id for update;
  if not found or p.organizador_id is distinct from auth.uid() then
    raise exception 'Solo el organizador puede resolver solicitudes'; end if;
  if p.estado_partido not in ('abierto','confirmado') then raise exception 'Partido cerrado'; end if;
  if not exists (select 1 from public.participantes_partido pp
    where pp.partido_id=p_partido_id and pp.usuario_id=p_usuario_id
      and pp.estado_inscripcion='pendiente_aprobacion') then
    raise exception 'Solicitud no encontrada'; end if;
  if p_aprobar and p.cantidad_invitados_anonimos +
    (select count(*) from public.participantes_partido pp where pp.partido_id=p_partido_id
      and pp.estado_inscripcion='confirmado') >= p.cupo_maximo then
    raise exception 'El partido está lleno'; end if;
  update public.participantes_partido set estado_inscripcion=
    case when p_aprobar then 'confirmado' else 'rechazado' end
    where partido_id=p_partido_id and usuario_id=p_usuario_id;
end $$;
revoke all on function public.pilot_resolver_participante(bigint,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.pilot_resolver_participante(bigint,uuid,boolean) to authenticated;

