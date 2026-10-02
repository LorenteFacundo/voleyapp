-- Campos de presentacion para canchas
alter table public.canchas
  add column if not exists titulo text,
  add column if not exists descripcion text,
  add column if not exists fotos text[] not null default '{}';

update public.canchas
set titulo = nombre_identificador
where titulo is null;

alter table public.canchas
  alter column titulo set not null;

-- Bucket publico para fotos de canchas
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'canchas-fotos',
  'canchas-fotos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Politicas de storage
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Fotos de canchas visibles publicamente'
  ) then
    create policy "Fotos de canchas visibles publicamente"
      on storage.objects for select
      to public
      using (bucket_id = 'canchas-fotos');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Superadmin sube fotos de canchas'
  ) then
    create policy "Superadmin sube fotos de canchas"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'canchas-fotos'
        and (select private.is_admin_global())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Superadmin actualiza fotos de canchas'
  ) then
    create policy "Superadmin actualiza fotos de canchas"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'canchas-fotos'
        and (select private.is_admin_global())
      )
      with check (
        bucket_id = 'canchas-fotos'
        and (select private.is_admin_global())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Superadmin elimina fotos de canchas'
  ) then
    create policy "Superadmin elimina fotos de canchas"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'canchas-fotos'
        and (select private.is_admin_global())
      );
  end if;
end $$;

-- Gestion de catalogo para admin global / superadmin
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clubes' and policyname = 'Admins globales gestionan clubes'
  ) then
    create policy "Admins globales gestionan clubes"
      on public.clubes for all
      to authenticated
      using ((select private.is_admin_global()))
      with check ((select private.is_admin_global()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'canchas' and policyname = 'Admins globales gestionan canchas'
  ) then
    create policy "Admins globales gestionan canchas"
      on public.canchas for all
      to authenticated
      using ((select private.is_admin_global()))
      with check ((select private.is_admin_global()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'disponibilidad_turnos' and policyname = 'Admins globales gestionan turnos'
  ) then
    create policy "Admins globales gestionan turnos"
      on public.disponibilidad_turnos for all
      to authenticated
      using ((select private.is_admin_global()))
      with check ((select private.is_admin_global()));
  end if;
end $$;

create or replace function public.admin_crear_cancha(
  p_club_nombre text,
  p_club_direccion text,
  p_latitud double precision,
  p_longitud double precision,
  p_titulo text,
  p_precio_total numeric,
  p_precio_sena numeric,
  p_club_telefono text default null,
  p_nombre_identificador text default null,
  p_descripcion text default null,
  p_fotos text[] default '{}',
  p_turnos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_club_id bigint;
  v_cancha_id bigint;
  v_turno record;
  v_turnos_creados integer := 0;
  v_nombre_identificador text;
begin
  if not (select private.is_admin_global()) then
    raise exception 'Solo admin_global o superadmin pueden crear canchas';
  end if;

  if coalesce(trim(p_club_nombre), '') = '' then
    raise exception 'El nombre del club es obligatorio';
  end if;

  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'El titulo de la cancha es obligatorio';
  end if;

  if p_precio_total <= 0 or p_precio_sena < 0 or p_precio_sena > p_precio_total then
    raise exception 'Los precios deben ser validos y la sena no puede superar el total';
  end if;

  v_nombre_identificador := coalesce(nullif(trim(p_nombre_identificador), ''), trim(p_titulo));

  insert into public.clubes (nombre, direccion, telefono, ubicacion)
  values (
    trim(p_club_nombre),
    nullif(trim(p_club_direccion), ''),
    nullif(trim(p_club_telefono), ''),
    st_setsrid(st_makepoint(p_longitud, p_latitud), 4326)
  )
  returning id into v_club_id;

  insert into public.canchas (
    club_id,
    nombre_identificador,
    titulo,
    descripcion,
    fotos,
    precio_total,
    precio_sena
  )
  values (
    v_club_id,
    v_nombre_identificador,
    trim(p_titulo),
    nullif(trim(p_descripcion), ''),
    coalesce(p_fotos, '{}'),
    p_precio_total,
    p_precio_sena
  )
  returning id into v_cancha_id;

  for v_turno in
    select
      (value->>'fecha')::date as fecha,
      (value->>'hora_inicio')::time as hora_inicio,
      (value->>'hora_fin')::time as hora_fin
    from jsonb_array_elements(coalesce(p_turnos, '[]'::jsonb))
  loop
    if v_turno.fecha is null or v_turno.hora_inicio is null or v_turno.hora_fin is null then
      raise exception 'Cada turno debe incluir fecha, hora_inicio y hora_fin';
    end if;

    if v_turno.hora_fin <= v_turno.hora_inicio then
      raise exception 'La hora de fin debe ser posterior a la hora de inicio';
    end if;

    insert into public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
    values (v_cancha_id, v_turno.fecha, v_turno.hora_inicio, v_turno.hora_fin, 'disponible');

    v_turnos_creados := v_turnos_creados + 1;
  end loop;

  return jsonb_build_object(
    'club_id', v_club_id,
    'cancha_id', v_cancha_id,
    'turnos_creados', v_turnos_creados
  );
end;
$function$;

grant execute on function public.admin_crear_cancha(
  text, text, double precision, double precision, text, numeric, numeric, text, text, text, text[], jsonb
) to authenticated;
