-- PENDING ONLY: not applied to Supabase production; kept outside migrations to prevent accidental deployment.
-- Requires an isolated, reviewed rollout with a verified backup and frontend flag validation.
-- Pilot club agenda. Adds isolated agenda state; existing reservations remain intact.
create table if not exists public.administradores_club (
  club_id bigint not null references public.clubes(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  primary key (club_id, usuario_id)
);
alter table public.administradores_club enable row level security;
revoke all on public.administradores_club from public, anon, authenticated;
grant select on public.administradores_club to authenticated;
create policy "Gestores ven sus clubes" on public.administradores_club
  for select to authenticated using (usuario_id=auth.uid() or (select private.is_admin_global()));

create or replace function private.pilot_gestiona_club(p_club_id bigint) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    private.is_admin_global() or exists (
      select 1 from public.administradores_club a
      where a.club_id=p_club_id and a.usuario_id=auth.uid()
    )
  );
$$;
revoke all on function private.pilot_gestiona_club(bigint) from public, anon, authenticated;
grant execute on function private.pilot_gestiona_club(bigint) to authenticated;

create table if not exists public.solicitudes_reserva (
  id bigint generated always as identity primary key,
  cancha_id bigint not null references public.canchas(id),
  usuario_id uuid references public.usuarios(id),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  origen text not null check (origen in ('app','manual')),
  contacto text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','confirmada','rechazada','vencida','cancelada','cancelacion_pendiente')),
  estado_pago text not null default 'pendiente'
    check (estado_pago in ('pendiente','sena','pagado','devolucion_pendiente','devuelto')),
  precio_informado numeric(12,2) not null default 0 check (precio_informado>=0),
  sena_informada numeric(12,2) not null default 0 check (sena_informada>=0),
  expira_at timestamptz,
  turno_id bigint unique references public.disponibilidad_turnos(id),
  reserva_id bigint unique references public.reservas(id),
  partido_config jsonb,
  created_at timestamptz not null default now(),
  check (hora_inicio<hora_fin),
  check (origen='manual' or usuario_id is not null)
);
create index if not exists solicitudes_agenda on public.solicitudes_reserva(cancha_id,fecha,estado);
alter table public.solicitudes_reserva enable row level security;
revoke all on public.solicitudes_reserva from public, anon, authenticated;
grant select on public.solicitudes_reserva to authenticated;
create policy "Solicitudes propias o del club" on public.solicitudes_reserva
  for select to authenticated using (
    usuario_id=auth.uid() or private.pilot_gestiona_club(
      (select club_id from public.canchas where id=cancha_id)
    )
  );

create table if not exists public.reservas_fijas (
  id bigint generated always as identity primary key,
  cancha_id bigint not null references public.canchas(id),
  responsable text not null check (length(btrim(responsable)) between 2 and 120),
  contacto text,
  dia_semana int not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null,
  desde date not null,
  hasta date not null,
  created_at timestamptz not null default now(),
  check (hora_inicio<hora_fin),
  check (hasta>=desde and hasta<=desde+366)
);
create table if not exists public.reservas_fijas_excepciones (
  reserva_fija_id bigint not null references public.reservas_fijas(id) on delete cascade,
  fecha date not null,
  primary key (reserva_fija_id,fecha)
);
alter table public.reservas_fijas enable row level security;
alter table public.reservas_fijas_excepciones enable row level security;
revoke all on public.reservas_fijas, public.reservas_fijas_excepciones from public, anon, authenticated;

create or replace function private.pilot_hay_fija(p_cancha_id bigint, p_fecha date,
  p_inicio time, p_fin time) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.reservas_fijas f
    where f.cancha_id=p_cancha_id and p_fecha between f.desde and f.hasta
      and f.dia_semana=extract(dow from p_fecha)::int
      and f.hora_inicio<p_fin and p_inicio<f.hora_fin
      and not exists (select 1 from public.reservas_fijas_excepciones e
        where e.reserva_fija_id=f.id and e.fecha=p_fecha)
  );
$$;
revoke all on function private.pilot_hay_fija(bigint,date,time,time) from public, anon, authenticated;

create or replace function private.pilot_validar_horario() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.estado <> 'disponible' then
    perform pg_advisory_xact_lock(new.cancha_id::int, 0);
    if private.pilot_hay_fija(new.cancha_id,new.fecha,new.hora_inicio,new.hora_fin) then
      raise exception 'Existe un alquiler fijo para ese horario';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists pilot_validar_horario on public.disponibilidad_turnos;
