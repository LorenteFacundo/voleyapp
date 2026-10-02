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
  p_turnos jsonb default '[]'::jsonb,
  p_club_id bigint default null
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
  v_club record;
begin
  if not (select private.is_admin_global()) then
    raise exception 'Solo admin_global o superadmin pueden crear canchas';
  end if;

  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'El titulo de la cancha es obligatorio';
  end if;

  if p_precio_total <= 0 or p_precio_sena < 0 or p_precio_sena > p_precio_total then
    raise exception 'Los precios deben ser validos y la sena no puede superar el total';
  end if;

  v_nombre_identificador := coalesce(nullif(trim(p_nombre_identificador), ''), trim(p_titulo));

  if p_club_id is not null then
    select id into v_club
    from public.clubes
    where id = p_club_id;

    if v_club.id is null then
      raise exception 'El club seleccionado no existe';
    end if;

    v_club_id := v_club.id;

    update public.clubes
    set
      telefono = nullif(trim(p_club_telefono), ''),
      direccion = coalesce(nullif(trim(p_club_direccion), ''), direccion),
      ubicacion = st_setsrid(st_makepoint(p_longitud, p_latitud), 4326)
    where id = v_club_id;
  else
    if coalesce(trim(p_club_nombre), '') = '' then
      raise exception 'El nombre del club es obligatorio';
    end if;

    insert into public.clubes (nombre, direccion, telefono, ubicacion)
    values (
      trim(p_club_nombre),
      nullif(trim(p_club_direccion), ''),
      nullif(trim(p_club_telefono), ''),
      st_setsrid(st_makepoint(p_longitud, p_latitud), 4326)
    )
    returning id into v_club_id;
  end if;

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
