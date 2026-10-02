create schema if not exists private;

revoke all on schema private from public;

alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios
  add constraint usuarios_rol_check
  check ((rol)::text = any (array['jugador', 'admin_cancha', 'admin_global', 'superadmin']));

alter table public.partidos drop constraint if exists partidos_cupo_maximo_check;
alter table public.partidos
  add constraint partidos_cupos_check
  check (cupo_minimo >= 2 and cupo_maximo >= cupo_minimo and cupo_maximo <= 22);

alter table public.partidos
  add column if not exists nivel_requerido varchar default 'recreativo'
    check (nivel_requerido in ('recreativo', 'intermedio', 'competitivo')),
  add column if not exists requiere_aprobacion boolean not null default false,
  add column if not exists expira_pre_reserva_at timestamptz;

alter table public.participantes_partido drop constraint if exists participantes_partido_estado_inscripcion_check;
alter table public.participantes_partido
  add constraint participantes_partido_estado_inscripcion_check
  check (estado_inscripcion in ('pendiente_pago', 'pendiente_aprobacion', 'confirmado', 'rechazado'));

alter table public.participantes_partido
  add constraint participantes_partido_partido_usuario_unique unique (partido_id, usuario_id);

create index if not exists idx_usuarios_rol on public.usuarios (rol);
create index if not exists idx_canchas_club_id on public.canchas (club_id);
create index if not exists idx_turnos_cancha_fecha on public.disponibilidad_turnos (cancha_id, fecha, hora_inicio);
create index if not exists idx_reservas_usuario_id on public.reservas (usuario_id);
create index if not exists idx_reservas_turno_id on public.reservas (turno_id);
create index if not exists idx_partidos_reserva_id on public.partidos (reserva_id);
create index if not exists idx_partidos_organizador_id on public.partidos (organizador_id);
create index if not exists idx_participantes_partido_id on public.participantes_partido (partido_id);
create index if not exists idx_participantes_usuario_id on public.participantes_partido (usuario_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.usuarios (id, email, nombre_completo, nivel_voley, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre_completo', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'nivel_voley', '')::int, 5),
    'jugador'
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function public.is_admin_global()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and u.rol in ('admin_global', 'superadmin')
  );
$$;

revoke all on function public.is_admin_global() from public;
grant execute on function public.is_admin_global() to authenticated;

create policy "Usuario crea su propio perfil"
on public.usuarios
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Actualizar propio perfil" on public.usuarios;
create policy "Actualizar propio perfil"
on public.usuarios
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Reservas visibles para participantes"
on public.reservas
for select
to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (
    select 1 from public.partidos p
    where p.reserva_id = reservas.id
      and p.visibilidad in ('publico', 'enlace')
  )
  or (select public.is_admin_global())
);

create policy "Usuario crea su reserva"
on public.reservas
for insert
to authenticated
with check (usuario_id = (select auth.uid()));

create policy "Usuario actualiza su reserva pendiente"
on public.reservas
for update
to authenticated
using (usuario_id = (select auth.uid()) and estado_pago = 'pendiente')
with check (usuario_id = (select auth.uid()));

create policy "Usuario crea su partido"
on public.partidos
for insert
to authenticated
with check (organizador_id = (select auth.uid()));

drop policy if exists "Organizador edita su partido" on public.partidos;
create policy "Organizador edita su partido"
on public.partidos
for update
to authenticated
using (organizador_id = (select auth.uid()) or (select public.is_admin_global()))
with check (organizador_id = (select auth.uid()) or (select public.is_admin_global()));

create policy "Organizador gestiona participantes"
on public.participantes_partido
for update
to authenticated
using (
  exists (
    select 1 from public.partidos p
    where p.id = participantes_partido.partido_id
      and p.organizador_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.partidos p
    where p.id = participantes_partido.partido_id
      and p.organizador_id = (select auth.uid())
  )
);