create trigger pilot_validar_horario before insert or update on public.disponibilidad_turnos
  for each row execute function private.pilot_validar_horario();
revoke all on function private.pilot_validar_horario() from public, anon, authenticated;

create or replace function public.pilot_solicitar_reserva(p_cancha_id bigint,p_fecha date,
  p_hora_inicio time,p_hora_fin time) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id bigint;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_inicio_turno timestamptz;
  v_precio numeric(12,2);
  v_sena numeric(12,2);
begin
  perform private.pilot_assert_new_booking_allowed();
  if auth.uid() is null then raise exception 'Iniciá sesión para solicitar un horario'; end if;
  v_inicio_turno := (p_fecha + p_hora_inicio) at time zone 'America/Argentina/Buenos_Aires';
  if p_fecha<v_hoy or p_fecha>v_hoy+35 or p_hora_inicio>=p_hora_fin or v_inicio_turno<=now() then
    raise exception 'Fecha u horario inválido'; end if;
  select h.precio_total,h.precio_sena into v_precio,v_sena
    from public.horarios_semanales h
    where h.cancha_id=p_cancha_id and h.activo
      and h.dia_semana=extract(dow from p_fecha)::int
      and h.hora_inicio=p_hora_inicio and h.hora_fin=p_hora_fin;
  if not found then raise exception 'Elegí uno de los horarios y precios publicados por la cancha'; end if;
  perform pg_catalog.pg_advisory_xact_lock(p_cancha_id::int,0);
  if private.pilot_hay_fija(p_cancha_id,p_fecha,p_hora_inicio,p_hora_fin) or exists (
    select 1 from public.disponibilidad_turnos t where t.cancha_id=p_cancha_id
      and t.fecha=p_fecha and t.estado<>'disponible'
      and t.hora_inicio<p_hora_fin and p_hora_inicio<t.hora_fin
  ) then raise exception 'Ese horario ya está ocupado'; end if;
  insert into public.solicitudes_reserva(cancha_id,usuario_id,fecha,hora_inicio,hora_fin,
    origen,expira_at,precio_informado,sena_informada)
  values(p_cancha_id,auth.uid(),p_fecha,p_hora_inicio,p_hora_fin,'app',
    least(now()+interval '24 hours',v_inicio_turno),v_precio,v_sena)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.pilot_solicitar_reserva(bigint,date,time,time) from public,anon;
grant execute on function public.pilot_solicitar_reserva(bigint,date,time,time) to authenticated;

create or replace function public.pilot_solicitar_partido(p_cancha_id bigint,p_fecha date,
  p_hora_inicio time,p_hora_fin time,p_cupo_minimo int,p_cupo_maximo int,
  p_invitados int,p_nivel text,p_requiere_aprobacion boolean) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  if p_cupo_minimo<2 or p_cupo_maximo<p_cupo_minimo or p_cupo_maximo>22 or
     p_invitados<0 or p_invitados>=p_cupo_maximo or
     p_nivel not in ('recreativo','intermedio','competitivo') then
    raise exception 'Datos de partido inválidos'; end if;
  v_id := public.pilot_solicitar_reserva(p_cancha_id,p_fecha,p_hora_inicio,p_hora_fin);
  update public.solicitudes_reserva set partido_config=jsonb_build_object(
    'cupo_minimo',p_cupo_minimo,'cupo_maximo',p_cupo_maximo,'invitados',p_invitados,
    'nivel',p_nivel,'requiere_aprobacion',p_requiere_aprobacion) where id=v_id;
  return v_id;
end $$;
revoke all on function public.pilot_solicitar_partido(bigint,date,time,time,int,int,int,text,boolean) from public,anon;
grant execute on function public.pilot_solicitar_partido(bigint,date,time,time,int,int,int,text,boolean) to authenticated;

