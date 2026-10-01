-- PENDING ONLY: not applied to Supabase production; stored outside migrations
-- until an isolated review, backup/restore rehearsal, and rollback plan pass.
-- Pilot access controls. New booking RPCs must call
-- private.pilot_assert_new_booking_allowed() before creating new operations.
-- Existing reservations, cancellations, and club management stay available.

create table if not exists public.pilot_settings (
  singleton boolean primary key default true check (singleton),
  bookings_paused boolean not null default true,
  pause_reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.usuarios(id)
);

insert into public.pilot_settings(singleton, bookings_paused, pause_reason)
values (true, true, 'El piloto permanece pausado hasta completar la verificación')
on conflict (singleton) do nothing;

create table if not exists public.pilot_access_users (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  enabled_at timestamptz not null default now(),
  enabled_by uuid references public.usuarios(id)
);

-- Hashed client addresses are retained only for short-window abuse control;
-- raw addresses and contact details are never written to this table.
create table if not exists public.club_lead_rate_limits (
  address_hash text primary key check (address_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);

alter table public.pilot_settings enable row level security;
alter table public.pilot_access_users enable row level security;
alter table public.club_lead_rate_limits enable row level security;
revoke all on public.pilot_settings, public.pilot_access_users from public, anon, authenticated;
revoke all on public.club_lead_rate_limits from public, anon, authenticated;
grant select on public.pilot_access_users to authenticated;
create policy "Usuarios consultan su acceso al piloto"
  on public.pilot_access_users for select to authenticated
  using (usuario_id = (select auth.uid()) or (select private.is_admin_global()));

create or replace function public.pilot_registrar_intento_captacion(p_hash text)
returns boolean
language plpgsql volatile security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  delete from public.club_lead_rate_limits
  where window_started_at < now() - interval '24 hours';
  insert into public.club_lead_rate_limits(address_hash, window_started_at, request_count)
  values (p_hash, now(), 1)
  on conflict (address_hash) do update set
    request_count = case
      when public.club_lead_rate_limits.window_started_at <= now() - interval '1 hour' then 1
      else public.club_lead_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.club_lead_rate_limits.window_started_at <= now() - interval '1 hour' then now()
      else public.club_lead_rate_limits.window_started_at
    end
  returning request_count into v_count;
  return v_count <= 5;
end;
$$;
revoke all on function public.pilot_registrar_intento_captacion(text) from public, anon, authenticated;
grant execute on function public.pilot_registrar_intento_captacion(text) to service_role;

create or replace function private.pilot_usuario_habilitado()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
  select auth.uid() is not null and (
    private.is_admin_global()
    or exists (select 1 from public.pilot_access_users a where a.usuario_id = auth.uid())
  );
$$;
revoke all on function private.pilot_usuario_habilitado() from public, anon, authenticated;

create or replace function private.pilot_assert_new_booking_allowed()
returns void
language plpgsql volatile security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para continuar' using errcode = '42501';
  end if;
  if not private.pilot_usuario_habilitado() then
    raise exception 'Tu cuenta todavía no está habilitada para operar durante el piloto'
      using errcode = '42501';
  end if;
  if not exists (select 1 from public.pilot_settings where singleton and not bookings_paused) then
    raise exception 'Las nuevas reservas e inscripciones están pausadas por el momento'
      using errcode = '55000';
  end if;
end;
$$;
revoke all on function private.pilot_assert_new_booking_allowed() from public, anon, authenticated;

create or replace function public.pilot_estado_acceso()
returns json
language plpgsql stable security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare v_habilitado boolean;
        v_pausado boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  v_habilitado := private.pilot_usuario_habilitado();
  select bookings_paused into v_pausado from public.pilot_settings where singleton;
  return json_build_object(
    'habilitado', coalesce(v_habilitado, false),
    'reservas_pausadas', coalesce(v_pausado, true),
    'puede_reservar', coalesce(v_habilitado, false) and not coalesce(v_pausado, true)
  );
end;
$$;
revoke all on function public.pilot_estado_acceso() from public, anon;
grant execute on function public.pilot_estado_acceso() to authenticated;

create or replace function public.pilot_admin_listar_accesos()
returns setof json
language plpgsql stable security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if not private.is_admin_global() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return query
    select json_build_object(
      'id', u.id,
      'nombre_completo', u.nombre_completo,
      'email', u.email,
      'rol', u.rol,
      'habilitado', a.usuario_id is not null,
      'habilitado_at', a.enabled_at
    )
    from public.usuarios u
    left join public.pilot_access_users a on a.usuario_id = u.id
    order by u.nombre_completo nulls last, u.email;
end;
$$;
revoke all on function public.pilot_admin_listar_accesos() from public, anon;
grant execute on function public.pilot_admin_listar_accesos() to authenticated;

create or replace function public.pilot_admin_definir_acceso(p_usuario_id uuid, p_habilitado boolean)
returns void
language plpgsql volatile security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if not private.is_admin_global() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not exists (select 1 from public.usuarios where id = p_usuario_id) then
    raise exception 'Usuario no encontrado';
  end if;
  if p_habilitado then
    insert into public.pilot_access_users(usuario_id, enabled_by)
    values (p_usuario_id, auth.uid())
    on conflict (usuario_id) do nothing;
  else
    delete from public.pilot_access_users where usuario_id = p_usuario_id;
  end if;
end;
$$;
revoke all on function public.pilot_admin_definir_acceso(uuid, boolean) from public, anon;
grant execute on function public.pilot_admin_definir_acceso(uuid, boolean) to authenticated;

create or replace function public.pilot_admin_pausar_reservas(p_pausadas boolean, p_motivo text default null)
returns void
language plpgsql volatile security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if not private.is_admin_global() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_motivo is not null and length(btrim(p_motivo)) > 250 then raise exception 'Motivo demasiado largo'; end if;
  update public.pilot_settings
  set bookings_paused = p_pausadas,
      pause_reason = case when p_pausadas then nullif(btrim(p_motivo), '') else null end,
      updated_at = now(),
      updated_by = auth.uid()
  where singleton;
end;
$$;
revoke all on function public.pilot_admin_pausar_reservas(boolean, text) from public, anon;
grant execute on function public.pilot_admin_pausar_reservas(boolean, text) to authenticated;

-- Keep previous write endpoints closed: the pilot RPCs are the only booking
-- and party-creation entry points once the pilot rollout is enabled.
revoke execute on function public.crear_partido(bigint, integer, integer, integer, text, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.crear_partido(bigint, integer, integer, integer, character varying, boolean, character varying)
  from public, anon, authenticated;
revoke execute on function public.reservar_turno_rango(bigint, date, time, time, text)
  from public, anon, authenticated;
revoke execute on function public.reservar_turno_virtual(integer, text, text, text, numeric, numeric)
  from public, anon, authenticated;
revoke execute on function public.crear_partido_virtual(integer, text, text, text, numeric, numeric, integer, integer, integer, text, boolean, text)
  from public, anon, authenticated;
revoke execute on function public.unirse_a_partido(bigint)
  from public, anon, authenticated;

-- Preserve booking and club history: legacy admin SECURITY DEFINER RPCs perform
-- hard DELETEs and must not remain reachable through the Data API.
revoke execute on function public.admin_cancelar_reserva(integer)
  from public, anon, authenticated;
revoke execute on function public.admin_eliminar_turno(integer)
  from public, anon, authenticated;
revoke execute on function public.admin_eliminar_cancha(integer)
  from public, anon, authenticated;
revoke execute on function public.admin_eliminar_club(integer)
  from public, anon, authenticated;

-- The legacy role editor is SECURITY DEFINER. Prevent self-promotion, and
-- reserve the superadmin role for an existing superadmin.
create or replace function public.admin_actualizar_rol(p_usuario_id uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_is_superadmin boolean;
  v_target_role text;
begin
  if not private.is_admin_global() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_rol is null or p_rol not in ('jugador','admin_cancha','admin_global','superadmin') then
    raise exception 'Rol inválido';
  end if;
  if p_usuario_id is not distinct from (select auth.uid()) then
    raise exception 'No se puede cambiar el propio rol';
  end if;

  select exists (
    select 1 from public.usuarios u
    where u.id=(select auth.uid()) and u.rol='superadmin'
  ) into v_actor_is_superadmin;

  select u.rol into v_target_role from public.usuarios u
  where u.id=p_usuario_id for update;
  if not found then raise exception 'Usuario no encontrado'; end if;
  if (p_rol='superadmin' or v_target_role='superadmin') and not v_actor_is_superadmin then
    raise exception 'Solo un superadmin puede asignar o modificar ese rol';
  end if;

  update public.usuarios set rol=p_rol where id=p_usuario_id;
end;
$$;
revoke all on function public.admin_actualizar_rol(uuid,text) from public, anon;
grant execute on function public.admin_actualizar_rol(uuid,text) to authenticated;

-- Notification helpers belong to signed-in users only. Keep the privileged
-- access scoped to the caller and remove the mutable function search_path.
create or replace function public.marcar_notificacion_leida(p_notificacion_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  update public.notificaciones set leida=true
  where id=p_notificacion_id and usuario_id=(select auth.uid());
  if not found then raise exception 'Notificación no encontrada'; end if;
end;
$$;
revoke all on function public.marcar_notificacion_leida(bigint) from public, anon;
grant execute on function public.marcar_notificacion_leida(bigint) to authenticated;

create or replace function public.marcar_todas_leidas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  update public.notificaciones set leida=true
  where usuario_id=(select auth.uid()) and leida=false;
end;
$$;
revoke all on function public.marcar_todas_leidas() from public, anon;
grant execute on function public.marcar_todas_leidas() to authenticated;

create or replace function public.mis_notificaciones()
returns setof json
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.json_build_object(
    'id',n.id,'tipo',n.tipo,'titulo',n.titulo,'partido_id',n.partido_id,
    'leida',n.leida,'created_at',n.created_at
  )
  from public.notificaciones n
  where n.usuario_id=(select auth.uid())
  order by n.created_at desc
  limit 20;
$$;
revoke all on function public.mis_notificaciones() from public, anon;
grant execute on function public.mis_notificaciones() to authenticated;

-- Public leads are accepted only through the validated, rate-limited Edge Function.
revoke insert on public.solicitudes_club from public, anon, authenticated;
revoke usage on sequence public.solicitudes_club_id_seq from public, anon, authenticated;
