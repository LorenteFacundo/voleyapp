-- Esquema base previo al historial versionado.
--
-- Las tablas originales del proyecto (usuarios, clubes, canchas, turnos,
-- reservas, partidos) y varias funciones administrativas se crearon desde el
-- panel de Supabase antes de que existieran migraciones. Este archivo las
-- reconstruye para que `supabase db reset` y las pruebas puedan levantar la
-- base desde cero.
--
-- En el proyecto productivo NO debe ejecutarse: registrarlo como aplicado con
--   supabase migration repair --status applied 20260527000000
-- Como resguardo adicional, si la tabla public.usuarios ya existe el bloque
-- termina sin cambios.

do $baseline$
begin
  if to_regclass('public.usuarios') is not null then
    raise notice 'Esquema base presente: se omite la reconstrucción.';
    return;
  end if;

  create extension if not exists postgis;
  create extension if not exists pgcrypto with schema extensions;
  create schema if not exists private;

  create table public.usuarios (
    id uuid primary key references auth.users(id) on delete cascade,
    nombre_completo varchar,
    email varchar not null unique,
    nivel_voley int check (nivel_voley >= 1 and nivel_voley <= 10),
    rol varchar default 'jugador' check (rol in ('jugador', 'admin_cancha', 'admin_global', 'superadmin')),
    created_at timestamptz default now()
  );

  create table public.clubes (
    id bigint generated always as identity primary key,
    nombre varchar not null,
    direccion varchar,
    telefono varchar,
    ubicacion geometry(Point, 4326),
    created_at timestamptz default now()
  );

  create table public.administradores_club (
    id bigint generated always as identity primary key,
    club_id bigint not null references public.clubes(id) on delete cascade,
    user_id uuid not null references public.usuarios(id) on delete cascade,
    created_at timestamptz default now(),
    unique (club_id, user_id)
  );

  create table public.canchas (
    id bigint generated always as identity primary key,
    club_id bigint references public.clubes(id),
    nombre_identificador varchar not null,
    precio_total numeric not null,
    precio_sena numeric not null
  );

  create table public.disponibilidad_turnos (
    id bigint generated always as identity primary key,
    cancha_id bigint references public.canchas(id),
    fecha date not null,
    hora_inicio time not null,
    hora_fin time not null,
    estado varchar default 'disponible'
      check (estado in ('disponible', 'pre_reservado', 'reservado', 'bloqueado_club'))
  );

  create table public.horarios_semanales (
    id int generated always as identity primary key,
    cancha_id int references public.canchas(id),
    dia_semana int not null check (dia_semana >= 0 and dia_semana <= 6),
    hora_inicio time not null,
    hora_fin time not null,
    precio_total numeric not null,
    precio_sena numeric default 0,
    activo boolean default true,
    created_at timestamptz default now()
  );

  create table public.reservas (
    id bigint generated always as identity primary key,
    turno_id bigint references public.disponibilidad_turnos(id),
    usuario_id uuid references public.usuarios(id),
    monto_sena_pagado numeric default 0,
    monto_cargo_servicio numeric default 0,
    estado_pago varchar default 'pendiente' check (estado_pago in ('pendiente', 'aprobado', 'expirado')),
    id_transaccion_mp varchar,
    expira_at timestamptz,
    created_at timestamptz default now()
  );

  create table public.partidos (
    id bigint generated always as identity primary key,
    reserva_id bigint references public.reservas(id),
    organizador_id uuid references public.usuarios(id),
    cupo_minimo int default 12,
    cupo_maximo int default 18,
    cantidad_invitados_anonimos int default 0,
    visibilidad varchar default 'publico' check (visibilidad in ('publico', 'privado', 'enlace')),
    estado_partido varchar default 'borrador'
      check (estado_partido in ('borrador', 'pre_reservado', 'abierto', 'confirmado', 'cancelado')),
    token_invitacion varchar unique,
    created_at timestamptz default now(),
    constraint partidos_cupo_maximo_check check (cupo_maximo <= 22)
  );

  create table public.participantes_partido (
    id bigint generated always as identity primary key,
    partido_id bigint references public.partidos(id),
    usuario_id uuid references public.usuarios(id),
    monto_sena_aportado numeric default 0,
    estado_inscripcion varchar default 'pendiente_pago'
      check (estado_inscripcion in ('pendiente_pago', 'pendiente_aprobacion', 'confirmado', 'rechazado')),
    created_at timestamptz default now()
  );

  alter table public.usuarios enable row level security;
  alter table public.clubes enable row level security;
  alter table public.administradores_club enable row level security;
  alter table public.canchas enable row level security;
  alter table public.disponibilidad_turnos enable row level security;
  alter table public.horarios_semanales enable row level security;
  alter table public.reservas enable row level security;
  alter table public.partidos enable row level security;
  alter table public.participantes_partido enable row level security;

  create policy "Perfiles visibles para todos" on public.usuarios for select using (true);
  create policy "Actualizar propio perfil" on public.usuarios for update
    using (auth.uid() = id) with check (auth.uid() = id);
  create policy "Clubes visibles para todos" on public.clubes for select using (true);
  create policy "Canchas visibles para todos" on public.canchas for select using (true);
  create policy "Turnos visibles para todos" on public.disponibilidad_turnos for select using (true);
  create policy "Lectura pública horarios semanales" on public.horarios_semanales for select using (true);
  create policy "Partidos públicos visibles" on public.partidos for select using (visibilidad = 'publico');
  create policy "Partidos por enlace visibles" on public.partidos for select using (visibilidad = 'enlace');
  create policy "Lista de participantes visible" on public.participantes_partido for select using (true);

  -- Funciones creadas desde el panel antes del historial. Se conservan sus
  -- firmas porque migraciones posteriores les cambian permisos.
  create or replace function public.is_admin() returns boolean
  language sql stable security definer as $fn$
    select exists (
      select 1 from public.usuarios
      where id = auth.uid() and rol in ('admin_global', 'superadmin')
    );
  $fn$;

  create policy "Admin gestiona horarios semanales" on public.horarios_semanales for all
    using (public.is_admin()) with check (public.is_admin());

  create or replace function public.reservar_turno_virtual(
    p_cancha_id int, p_fecha text, p_hora_inicio text, p_hora_fin text,
    p_precio_total numeric, p_precio_sena numeric
  ) returns int language plpgsql security definer as $fn$
  declare v_turno_id int; v_existe int;
  begin
    select id into v_existe from public.disponibilidad_turnos
    where cancha_id = p_cancha_id and fecha = p_fecha::date
      and hora_inicio = p_hora_inicio::time and hora_fin = p_hora_fin::time;
    if v_existe is not null then raise exception 'Ese horario ya no está disponible'; end if;
    insert into public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
    values (p_cancha_id, p_fecha::date, p_hora_inicio::time, p_hora_fin::time, 'reservado')
    returning id into v_turno_id;
    insert into public.reservas (turno_id, usuario_id, monto_sena_pagado, estado_pago)
    values (v_turno_id, auth.uid(), 0, 'pendiente');
    return v_turno_id;
  end;
  $fn$;

  create or replace function public.crear_partido_virtual(
    p_cancha_id int, p_fecha text, p_hora_inicio text, p_hora_fin text,
    p_precio_total numeric, p_precio_sena numeric,
    p_cupo_minimo int, p_cupo_maximo int, p_invitados int,
    p_nivel text, p_requiere_aprobacion boolean, p_visibilidad text
  ) returns int language plpgsql security definer as $fn$
  declare v_turno_id int; v_reserva_id int; v_partido_id int;
  begin
    insert into public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
    values (p_cancha_id, p_fecha::date, p_hora_inicio::time, p_hora_fin::time, 'pre_reservado')
    returning id into v_turno_id;
    insert into public.reservas (turno_id, usuario_id, estado_pago)
    values (v_turno_id, auth.uid(), 'pendiente') returning id into v_reserva_id;
    insert into public.partidos (reserva_id, organizador_id, cupo_minimo, cupo_maximo,
      cantidad_invitados_anonimos, visibilidad, estado_partido, token_invitacion)
    values (v_reserva_id, auth.uid(), p_cupo_minimo, p_cupo_maximo, p_invitados, p_visibilidad,
      'pre_reservado', encode(extensions.gen_random_bytes(12), 'hex'))
    returning id into v_partido_id;
    insert into public.participantes_partido (partido_id, usuario_id, estado_inscripcion)
    values (v_partido_id, auth.uid(), 'confirmado');
    return v_partido_id;
  end;
  $fn$;

  create or replace function public.obtener_turnos_disponibles(p_cancha_id int, p_desde date, p_hasta date)
  returns setof json language plpgsql security definer as $fn$
  declare v_dia date; v_hs record; v_existe record;
  begin
    v_dia := p_desde;
    while v_dia <= p_hasta loop
      for v_hs in select * from public.horarios_semanales
        where cancha_id = p_cancha_id and dia_semana = extract(dow from v_dia) and activo loop
        select id, estado into v_existe from public.disponibilidad_turnos
        where cancha_id = p_cancha_id and fecha = v_dia
          and hora_inicio = v_hs.hora_inicio and hora_fin = v_hs.hora_fin limit 1;
        return query select json_build_object('id', v_existe.id, 'cancha_id', p_cancha_id,
          'fecha', v_dia, 'hora_inicio', v_hs.hora_inicio, 'hora_fin', v_hs.hora_fin,
          'estado', coalesce(v_existe.estado, 'disponible'), 'precio_total', v_hs.precio_total,
          'precio_sena', v_hs.precio_sena, 'horario_semanal_id', v_hs.id);
      end loop;
      v_dia := v_dia + 1;
    end loop;
  end;
  $fn$;

  create or replace function public.admin_actualizar_club(p_club_id int, p_nombre text, p_direccion text,
    p_telefono text, p_latitud numeric, p_longitud numeric)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    update public.clubes set nombre = p_nombre, direccion = p_direccion, telefono = p_telefono,
      ubicacion = st_setsrid(st_makepoint(p_longitud, p_latitud), 4326) where id = p_club_id;
  end;
  $fn$;

  create or replace function public.admin_eliminar_club(p_club_id int)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    delete from public.clubes where id = p_club_id;
  end;
  $fn$;

  create or replace function public.admin_actualizar_cancha(p_cancha_id int, p_titulo text,
    p_descripcion text, p_precio_total numeric, p_precio_sena numeric, p_fotos text[])
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    update public.canchas set titulo = p_titulo, descripcion = p_descripcion,
      precio_total = p_precio_total, precio_sena = p_precio_sena, fotos = p_fotos where id = p_cancha_id;
  end;
  $fn$;

  create or replace function public.admin_eliminar_cancha(p_cancha_id int)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    delete from public.disponibilidad_turnos where cancha_id = p_cancha_id;
    delete from public.canchas where id = p_cancha_id;
  end;
  $fn$;

  create or replace function public.admin_crear_turno(p_cancha_id int, p_fecha text,
    p_hora_inicio text, p_hora_fin text)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    insert into public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
    values (p_cancha_id, p_fecha::date, p_hora_inicio::time, p_hora_fin::time, 'disponible');
  end;
  $fn$;

  create or replace function public.admin_eliminar_turno(p_turno_id int)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    delete from public.disponibilidad_turnos where id = p_turno_id;
  end;
  $fn$;

  create or replace function public.admin_cancelar_reserva(p_reserva_id int)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    delete from public.reservas where id = p_reserva_id;
  end;
  $fn$;

  create or replace function public.admin_cancelar_partido(p_partido_id int)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    update public.partidos set estado_partido = 'cancelado' where id = p_partido_id;
  end;
  $fn$;

  create or replace function public.admin_actualizar_rol(p_usuario_id uuid, p_rol text)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    if p_rol not in ('jugador', 'admin_cancha', 'admin_global', 'superadmin') then
      raise exception 'Rol invalido: %', p_rol;
    end if;
    update public.usuarios set rol = p_rol where id = p_usuario_id;
  end;
  $fn$;

  create or replace function public.admin_guardar_horarios_semanales(p_cancha_id int, p_horarios jsonb)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    delete from public.horarios_semanales where cancha_id = p_cancha_id;
    insert into public.horarios_semanales (cancha_id, dia_semana, hora_inicio, hora_fin, precio_total, precio_sena)
    select p_cancha_id, (h->>'dia_semana')::int, (h->>'hora_inicio')::time, (h->>'hora_fin')::time,
      (h->>'precio_total')::numeric, (h->>'precio_sena')::numeric
    from jsonb_array_elements(p_horarios) as h;
  end;
  $fn$;

  create or replace function public.admin_eliminar_horario_semanal(p_horario_id int)
  returns void language plpgsql security definer as $fn$
  begin
    if not public.is_admin() then raise exception 'No autorizado'; end if;
    delete from public.horarios_semanales where id = p_horario_id;
  end;
  $fn$;
end
$baseline$;