create or replace function public.pilot_resolver_solicitud(p_id bigint,p_confirmar boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.solicitudes_reserva%rowtype; v_club bigint; v_cancha bigint;
        v_turno bigint; v_reserva bigint;
begin
  -- Lock by court before locking a request, avoiding deadlocks between two
  -- confirmations that otherwise hold each other's pending request row.
  select cancha_id into v_cancha from public.solicitudes_reserva where id=p_id;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  perform pg_catalog.pg_advisory_xact_lock(v_cancha::int,0);
  select * into s from public.solicitudes_reserva where id=p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  select club_id into v_club from public.canchas where id=s.cancha_id;
  if not private.pilot_gestiona_club(v_club) then raise exception 'No autorizado'; end if;
  if s.estado<>'pendiente' then raise exception 'La solicitud ya fue resuelta'; end if;
  if s.expira_at is not null and s.expira_at<=now() then
    update public.solicitudes_reserva set estado='vencida' where id=p_id;
    return;
  end if;
  if not p_confirmar then
    update public.solicitudes_reserva set estado='rechazada' where id=p_id;
    return;
  end if;
  if private.pilot_hay_fija(s.cancha_id,s.fecha,s.hora_inicio,s.hora_fin) or exists (
    select 1 from public.disponibilidad_turnos t where t.cancha_id=s.cancha_id
      and t.fecha=s.fecha and t.estado<>'disponible'
      and t.hora_inicio<s.hora_fin and s.hora_inicio<t.hora_fin
  ) then raise exception 'El horario fue ocupado por otra reserva'; end if;
  insert into public.disponibilidad_turnos(cancha_id,fecha,hora_inicio,hora_fin,estado)
    values(s.cancha_id,s.fecha,s.hora_inicio,s.hora_fin,'reservado') returning id into v_turno;
  if s.usuario_id is not null then
    insert into public.reservas(turno_id,usuario_id,estado_pago)
      values(v_turno,s.usuario_id,'pendiente') returning id into v_reserva;
  end if;
  if s.partido_config is not null then
    declare v_partido bigint;
    begin
      insert into public.partidos(reserva_id,organizador_id,cupo_minimo,cupo_maximo,
        cantidad_invitados_anonimos,visibilidad,estado_partido,token_invitacion,
        nivel_requerido,requiere_aprobacion)
      values(v_reserva,s.usuario_id,(s.partido_config->>'cupo_minimo')::int,
        (s.partido_config->>'cupo_maximo')::int,(s.partido_config->>'invitados')::int,
        'publico','confirmado',encode(extensions.gen_random_bytes(12),'hex'),
        s.partido_config->>'nivel',(s.partido_config->>'requiere_aprobacion')::boolean)
      returning id into v_partido;
      insert into public.participantes_partido(partido_id,usuario_id,estado_inscripcion)
        values(v_partido,s.usuario_id,'confirmado');
    end;
  end if;
  update public.solicitudes_reserva set estado='confirmada',turno_id=v_turno,
    reserva_id=v_reserva where id=p_id;
  update public.solicitudes_reserva other set estado='rechazada'
    where other.id<>p_id and other.cancha_id=s.cancha_id and other.fecha=s.fecha
      and other.estado='pendiente' and other.hora_inicio<s.hora_fin
      and s.hora_inicio<other.hora_fin;
end $$;
revoke all on function public.pilot_resolver_solicitud(bigint,boolean) from public,anon;
grant execute on function public.pilot_resolver_solicitud(bigint,boolean) to authenticated;

create or replace function public.pilot_mis_clubes() returns setof json
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  return query select json_build_object('id',c.id,'nombre',c.nombre)
    from public.clubes c where private.pilot_gestiona_club(c.id) order by c.nombre;
end $$;
revoke all on function public.pilot_mis_clubes() from public,anon;
grant execute on function public.pilot_mis_clubes() to authenticated;

create or replace function public.pilot_agenda(p_club_id bigint,p_desde date,p_hasta date)
returns setof json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not private.pilot_gestiona_club(p_club_id) then raise exception 'No autorizado'; end if;
  if p_hasta<p_desde or p_hasta>p_desde+35 then raise exception 'Rango inválido'; end if;
  return query select json_build_object('id',s.id,'cancha_id',s.cancha_id,
    'cancha',ca.titulo,'fecha',s.fecha,'hora_inicio',s.hora_inicio,
    'hora_fin',s.hora_fin,'estado',case when s.estado='pendiente' and s.expira_at<=now()
      then 'vencida' else s.estado end,'estado_pago',s.estado_pago,
    'origen',s.origen,'contacto',coalesce(s.contacto,u.email),
    'responsable',coalesce(u.nombre_completo,s.contacto),
    'expira_at',s.expira_at)
  from public.solicitudes_reserva s join public.canchas ca on ca.id=s.cancha_id
  left join public.usuarios u on u.id=s.usuario_id
  where ca.club_id=p_club_id and s.fecha between p_desde and p_hasta
  order by s.fecha,s.hora_inicio;
  return query select json_build_object('id','f'||f.id,'fija_id',f.id,
    'cancha_id',f.cancha_id,'cancha',ca.titulo,'fecha',d.fecha,
    'hora_inicio',f.hora_inicio,'hora_fin',f.hora_fin,'estado','fija',
    'estado_pago','pendiente','origen','fija','contacto',f.contacto,
    'responsable',f.responsable,'dia_semana',f.dia_semana,'hasta',f.hasta)
  from public.reservas_fijas f join public.canchas ca on ca.id=f.cancha_id
  cross join lateral generate_series(greatest(f.desde,p_desde),least(f.hasta,p_hasta),interval '1 day') d(fecha)
  where ca.club_id=p_club_id and extract(dow from d.fecha)::int=f.dia_semana
    and not exists (select 1 from public.reservas_fijas_excepciones e
      where e.reserva_fija_id=f.id and e.fecha=d.fecha::date);
  return query select json_build_object('id','b'||t.id,'turno_id',t.id,
    'cancha_id',t.cancha_id,'cancha',ca.titulo,'fecha',t.fecha,
    'hora_inicio',t.hora_inicio,'hora_fin',t.hora_fin,'estado','bloqueado',
    'estado_pago','pendiente','origen','bloqueo','contacto',null,'responsable',null)
  from public.disponibilidad_turnos t join public.canchas ca on ca.id=t.cancha_id
  where ca.club_id=p_club_id and t.fecha between p_desde and p_hasta
    and t.estado='bloqueado_club';
  return query select json_build_object('id','l'||r.id,'cancha_id',ca.id,
    'cancha',ca.titulo,'fecha',t.fecha,'hora_inicio',t.hora_inicio,
    'hora_fin',t.hora_fin,'estado','confirmada','estado_pago',r.estado_pago,
    'origen','anterior','contacto',u.email,'responsable',u.nombre_completo)
  from public.reservas r join public.disponibilidad_turnos t on t.id=r.turno_id
  join public.canchas ca on ca.id=t.cancha_id
  left join public.usuarios u on u.id=r.usuario_id
  where ca.club_id=p_club_id and t.fecha between p_desde and p_hasta
    and not exists (select 1 from public.solicitudes_reserva s where s.reserva_id=r.id);
end $$;
revoke all on function public.pilot_agenda(bigint,date,date) from public,anon;
grant execute on function public.pilot_agenda(bigint,date,date) to authenticated;

create or replace function public.pilot_crear_manual(p_cancha_id bigint,p_fecha date,
  p_inicio time,p_fin time,p_contacto text) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club bigint; v_turno bigint; v_id bigint; v_precio numeric(12,2); v_sena numeric(12,2);
        v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select club_id into v_club from public.canchas where id=p_cancha_id;
  if not private.pilot_gestiona_club(v_club) then raise exception 'No autorizado'; end if;
  if p_inicio>=p_fin or p_fecha<v_hoy or p_fecha>v_hoy+35 or length(btrim(p_contacto))<2 then
    raise exception 'Datos inválidos'; end if;
  select h.precio_total,h.precio_sena into v_precio,v_sena
    from public.horarios_semanales h where h.cancha_id=p_cancha_id and h.activo
      and h.dia_semana=extract(dow from p_fecha)::int
      and h.hora_inicio=p_inicio and h.hora_fin=p_fin;
  if not found then raise exception 'Elegí un bloque horario publicado por la cancha'; end if;
  perform pg_advisory_xact_lock(p_cancha_id::int,0);
  if private.pilot_hay_fija(p_cancha_id,p_fecha,p_inicio,p_fin) or exists (
    select 1 from public.disponibilidad_turnos t where t.cancha_id=p_cancha_id
      and t.fecha=p_fecha and t.estado<>'disponible'
      and t.hora_inicio<p_fin and p_inicio<t.hora_fin
  ) or exists (
    select 1 from public.solicitudes_reserva s where s.cancha_id=p_cancha_id
      and s.fecha=p_fecha and s.estado='pendiente'
      and (s.expira_at is null or s.expira_at>now())
      and s.hora_inicio<p_fin and p_inicio<s.hora_fin
  ) then raise exception 'Horario ocupado'; end if;
  insert into public.disponibilidad_turnos(cancha_id,fecha,hora_inicio,hora_fin,estado)
    values(p_cancha_id,p_fecha,p_inicio,p_fin,'reservado') returning id into v_turno;
  insert into public.solicitudes_reserva(cancha_id,fecha,hora_inicio,hora_fin,origen,
    contacto,estado,turno_id,precio_informado,sena_informada)
    values(p_cancha_id,p_fecha,p_inicio,p_fin,'manual',btrim(p_contacto),
      'confirmada',v_turno,v_precio,v_sena) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.pilot_crear_manual(bigint,date,time,time,text) from public,anon;
grant execute on function public.pilot_crear_manual(bigint,date,time,time,text) to authenticated;

create or replace function public.pilot_crear_fija(p_cancha_id bigint,p_responsable text,
  p_contacto text,p_dia int,p_inicio time,p_fin time,p_desde date,p_hasta date)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club bigint; v_id bigint;
        v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select club_id into v_club from public.canchas where id=p_cancha_id;
  if not private.pilot_gestiona_club(v_club) then raise exception 'No autorizado'; end if;
  if p_desde<v_hoy or p_hasta<p_desde or p_hasta>p_desde+366 or
     p_dia not between 0 and 6 or p_inicio>=p_fin then raise exception 'Datos inválidos'; end if;
  perform pg_advisory_xact_lock(p_cancha_id::int,0);
  if exists (select 1 from public.reservas_fijas f where f.cancha_id=p_cancha_id
    and f.dia_semana=p_dia and f.desde<=p_hasta and p_desde<=f.hasta
    and f.hora_inicio<p_fin and p_inicio<f.hora_fin) then
    raise exception 'Se superpone con otro alquiler fijo'; end if;
  if exists (select 1 from public.disponibilidad_turnos t where t.cancha_id=p_cancha_id
    and t.fecha between p_desde and p_hasta and extract(dow from t.fecha)::int=p_dia
    and t.estado<>'disponible' and t.hora_inicio<p_fin and p_inicio<t.hora_fin) then
    raise exception 'Ya hay reservas en la serie de fechas'; end if;
  if exists (select 1 from public.solicitudes_reserva s where s.cancha_id=p_cancha_id
    and s.fecha between p_desde and p_hasta and extract(dow from s.fecha)::int=p_dia
    and s.estado='pendiente' and (s.expira_at is null or s.expira_at>now())
    and s.hora_inicio<p_fin and p_inicio<s.hora_fin) then
    raise exception 'Hay solicitudes pendientes en las fechas de la serie'; end if;
  insert into public.reservas_fijas(cancha_id,responsable,contacto,dia_semana,
    hora_inicio,hora_fin,desde,hasta) values(p_cancha_id,btrim(p_responsable),
    nullif(btrim(p_contacto),''),p_dia,p_inicio,p_fin,p_desde,p_hasta) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.pilot_crear_fija(bigint,text,text,int,time,time,date,date) from public,anon;
grant execute on function public.pilot_crear_fija(bigint,text,text,int,time,time,date,date) to authenticated;

create or replace function public.pilot_excluir_fecha_fija(p_id bigint,p_fecha date)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.reservas_fijas%rowtype; v_club bigint;
begin
  select * into f from public.reservas_fijas where id=p_id;
  if not found then raise exception 'Alquiler fijo no encontrado'; end if;
  select club_id into v_club from public.canchas where id=f.cancha_id;
  if not private.pilot_gestiona_club(v_club) then raise exception 'No autorizado'; end if;
  if p_fecha not between f.desde and f.hasta or extract(dow from p_fecha)::int<>f.dia_semana
    then raise exception 'Fecha fuera de la serie'; end if;
  perform pg_catalog.pg_advisory_xact_lock(f.cancha_id::int,0);
  insert into public.reservas_fijas_excepciones(reserva_fija_id,fecha)
    values(p_id,p_fecha) on conflict do nothing;
end $$;
revoke all on function public.pilot_excluir_fecha_fija(bigint,date) from public,anon;
grant execute on function public.pilot_excluir_fecha_fija(bigint,date) to authenticated;

-- Split a recurring booking at an effective date without rewriting its history.
create or replace function public.pilot_reprogramar_fija(p_id bigint,p_desde_cambio date,
  p_dia int,p_inicio time,p_fin time) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare f public.reservas_fijas%rowtype; v_club bigint; v_nueva bigint;
        v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select * into f from public.reservas_fijas where id=p_id for update;
  if not found then raise exception 'Alquiler fijo no encontrado'; end if;
  select club_id into v_club from public.canchas where id=f.cancha_id;
  if not private.pilot_gestiona_club(v_club) then raise exception 'No autorizado'; end if;
  if p_desde_cambio<v_hoy or p_desde_cambio<f.desde or p_desde_cambio>f.hasta or
     p_dia not between 0 and 6 or p_inicio>=p_fin then raise exception 'Datos inválidos'; end if;
  perform pg_advisory_xact_lock(f.cancha_id::int,0);
  if exists (select 1 from public.reservas_fijas other where other.id<>p_id
    and other.cancha_id=f.cancha_id and other.dia_semana=p_dia
    and other.desde<=f.hasta and p_desde_cambio<=other.hasta
    and other.hora_inicio<p_fin and p_inicio<other.hora_fin) then
    raise exception 'Se superpone con otro alquiler fijo'; end if;
  if exists (select 1 from public.disponibilidad_turnos t where t.cancha_id=f.cancha_id
    and t.fecha between p_desde_cambio and f.hasta
    and extract(dow from t.fecha)::int=p_dia and t.estado<>'disponible'
    and t.hora_inicio<p_fin and p_inicio<t.hora_fin) then
    raise exception 'Ya hay reservas en las fechas futuras'; end if;
  if exists (select 1 from public.solicitudes_reserva s where s.cancha_id=f.cancha_id
    and s.fecha between p_desde_cambio and f.hasta
    and extract(dow from s.fecha)::int=p_dia and s.estado='pendiente'
    and (s.expira_at is null or s.expira_at>now())
    and s.hora_inicio<p_fin and p_inicio<s.hora_fin) then
    raise exception 'Hay solicitudes pendientes en las fechas futuras'; end if;
  if p_desde_cambio=f.desde then
    update public.reservas_fijas set dia_semana=p_dia,hora_inicio=p_inicio,hora_fin=p_fin
      where id=p_id;
    return p_id;
  end if;
  update public.reservas_fijas set hasta=p_desde_cambio-1 where id=p_id;
  insert into public.reservas_fijas(cancha_id,responsable,contacto,dia_semana,
    hora_inicio,hora_fin,desde,hasta)
  values(f.cancha_id,f.responsable,f.contacto,p_dia,p_inicio,p_fin,p_desde_cambio,f.hasta)
  returning id into v_nueva;
  insert into public.reservas_fijas_excepciones(reserva_fija_id,fecha)
    select v_nueva,e.fecha from public.reservas_fijas_excepciones e
    where e.reserva_fija_id=p_id and e.fecha>=p_desde_cambio and e.fecha<=f.hasta
    on conflict do nothing;
  return v_nueva;
end $$;
revoke all on function public.pilot_reprogramar_fija(bigint,date,int,time,time) from public,anon;
grant execute on function public.pilot_reprogramar_fija(bigint,date,int,time,time) to authenticated;

create or replace function public.pilot_cancelar_confirmada(p_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.solicitudes_reserva%rowtype; v_club bigint;
begin
  select * into s from public.solicitudes_reserva where id=p_id for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  select club_id into v_club from public.canchas where id=s.cancha_id;
  if not private.pilot_gestiona_club(v_club) then raise exception 'No autorizado'; end if;
  if s.estado<>'confirmada' then raise exception 'La reserva no está confirmada'; end if;
  update public.solicitudes_reserva set estado='cancelada',
    estado_pago=case when estado_pago in ('sena','pagado')
      then 'devolucion_pendiente' else estado_pago end where id=p_id;
  if s.reserva_id is not null then
    update public.partidos set estado_partido='cancelado' where reserva_id=s.reserva_id;
  end if;
  update public.disponibilidad_turnos set estado='disponible' where id=s.turno_id;
end $$;
revoke all on function public.pilot_cancelar_confirmada(bigint) from public,anon;
grant execute on function public.pilot_cancelar_confirmada(bigint) to authenticated;

create or replace function public.pilot_actualizar_pago(p_id bigint,p_estado text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club bigint; v_estado text;
begin
  select s.estado,ca.club_id into v_estado,v_club from public.solicitudes_reserva s
    join public.canchas ca on ca.id=s.cancha_id where s.id=p_id;
  if not private.pilot_gestiona_club(v_club) then raise exception 'No autorizado'; end if;
  if v_estado<>'confirmada' then raise exception 'Solo se actualiza el pago de una reserva confirmada'; end if;
  if p_estado not in ('pendiente','sena','pagado') then raise exception 'Estado inválido'; end if;
  update public.solicitudes_reserva set estado_pago=p_estado
    where id=p_id and estado='confirmada';
  if not found then raise exception 'La reserva cambió mientras se actualizaba el pago'; end if;
  update public.reservas set estado_pago=case when p_estado='pendiente' then 'pendiente' else 'aprobado' end
  where id=(select reserva_id from public.solicitudes_reserva where id=p_id);
end $$;
revoke all on function public.pilot_actualizar_pago(bigint,text) from public,anon;
grant execute on function public.pilot_actualizar_pago(bigint,text) to authenticated;

-- Create a reversible block over one published slot; a pause on player bookings
-- must not prevent club staff from managing their calendar.
create or replace function public.pilot_bloquear_horario(p_cancha_id bigint,
  p_fecha date,p_inicio time,p_fin time) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_club_id bigint;
  v_turno public.disponibilidad_turnos%rowtype;
  v_turno_id bigint;
  v_hoy date := (pg_catalog.now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select c.club_id into v_club_id from public.canchas c where c.id=p_cancha_id;
  if not found then raise exception 'Cancha no encontrada'; end if;
  if not private.pilot_gestiona_club(v_club_id) then raise exception 'No autorizado'; end if;
  if p_fecha<v_hoy or p_fecha>v_hoy+35 or p_inicio>=p_fin then
    raise exception 'Fecha u horario inválido';
  end if;
  if not exists (select 1 from public.horarios_semanales h
      where h.cancha_id=p_cancha_id and h.activo
        and h.dia_semana=extract(dow from p_fecha)::int
        and h.hora_inicio=p_inicio and h.hora_fin=p_fin) then
    raise exception 'Elegí un bloque horario publicado por la cancha';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(p_cancha_id::int,0);
  if private.pilot_hay_fija(p_cancha_id,p_fecha,p_inicio,p_fin) then
    raise exception 'Ese horario pertenece a un alquiler fijo';
  end if;
  if exists (select 1 from public.disponibilidad_turnos t
      where t.cancha_id=p_cancha_id and t.fecha=p_fecha
        and t.estado in ('reservado','pre_reservado','bloqueado_club')
        and t.hora_inicio<p_fin and p_inicio<t.hora_fin) then
    raise exception 'El horario ya está reservado o bloqueado';
  end if;
  if exists (select 1 from public.solicitudes_reserva s
      where s.cancha_id=p_cancha_id and s.fecha=p_fecha and s.estado='pendiente'
        and (s.expira_at is null or s.expira_at>pg_catalog.now())
        and s.hora_inicio<p_fin and p_inicio<s.hora_fin) then
    raise exception 'Hay una solicitud pendiente para ese horario';
  end if;

  select t.* into v_turno from public.disponibilidad_turnos t
    where t.cancha_id=p_cancha_id and t.fecha=p_fecha
      and t.hora_inicio=p_inicio and t.hora_fin=p_fin
    for update;
  if found then
    if v_turno.estado<>'disponible' or exists (
      select 1 from public.reservas r where r.turno_id=v_turno.id
    ) then raise exception 'El horario ya no está disponible'; end if;
    update public.disponibilidad_turnos set estado='bloqueado_club' where id=v_turno.id;
    return v_turno.id;
  end if;

  insert into public.disponibilidad_turnos(cancha_id,fecha,hora_inicio,hora_fin,estado)
    values(p_cancha_id,p_fecha,p_inicio,p_fin,'bloqueado_club') returning id into v_turno_id;
  return v_turno_id;
end $$;
revoke all on function public.pilot_bloquear_horario(bigint,date,time,time) from public,anon;
grant execute on function public.pilot_bloquear_horario(bigint,date,time,time) to authenticated;

create or replace function public.pilot_reabrir_bloqueo(p_turno_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_turno public.disponibilidad_turnos%rowtype; v_club_id bigint;
begin
  select t.* into v_turno from public.disponibilidad_turnos t
    where t.id=p_turno_id for update;
  if not found then raise exception 'Bloqueo no encontrado'; end if;
  select c.club_id into v_club_id from public.canchas c where c.id=v_turno.cancha_id;
  if not private.pilot_gestiona_club(v_club_id) then raise exception 'No autorizado'; end if;
  if v_turno.estado<>'bloqueado_club' then raise exception 'El horario no está bloqueado'; end if;
  perform pg_catalog.pg_advisory_xact_lock(v_turno.cancha_id::int,0);
  if private.pilot_hay_fija(v_turno.cancha_id,v_turno.fecha,
      v_turno.hora_inicio,v_turno.hora_fin) then
    raise exception 'El horario pertenece a un alquiler fijo';
  end if;
  if exists (select 1 from public.disponibilidad_turnos t
      where t.id<>v_turno.id and t.cancha_id=v_turno.cancha_id
        and t.fecha=v_turno.fecha and t.estado in ('reservado','pre_reservado','bloqueado_club')
        and t.hora_inicio<v_turno.hora_fin and v_turno.hora_inicio<t.hora_fin) or
     exists (select 1 from public.reservas r where r.turno_id=v_turno.id) then
    raise exception 'Hay una reserva incompatible con la reapertura';
  end if;
  update public.disponibilidad_turnos set estado='disponible' where id=v_turno.id;
end $$;
revoke all on function public.pilot_reabrir_bloqueo(bigint) from public,anon;
grant execute on function public.pilot_reabrir_bloqueo(bigint) to authenticated;

create or replace function public.pilot_asignar_admin_club(p_club_id bigint,p_usuario_id uuid,
  p_asignar boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not private.is_admin_global() then raise exception 'No autorizado'; end if;
  if not exists (select 1 from public.clubes where id=p_club_id) or
     not exists (select 1 from public.usuarios where id=p_usuario_id) then
    raise exception 'Club o usuario no encontrado'; end if;
  if p_asignar then
    insert into public.administradores_club(club_id,usuario_id)
      values(p_club_id,p_usuario_id) on conflict do nothing;
    update public.usuarios set rol='admin_cancha' where id=p_usuario_id and rol='jugador';
  else
    delete from public.administradores_club
      where club_id=p_club_id and usuario_id=p_usuario_id;
    if not exists (select 1 from public.administradores_club where usuario_id=p_usuario_id) then
      update public.usuarios set rol='jugador' where id=p_usuario_id and rol='admin_cancha';
    end if;
  end if;
end $$;
revoke all on function public.pilot_asignar_admin_club(bigint,uuid,boolean) from public,anon;
grant execute on function public.pilot_asignar_admin_club(bigint,uuid,boolean) to authenticated;

-- Publish weekly availability while respecting concrete bookings and fixed rentals.
create or replace function public.obtener_turnos_disponibles(p_cancha_id int,
  p_desde date,p_hasta date) returns setof json
language plpgsql security definer set search_path = public, pg_temp as $$
declare d date; h public.horarios_semanales%rowtype; t record; v_estado text;
begin
  if p_desde<current_date-1 or p_hasta<p_desde or p_hasta>p_desde+35 then
    raise exception 'Rango de fechas inválido'; end if;
  d := p_desde;
  while d<=p_hasta loop
    for h in select * from public.horarios_semanales
      where cancha_id=p_cancha_id and dia_semana=extract(dow from d)::int and activo=true
      order by hora_inicio loop
      select id,estado into t from public.disponibilidad_turnos
        where cancha_id=p_cancha_id and fecha=d and estado<>'disponible'
          and hora_inicio<h.hora_fin and h.hora_inicio<hora_fin limit 1;
      v_estado := case when private.pilot_hay_fija(p_cancha_id,d,h.hora_inicio,h.hora_fin)
        then 'bloqueado_club' else coalesce(t.estado,'disponible') end;
      return query select json_build_object('id',case when v_estado='disponible' then null else t.id end,
        'cancha_id',p_cancha_id,'fecha',d,'hora_inicio',h.hora_inicio,
        'hora_fin',h.hora_fin,'estado',v_estado,'precio_total',h.precio_total,
        'precio_sena',h.precio_sena,'horario_semanal_id',h.id);
    end loop;
    d:=d+1;
  end loop;
end $$;