create or replace view public.partidos_publicos
with (security_invoker = true)
as
select
  p.id,
  p.visibilidad,
  p.estado_partido,
  p.cupo_minimo,
  p.cupo_maximo,
  p.cantidad_invitados_anonimos,
  p.nivel_requerido,
  p.requiere_aprobacion,
  p.expira_pre_reserva_at,
  p.token_invitacion,
  r.id as reserva_id,
  r.expira_at as reserva_expira_at,
  t.id as turno_id,
  t.fecha,
  t.hora_inicio,
  t.hora_fin,
  c.id as cancha_id,
  c.nombre_identificador as cancha_nombre,
  c.precio_total,
  c.precio_sena,
  cl.id as club_id,
  cl.nombre as club_nombre,
  cl.direccion,
  case when cl.ubicacion is null then null else st_y(cl.ubicacion::geometry) end as latitud,
  case when cl.ubicacion is null then null else st_x(cl.ubicacion::geometry) end as longitud,
  coalesce((
    select count(*)::int
    from public.participantes_partido pp
    where pp.partido_id = p.id
      and pp.estado_inscripcion in ('confirmado', 'pendiente_pago')
  ), 0) + coalesce(p.cantidad_invitados_anonimos, 0) as jugadores_confirmados
from public.partidos p
join public.reservas r on r.id = p.reserva_id
join public.disponibilidad_turnos t on t.id = r.turno_id
join public.canchas c on c.id = t.cancha_id
join public.clubes cl on cl.id = c.club_id
where p.visibilidad in ('publico', 'enlace')
  and p.estado_partido <> 'cancelado';

grant select on public.partidos_publicos to anon, authenticated;

create or replace function public.crear_partido(
  p_turno_id bigint,
  p_cupo_minimo int default 12,
  p_cupo_maximo int default 18,
  p_invitados int default 0,
  p_nivel varchar default 'recreativo',
  p_requiere_aprobacion boolean default false,
  p_visibilidad varchar default 'publico'
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reserva_id bigint;
  v_partido_id bigint;
  v_estado_inscripcion varchar;
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión para crear un partido';
  end if;

  if p_cupo_minimo < 2 or p_cupo_maximo < p_cupo_minimo or p_cupo_maximo > 22 then
    raise exception 'Los cupos deben ser coherentes y no superar 22 jugadores';
  end if;

  if p_invitados < 0 or p_invitados >= p_cupo_maximo then
    raise exception 'La cantidad de invitados debe ser menor al cupo máximo';
  end if;

  update public.disponibilidad_turnos
  set estado = 'pre_reservado'
  where id = p_turno_id
    and estado = 'disponible';

  if not found then
    raise exception 'El turno ya no está disponible';
  end if;

  insert into public.reservas (turno_id, usuario_id, estado_pago, expira_at)
  values (p_turno_id, (select auth.uid()), 'pendiente', now() + interval '4 hours')
  returning id into v_reserva_id;

  insert into public.partidos (
    reserva_id,
    organizador_id,
    cupo_minimo,
    cupo_maximo,
    cantidad_invitados_anonimos,
    visibilidad,
    estado_partido,
    token_invitacion,
    nivel_requerido,
    requiere_aprobacion,
    expira_pre_reserva_at
  )
  values (
    v_reserva_id,
    (select auth.uid()),
    p_cupo_minimo,
    p_cupo_maximo,
    p_invitados,
    p_visibilidad,
    'pre_reservado',
    encode(gen_random_bytes(12), 'hex'),
    p_nivel,
    p_requiere_aprobacion,
    now() + interval '4 hours'
  )
  returning id into v_partido_id;

  v_estado_inscripcion := case when p_requiere_aprobacion then 'pendiente_aprobacion' else 'confirmado' end;

  insert into public.participantes_partido (partido_id, usuario_id, estado_inscripcion)
  values (v_partido_id, (select auth.uid()), v_estado_inscripcion);

  return v_partido_id;
end;
$$;

grant execute on function public.crear_partido(bigint, int, int, int, varchar, boolean, varchar) to authenticated;
