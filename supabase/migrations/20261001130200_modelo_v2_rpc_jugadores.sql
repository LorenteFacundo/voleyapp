-- RPC públicas y de jugadores del modelo v2.

-- ---------------------------------------------------------------------------
-- Lectura de parámetros JSON con errores claros
-- ---------------------------------------------------------------------------

create or replace function private.json_entero(p_datos jsonb, p_clave text, p_defecto integer)
returns integer
language plpgsql immutable
set search_path = ''
as $$
declare v text := p_datos ->> p_clave;
begin
  if v is null or v = '' then return p_defecto; end if;
  if v !~ '^-?[0-9]{1,9}$' then raise exception 'El dato "%" debe ser un número entero', p_clave; end if;
  return v::integer;
end;
$$;

create or replace function private.json_numero(p_datos jsonb, p_clave text, p_defecto numeric)
returns numeric
language plpgsql immutable
set search_path = ''
as $$
declare v text := p_datos ->> p_clave;
begin
  if v is null or v = '' then return p_defecto; end if;
  if v !~ '^-?[0-9]{1,12}(\.[0-9]{1,2})?$' then raise exception 'El dato "%" debe ser un monto válido', p_clave; end if;
  return v::numeric;
end;
$$;

create or replace function private.json_booleano(p_datos jsonb, p_clave text, p_defecto boolean)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare v text := p_datos ->> p_clave;
begin
  if v is null or v = '' then return p_defecto; end if;
  if v not in ('true', 'false') then raise exception 'El dato "%" debe ser verdadero o falso', p_clave; end if;
  return v::boolean;
end;
$$;

revoke all on function private.json_entero(jsonb, text, integer) from public, anon, authenticated;
revoke all on function private.json_numero(jsonb, text, numeric) from public, anon, authenticated;
revoke all on function private.json_booleano(jsonb, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Estado de operación y catálogo
-- ---------------------------------------------------------------------------

create or replace function public.estado_operacion()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_conf public.app_config%rowtype;
  v_uid uuid := auth.uid();
  v_admin boolean := private.is_admin_global();
  v_habilitada boolean := false;
begin
  select * into v_conf from public.app_config where id;
  if v_uid is not null then
    v_habilitada := v_admin
      or not coalesce(v_conf.requiere_lista_acceso, true)
      or exists (select 1 from public.acceso_piloto a where a.usuario_id = v_uid);
  end if;
  return jsonb_build_object(
    'reservas_pausadas', coalesce(v_conf.reservas_pausadas, true),
    'motivo_pausa', v_conf.motivo_pausa,
    'requiere_lista_acceso', coalesce(v_conf.requiere_lista_acceso, true),
    'cuenta_habilitada', v_habilitada,
    'puede_reservar', v_uid is not null and v_habilitada
      and (v_admin or not coalesce(v_conf.reservas_pausadas, true))
  );
end;
$$;

-- Bloques publicados con su estado para un club o una cancha (hasta 32 días).
create or replace function public.disponibilidad(
  p_club_id bigint default null,
  p_cancha_id bigint default null,
  p_desde date default null,
  p_hasta date default null
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_desde date := greatest(coalesce(p_desde, private.hoy_ar()), private.hoy_ar());
  v_hasta date;
  v_uid uuid := auth.uid();
  v_bloques jsonb;
begin
  if p_club_id is null and p_cancha_id is null then
    raise exception 'Indicá un club o una cancha';
  end if;
  v_hasta := least(coalesce(p_hasta, v_desde + 13), v_desde + 31);
  if v_hasta < v_desde then raise exception 'El rango de fechas no es válido'; end if;

  with dias as (
    select d::date as fecha
    from pg_catalog.generate_series(v_desde::timestamp, v_hasta::timestamp, interval '1 day') d
  ), bloques as (
    select h.id as horario_id, h.cancha_id, d.fecha, h.hora_inicio, h.hora_fin, h.precio_total, h.precio_sena,
      cl.anticipacion_minima_min, cl.ventana_reserva_dias,
      private.instante_ar(d.fecha, h.hora_inicio) as inicio,
      private.instante_ar(d.fecha + case when h.hora_fin <= h.hora_inicio then 1 else 0 end, h.hora_fin) as fin
    from dias d
    join public.horarios_semanales h on h.dia_semana = extract(dow from d.fecha)::int and h.activo
    join public.canchas ca on ca.id = h.cancha_id and ca.activa
    join public.clubes cl on cl.id = ca.club_id and cl.publicado
    where (p_cancha_id is null or h.cancha_id = p_cancha_id)
      and (p_club_id is null or ca.club_id = p_club_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'horario_id', b.horario_id,
      'cancha_id', b.cancha_id,
      'fecha', b.fecha,
      'hora_inicio', pg_catalog.to_char(b.hora_inicio, 'HH24:MI'),
      'hora_fin', pg_catalog.to_char(b.hora_fin, 'HH24:MI'),
      'inicio', b.inicio,
      'fin', b.fin,
      'precio', b.precio_total,
      'sena', b.precio_sena,
      'estado', case
        when propia.id is not null then case propia.estado when 'pendiente' then 'mi_solicitud' else 'mi_reserva' end
        when ocupada.hay then 'ocupado'
        when b.inicio < pg_catalog.now() + make_interval(mins => b.anticipacion_minima_min) then 'no_disponible'
        when b.fecha > private.hoy_ar() + b.ventana_reserva_dias then 'no_disponible'
        else 'libre'
      end,
      'ocupacion_id', propia.id
    ) order by b.fecha, b.hora_inicio, b.cancha_id), '[]'::jsonb)
  into v_bloques
  from bloques b
  left join lateral (
    select true as hay from public.ocupaciones x
    where x.cancha_id = b.cancha_id
      and (x.estado = 'confirmada' or (x.estado = 'pendiente' and x.vence_at > pg_catalog.now()))
      and tstzrange(x.inicio, x.fin, '[)') && tstzrange(b.inicio, b.fin, '[)')
    limit 1
  ) ocupada on true
  left join lateral (
    select x.id, x.estado from public.ocupaciones x
    where v_uid is not null and x.usuario_id = v_uid and x.cancha_id = b.cancha_id
      and x.inicio = b.inicio and x.fin = b.fin
      and (x.estado = 'confirmada' or (x.estado = 'pendiente' and x.vence_at > pg_catalog.now()))
    limit 1
  ) propia on true
  where b.fin > pg_catalog.now();

  return jsonb_build_object('desde', v_desde, 'hasta', v_hasta, 'bloques', v_bloques);
end;
$$;

-- Partidos abiertos y futuros, con filtros y distancia aproximada.
create or replace function public.explorar_partidos(
  p_nivel text default null,
  p_texto text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radio_km integer default null,
  p_limite integer default 50
)
returns setof jsonb
language sql stable security definer
set search_path = ''
as $$
  with base as (
    select pa.id, pa.organizador_id, pa.nivel_requerido, pa.cupo_minimo, pa.cupo_maximo,
      pa.requiere_aprobacion, pa.descripcion, pa.precio_por_jugador, pa.club_id is not null as organiza_club,
      o.inicio, o.fin, o.precio,
      ca.id as cancha_id, ca.titulo as cancha_titulo,
      cl.id as club_id, cl.nombre as club_nombre, cl.slug, cl.direccion, cl.zona, cl.latitud, cl.longitud,
      org.nombre_completo as organizador_nombre,
      case when p_lat is null or p_lng is null or cl.latitud is null then null
        else 2 * 6371 * asin(sqrt(
          power(sin(radians(cl.latitud - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(cl.latitud)) * power(sin(radians(cl.longitud - p_lng) / 2), 2)))
      end as distancia_km
    from public.partidos pa
    join public.ocupaciones o on o.id = pa.ocupacion_id and o.estado = 'confirmada'
    join public.canchas ca on ca.id = o.cancha_id
    join public.clubes cl on cl.id = o.club_id and cl.publicado
    left join public.usuarios org on org.id = pa.organizador_id
    where pa.visibilidad = 'publico'
      and pa.estado_partido = 'abierto'
      and o.inicio > pg_catalog.now()
      and (p_nivel is null or pa.nivel_requerido = p_nivel)
      and (p_texto is null or btrim(p_texto) = ''
        or concat_ws(' ', cl.nombre, cl.zona, cl.direccion, ca.titulo) ilike
          '%' || replace(replace(replace(btrim(p_texto), '\', '\\'), '%', '\%'), '_', '\_') || '%')
  )
  select jsonb_build_object(
    'id', b.id,
    'inicio', b.inicio,
    'fin', b.fin,
    'nivel_requerido', b.nivel_requerido,
    'cupo_minimo', b.cupo_minimo,
    'cupo_maximo', b.cupo_maximo,
    'ocupados', private.ocupados_partido(b.id),
    'requiere_aprobacion', b.requiere_aprobacion,
    'descripcion', b.descripcion,
    'precio_total', b.precio,
    'precio_por_jugador', b.precio_por_jugador,
    'organiza_club', b.organiza_club,
    'organizador_nombre', case when b.organiza_club then b.club_nombre
      else private.nombre_visible(b.organizador_nombre, null) end,
    'club', jsonb_build_object('id', b.club_id, 'nombre', b.club_nombre, 'slug', b.slug,
      'direccion', b.direccion, 'zona', b.zona, 'latitud', b.latitud, 'longitud', b.longitud),
    'cancha', jsonb_build_object('id', b.cancha_id, 'titulo', b.cancha_titulo),
    'mi_estado', (select pp.estado_inscripcion from public.participantes_partido pp
      where pp.partido_id = b.id and pp.usuario_id = (select auth.uid())),
    'soy_organizador', b.organizador_id = (select auth.uid()),
    'distancia_km', round(b.distancia_km::numeric, 1)
  )
  from base b
  where p_radio_km is null or (b.distancia_km is not null and b.distancia_km <= p_radio_km)
  order by b.inicio
  limit least(greatest(coalesce(p_limite, 50), 1), 100)
$$;

create or replace function public.partido_detalle(p_partido_id bigint, p_token text default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  pa public.partidos%rowtype;
  o public.ocupaciones%rowtype;
  ca public.canchas%rowtype;
  cl public.clubes%rowtype;
  v_mi_estado text;
  v_soy_org boolean;
  v_staff boolean;
  v_token_ok boolean;
begin
  select * into pa from public.partidos where id = p_partido_id;
  if not found or pa.ocupacion_id is null then
    raise exception 'Partido no encontrado' using errcode = 'P0002';
  end if;
  select * into o from public.ocupaciones where id = pa.ocupacion_id;
  select * into ca from public.canchas where id = o.cancha_id;
  select * into cl from public.clubes where id = o.club_id;

  v_soy_org := v_uid is not null and private.gestiona_partido(pa);
  select pp.estado_inscripcion into v_mi_estado
  from public.participantes_partido pp where pp.partido_id = pa.id and pp.usuario_id = v_uid;
  v_staff := private.rol_en_club(o.club_id) is not null;
  v_token_ok := pa.token_invitacion is not null and p_token is not null and p_token = pa.token_invitacion;

  if not (v_soy_org or v_mi_estado is not null or v_staff
      or (pa.estado_partido in ('abierto', 'confirmado', 'finalizado')
          and (pa.visibilidad = 'publico' or v_token_ok))) then
    raise exception 'Partido no encontrado' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', pa.id,
    'estado_partido', pa.estado_partido,
    'visibilidad', pa.visibilidad,
    'nivel_requerido', pa.nivel_requerido,
    'cupo_minimo', pa.cupo_minimo,
    'cupo_maximo', pa.cupo_maximo,
    'invitados', pa.cantidad_invitados_anonimos,
    'ocupados', private.ocupados_partido(pa.id),
    'requiere_aprobacion', pa.requiere_aprobacion,
    'descripcion', pa.descripcion,
    'precio_total', o.precio,
    'precio_por_jugador', pa.precio_por_jugador,
    'inicio', o.inicio,
    'fin', o.fin,
    'estado_reserva', o.estado,
    'club', jsonb_build_object('id', cl.id, 'nombre', cl.nombre, 'slug', cl.slug, 'direccion', cl.direccion,
      'zona', cl.zona, 'latitud', cl.latitud, 'longitud', cl.longitud, 'whatsapp', cl.whatsapp),
    'cancha', jsonb_build_object('id', ca.id, 'titulo', ca.titulo, 'techada', ca.techada, 'superficie', ca.superficie),
    'organiza_club', pa.club_id is not null,
    'organizador_nombre', case when pa.club_id is not null then cl.nombre else (
      select private.nombre_visible(u.nombre_completo, null) from public.usuarios u where u.id = pa.organizador_id) end,
    'soy_organizador', v_soy_org,
    'soy_staff', v_staff,
    'mi_estado', v_mi_estado,
    'token', case when v_soy_org or v_staff or v_mi_estado = 'confirmado' then pa.token_invitacion end,
    'participantes', coalesce((
      select jsonb_agg(jsonb_build_object(
          'usuario_id', case when v_soy_org or v_staff or pp.usuario_id = v_uid then pp.usuario_id end,
          'nombre', private.nombre_visible(u.nombre_completo, null),
          'nivel', u.nivel_voley,
          'estado', pp.estado_inscripcion,
          'es_organizador', pp.usuario_id = pa.organizador_id,
          'soy_yo', pp.usuario_id = v_uid
        ) order by pp.created_at)
      from public.participantes_partido pp
      join public.usuarios u on u.id = pp.usuario_id
      where pp.partido_id = pa.id
        and (pp.estado_inscripcion = 'confirmado' or v_soy_org or v_staff or pp.usuario_id = v_uid)
    ), '[]'::jsonb)
  );
end;
$$;

drop function if exists public.buscar_partido_por_token(character varying);
create or replace function public.buscar_partido_por_token(p_token text)
returns bigint
language sql stable security definer
set search_path = ''
as $$
  select pa.id from public.partidos pa
  where p_token is not null and length(p_token) >= 16
    and pa.token_invitacion = p_token
    and pa.estado_partido in ('borrador', 'abierto', 'confirmado')
  limit 1
$$;

create or replace function public.ranking(p_limite integer default 20)
returns setof jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('posicion', t.posicion, 'nombre', t.nombre, 'nivel', t.nivel_voley,
    'puntos', t.puntos_total, 'soy_yo', t.id = (select auth.uid()))
  from (
    select u.id, private.nombre_visible(u.nombre_completo, null) as nombre, u.nivel_voley, u.puntos_total,
      row_number() over (order by u.puntos_total desc, u.created_at) as posicion
    from public.usuarios u where u.puntos_total > 0
  ) t
  order by t.posicion
  limit least(greatest(coalesce(p_limite, 20), 1), 100)
$$;

create or replace function public.ver_invitacion_club(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare inv record;
begin
  select i.*, c.nombre as club_nombre into inv
  from public.club_invitaciones i join public.clubes c on c.id = i.club_id
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('valida', false, 'motivo', 'no_existe');
  end if;
  return jsonb_build_object(
    'valida', inv.aceptada_at is null and inv.revocada_at is null and inv.expira_at > pg_catalog.now(),
    'motivo', case
      when inv.aceptada_at is not null then 'aceptada'
      when inv.revocada_at is not null then 'revocada'
      when inv.expira_at <= pg_catalog.now() then 'vencida' end,
    'club_nombre', inv.club_nombre,
    'rol', inv.rol,
    'email', pg_catalog.regexp_replace(inv.email, '^(.)[^@]*(@.*)$', '\1•••\2'),
    'expira_at', inv.expira_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------------

create or replace function public.mi_perfil()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  u public.usuarios%rowtype;
begin
  select * into u from public.usuarios where id = v_uid;
  if not found then raise exception 'Perfil no encontrado' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'nombre', u.nombre_completo,
    'telefono', u.telefono,
    'nivel', u.nivel_voley,
    'rol', u.rol,
    'puntos', u.puntos_total,
    'partidos_jugados', u.partidos_jugados,
    'es_admin', u.rol in ('admin_global', 'superadmin'),
    'es_superadmin', u.rol = 'superadmin',
    'clubes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'slug', c.slug, 'rol', m.rol) order by c.nombre)
      from public.club_miembros m join public.clubes c on c.id = m.club_id
      where m.user_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.actualizar_mi_perfil(p_nombre text, p_nivel integer, p_telefono text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := private.exigir_sesion();
begin
  if p_nivel is null or p_nivel not between 1 and 10 then
    raise exception 'El nivel debe estar entre 1 y 10';
  end if;
  update public.usuarios
  set nombre_completo = private.texto(p_nombre, 'El nombre', 2, 80),
      nivel_voley = p_nivel,
      telefono = private.telefono(p_telefono)
  where id = v_uid;
  return public.mi_perfil();
end;
$$;

create or replace function public.mis_logros()
returns setof jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('id', b.id, 'nombre', b.nombre, 'descripcion', b.descripcion,
    'icono', b.icono, 'otorgado_at', ub.otorgado_at)
  from public.badges_catalogo b
  left join public.usuario_badges ub on ub.badge_id = b.id and ub.usuario_id = (select auth.uid())
  order by ub.otorgado_at desc nulls last, b.nombre
$$;

-- ---------------------------------------------------------------------------
-- Reservas del jugador
-- ---------------------------------------------------------------------------

create or replace function public.solicitar_reserva(
  p_horario_id integer,
  p_fecha date,
  p_partido jsonb default null,
  p_nota text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_puede_reservar();
  h public.horarios_semanales%rowtype;
  ca public.canchas%rowtype;
  cl public.clubes%rowtype;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_estado text;
  v_vence timestamptz;
  v_cliente bigint;
  v_id bigint;
  v_partido_id bigint;
  v_nota text;
  v_nombre text;
  v_min integer;
  v_max integer;
  v_invitados integer;
  v_nivel text;
  v_visibilidad text;
  v_aprobacion boolean;
  v_descripcion text;
  v_precio_jugador numeric;
begin
  select * into h from public.horarios_semanales where id = p_horario_id and activo;
  if not found then raise exception 'Ese horario ya no está publicado'; end if;
  select * into ca from public.canchas where id = h.cancha_id and activa;
  if not found then raise exception 'La cancha no está disponible'; end if;
  select * into cl from public.clubes where id = ca.club_id and publicado;
  if not found then raise exception 'El club no está recibiendo reservas'; end if;
  if p_fecha is null or extract(dow from p_fecha)::int <> h.dia_semana then
    raise exception 'La fecha no corresponde a ese horario';
  end if;

  v_inicio := private.instante_ar(p_fecha, h.hora_inicio);
  v_fin := private.instante_ar(p_fecha + case when h.hora_fin <= h.hora_inicio then 1 else 0 end, h.hora_fin);
  if v_inicio < pg_catalog.now() + make_interval(mins => cl.anticipacion_minima_min) then
    raise exception 'Ese horario ya no se puede pedir desde la app. Escribile al club.';
  end if;
  if p_fecha > private.hoy_ar() + cl.ventana_reserva_dias then
    raise exception 'Este club recibe pedidos hasta % días antes', cl.ventana_reserva_dias;
  end if;
  -- Los pedidos de una misma persona se serializan: los límites no se pueden
  -- saltear con solicitudes en paralelo.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 0));
  if (select count(*) from public.ocupaciones o
      where o.usuario_id = v_uid and o.estado = 'pendiente' and o.vence_at > pg_catalog.now()) >= 3 then
    raise exception 'Ya tenés 3 pedidos esperando respuesta. Esperá a que los clubes respondan.';
  end if;
  if (select count(*) from public.ocupaciones o
      where o.usuario_id = v_uid and o.origen = 'app' and o.inicio > pg_catalog.now()
        and (o.estado = 'confirmada' or (o.estado = 'pendiente' and o.vence_at > pg_catalog.now()))) >= 4 then
    raise exception 'Ya tenés 4 reservas activas pedidas desde la app. Cuando juegues o canceles alguna, podés pedir otra.';
  end if;
  if (select count(*) from public.ocupaciones o
      where o.usuario_id = v_uid and o.origen = 'app' and o.created_at > pg_catalog.now() - interval '24 hours') >= 8 then
    raise exception 'Hiciste muchos pedidos en las últimas 24 horas. Probá de nuevo más tarde.';
  end if;
  v_nota := private.texto(p_nota, 'La nota', 0, 300, true);

  if p_partido is not null then
    v_min := private.json_entero(p_partido, 'cupo_minimo', 12);
    v_max := private.json_entero(p_partido, 'cupo_maximo', 18);
    v_invitados := private.json_entero(p_partido, 'invitados', 0);
    v_nivel := coalesce(p_partido ->> 'nivel_requerido', 'recreativo');
    v_visibilidad := coalesce(p_partido ->> 'visibilidad', 'publico');
    v_aprobacion := private.json_booleano(p_partido, 'requiere_aprobacion', false);
    v_descripcion := private.texto(p_partido ->> 'descripcion', 'La descripción', 0, 500, true);
    v_precio_jugador := private.json_numero(p_partido, 'precio_por_jugador', null);
    if v_min < 2 or v_max < v_min or v_max > 22 then
      raise exception 'El cupo debe ser de 2 a 22 jugadores y el máximo no puede ser menor al mínimo';
    end if;
    if v_invitados < 0 or v_invitados >= v_max then
      raise exception 'Los invitados deben ser menos que el cupo máximo';
    end if;
    if v_nivel not in ('recreativo', 'intermedio', 'competitivo') then raise exception 'Nivel inválido'; end if;
    if v_visibilidad not in ('publico', 'enlace') then raise exception 'Visibilidad inválida'; end if;
    if v_precio_jugador is not null and v_precio_jugador < 0 then raise exception 'El precio por jugador no es válido'; end if;
  end if;

  perform private.expirar_vencidas(cl.id);
  v_cliente := private.cliente_de_usuario(cl.id, v_uid);
  v_estado := case when cl.confirmacion_automatica then 'confirmada' else 'pendiente' end;
  if v_estado = 'pendiente' then
    v_vence := least(pg_catalog.now() + make_interval(hours => cl.respuesta_horas), v_inicio - interval '15 minutes');
    if v_vence <= pg_catalog.now() then v_vence := v_inicio; end if;
  end if;

  begin
    insert into public.ocupaciones (club_id, cancha_id, inicio, fin, tipo, estado, origen, usuario_id,
      cliente_id, precio, sena, notas, vence_at, creada_por)
    values (cl.id, ca.id, v_inicio, v_fin, 'reserva', v_estado, 'app', v_uid,
      v_cliente, h.precio_total, h.precio_sena, v_nota, v_vence, v_uid)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Ese horario acaba de ser tomado. Elegí otro.';
  end;

  if p_partido is not null then
    insert into public.partidos (ocupacion_id, organizador_id, cupo_minimo, cupo_maximo,
      cantidad_invitados_anonimos, visibilidad, estado_partido, token_invitacion,
      nivel_requerido, requiere_aprobacion, descripcion, precio_por_jugador)
    values (v_id, v_uid, v_min, v_max, v_invitados, v_visibilidad,
      case when v_estado = 'confirmada' then 'abierto' else 'borrador' end,
      encode(extensions.gen_random_bytes(16), 'hex'), v_nivel, v_aprobacion, v_descripcion, v_precio_jugador)
    returning id into v_partido_id;
    insert into public.participantes_partido (partido_id, usuario_id, estado_inscripcion)
    values (v_partido_id, v_uid, 'confirmado');
  end if;

  select private.nombre_visible(u.nombre_completo, u.email) into v_nombre from public.usuarios u where u.id = v_uid;
  if v_estado = 'pendiente' then
    perform private.notificar_staff(cl.id, 'solicitud_nueva',
      'Pedido de ' || v_nombre || ': ' || ca.titulo || ', ' || private.fecha_legible(v_inicio),
      'Respondé antes de ' || private.fecha_legible(v_vence) || ' para no perder el pedido.',
      '/gestion/' || cl.id || '/agenda?fecha=' || p_fecha, v_id, true);
  else
    perform private.notificar_staff(cl.id, 'reserva_nueva',
      'Nueva reserva de ' || v_nombre || ': ' || ca.titulo || ', ' || private.fecha_legible(v_inicio),
      null, '/gestion/' || cl.id || '/agenda?fecha=' || p_fecha, v_id, false);
    perform private.notificar(v_uid, 'reserva_confirmada', '¡Reserva confirmada en ' || cl.nombre || '!',
      ca.titulo || ' · ' || private.fecha_legible(v_inicio), '/mis-reservas', cl.id, v_id, v_partido_id, true);
  end if;
  perform private.auditar(cl.id, 'reserva.solicitar', 'ocupacion', v_id::text,
    jsonb_build_object('estado', v_estado, 'partido_id', v_partido_id));

  return jsonb_build_object(
    'ocupacion_id', v_id,
    'estado', v_estado,
    'vence_at', v_vence,
    'partido_id', v_partido_id,
    'precio', h.precio_total,
    'sena', h.precio_sena,
    'club', jsonb_build_object('id', cl.id, 'nombre', cl.nombre, 'whatsapp', cl.whatsapp,
      'alias_pago', cl.alias_pago, 'titular_pago', cl.titular_pago)
  );
end;
$$;

create or replace function public.cancelar_mi_reserva(p_ocupacion_id bigint, p_motivo text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  o public.ocupaciones%rowtype;
  cl public.clubes%rowtype;
  v_motivo text := private.texto(p_motivo, 'El motivo', 0, 300);
  v_nombre text;
  v_partido record;
  r record;
begin
  select * into o from public.ocupaciones where id = p_ocupacion_id and usuario_id = v_uid for update;
  if not found then raise exception 'Reserva no encontrada' using errcode = 'P0002'; end if;
  if o.estado not in ('pendiente', 'confirmada') then raise exception 'La reserva ya no está activa'; end if;
  if o.inicio <= pg_catalog.now() then raise exception 'La reserva ya empezó'; end if;
  select * into cl from public.clubes where id = o.club_id;
  if o.estado = 'confirmada' and o.inicio - pg_catalog.now() < make_interval(hours => cl.cancelacion_horas) then
    raise exception 'Faltan menos de % horas: para cancelar escribile al club.', cl.cancelacion_horas;
  end if;

  update public.ocupaciones
  set estado = 'cancelada', cancelada_por = 'jugador', cancelada_at = pg_catalog.now(), motivo_cancelacion = v_motivo
  where id = o.id;

  for v_partido in
    update public.partidos set estado_partido = 'cancelado', cancelado_at = pg_catalog.now()
    where ocupacion_id = o.id and estado_partido not in ('cancelado', 'finalizado')
    returning id
  loop
    for r in
      select pp.usuario_id from public.participantes_partido pp
      where pp.partido_id = v_partido.id and pp.usuario_id <> v_uid and pp.estado_inscripcion <> 'rechazado'
    loop
      perform private.notificar(r.usuario_id, 'partido_cancelado', 'Se canceló un partido al que te anotaste',
        'El partido del ' || private.fecha_legible(o.inicio) || ' en ' || cl.nombre || ' no se juega.',
        '/partido/' || v_partido.id, cl.id, o.id, v_partido.id, true);
    end loop;
  end loop;

  select private.nombre_visible(u.nombre_completo, u.email) into v_nombre from public.usuarios u where u.id = v_uid;
  perform private.notificar_staff(cl.id, 'reserva_cancelada',
    v_nombre || ' canceló su ' || case when o.estado = 'pendiente' then 'pedido' else 'reserva' end
      || ' del ' || private.fecha_legible(o.inicio),
    case when o.pagado > 0 then 'Había pagado $' || o.pagado || ': queda una devolución pendiente.' else v_motivo end,
    '/gestion/' || cl.id || '/agenda?fecha=' || (o.inicio at time zone 'America/Argentina/Buenos_Aires')::date,
    o.id, o.estado = 'confirmada');
  perform private.auditar(cl.id, 'reserva.cancelar_jugador', 'ocupacion', o.id::text,
    jsonb_build_object('estado_previo', o.estado, 'motivo', v_motivo));
  return jsonb_build_object('estado', 'cancelada', 'a_devolver', greatest(o.pagado, 0));
end;
$$;

create or replace function public.informar_pago(p_ocupacion_id bigint)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  o public.ocupaciones%rowtype;
  v_nombre text;
begin
  select * into o from public.ocupaciones where id = p_ocupacion_id and usuario_id = v_uid for update;
  if not found then raise exception 'Reserva no encontrada' using errcode = 'P0002'; end if;
  if o.estado not in ('pendiente', 'confirmada') then raise exception 'La reserva ya no está activa'; end if;
  -- Un aviso cada 30 minutos como máximo.
  if o.pago_informado_at > pg_catalog.now() - interval '30 minutes' then return; end if;
  update public.ocupaciones set pago_informado_at = pg_catalog.now() where id = o.id;
  select private.nombre_visible(u.nombre_completo, u.email) into v_nombre from public.usuarios u where u.id = v_uid;
  perform private.notificar_staff(o.club_id, 'pago_informado',
    v_nombre || ' avisó que transfirió para el ' || private.fecha_legible(o.inicio),
    'Verificá la transferencia y registrá el pago en la agenda.',
    '/gestion/' || o.club_id || '/agenda?fecha=' || (o.inicio at time zone 'America/Argentina/Buenos_Aires')::date,
    o.id, false);
end;
$$;

create or replace function public.mis_reservas(p_historial boolean default false)
returns setof jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'inicio', o.inicio,
    'fin', o.fin,
    'estado', o.estado,
    'origen', o.origen,
    'precio', o.precio,
    'sena', o.sena,
    'pagado', o.pagado,
    'estado_pago', private.estado_pago(o.estado, o.precio, o.pagado),
    'vence_at', o.vence_at,
    'pago_informado_at', o.pago_informado_at,
    'motivo_cancelacion', o.motivo_cancelacion,
    'cancelada_por', o.cancelada_por,
    'es_fijo', o.serie_id is not null,
    'puede_cancelar', o.estado = 'pendiente' and o.inicio > pg_catalog.now()
      or (o.estado = 'confirmada' and o.inicio - pg_catalog.now() >= make_interval(hours => cl.cancelacion_horas)),
    'cancelacion_horas', cl.cancelacion_horas,
    'club', jsonb_build_object('id', cl.id, 'nombre', cl.nombre, 'slug', cl.slug, 'direccion', cl.direccion,
      'telefono', cl.telefono, 'whatsapp', cl.whatsapp,
      'alias_pago', case when o.estado in ('pendiente', 'confirmada') then cl.alias_pago end,
      'titular_pago', case when o.estado in ('pendiente', 'confirmada') then cl.titular_pago end),
    'cancha', jsonb_build_object('id', ca.id, 'titulo', ca.titulo),
    'partido', (select jsonb_build_object('id', pa.id, 'estado', pa.estado_partido)
      from public.partidos pa where pa.ocupacion_id = o.id)
  )
  from public.ocupaciones o
  join public.clubes cl on cl.id = o.club_id
  join public.canchas ca on ca.id = o.cancha_id
  where o.usuario_id = (select auth.uid())
    and o.tipo = 'reserva'
    and (case when p_historial then o.fin <= pg_catalog.now()
         else o.fin > pg_catalog.now() and (o.estado in ('pendiente', 'confirmada')
           or o.updated_at > pg_catalog.now() - interval '7 days') end)
  order by case when p_historial then null else o.inicio end asc, o.inicio desc
  limit 100
$$;

-- ---------------------------------------------------------------------------
-- Partidos
-- ---------------------------------------------------------------------------

create or replace function public.partido_unirse(p_partido_id bigint, p_token text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_puede_reservar();
  pa public.partidos%rowtype;
  o public.ocupaciones%rowtype;
  v_previo text;
  v_nivel integer;
  v_ocupados integer;
  v_estado text;
  v_nombre text;
  r record;
begin
  -- El bloqueo de la fila serializa inscripciones simultáneas al mismo partido.
  select * into pa from public.partidos where id = p_partido_id for update;
  if not found then raise exception 'Partido no encontrado' using errcode = 'P0002'; end if;
  if pa.visibilidad is distinct from 'publico'
     and (pa.token_invitacion is null or p_token is null or p_token <> pa.token_invitacion) then
    raise exception 'Partido no encontrado' using errcode = 'P0002';
  end if;
  select * into o from public.ocupaciones where id = pa.ocupacion_id;
  if not found or o.estado <> 'confirmada' or pa.estado_partido <> 'abierto' then
    raise exception 'Este partido no está recibiendo inscripciones';
  end if;
  if o.inicio <= pg_catalog.now() then raise exception 'El partido ya empezó'; end if;

  select pp.estado_inscripcion into v_previo
  from public.participantes_partido pp where pp.partido_id = pa.id and pp.usuario_id = v_uid;
  if v_previo = 'rechazado' then raise exception 'Quien organiza no aceptó tu inscripción a este partido'; end if;
  if v_previo is not null then raise exception 'Ya estás anotado en este partido'; end if;

  select u.nivel_voley, private.nombre_visible(u.nombre_completo, u.email) into v_nivel, v_nombre
  from public.usuarios u where u.id = v_uid;
  if coalesce(v_nivel, 1) < private.nivel_minimo(pa.nivel_requerido) then
    raise exception 'Este partido pide nivel %. Podés actualizar tu nivel en tu perfil.', pa.nivel_requerido;
  end if;

  v_ocupados := private.ocupados_partido(pa.id);
  if v_ocupados >= pa.cupo_maximo then raise exception 'El partido está completo'; end if;

  v_estado := case when pa.requiere_aprobacion then 'pendiente_aprobacion' else 'confirmado' end;
  insert into public.participantes_partido (partido_id, usuario_id, estado_inscripcion)
  values (pa.id, v_uid, v_estado);

  perform private.notificar_gestion_partido(pa,
    case when v_estado = 'confirmado' then 'nueva_inscripcion' else 'solicitud_inscripcion' end,
    case when v_estado = 'confirmado' then v_nombre || ' se sumó al partido del ' || private.fecha_legible(o.inicio)
      else v_nombre || ' quiere sumarse al partido del ' || private.fecha_legible(o.inicio) end,
    null, false);

  -- El aviso de "ya hay mínimo" sale una sola vez por partido.
  if v_estado = 'confirmado' and v_ocupados + 1 >= pa.cupo_minimo and pa.minimo_avisado_at is null then
    update public.partidos set minimo_avisado_at = pg_catalog.now() where id = pa.id;
    for r in
      select pp.usuario_id from public.participantes_partido pp
      where pp.partido_id = pa.id and pp.estado_inscripcion = 'confirmado'
    loop
      perform private.notificar(r.usuario_id, 'partido_minimo', '¡El partido ya tiene el mínimo de jugadores!',
        'Se juega el ' || private.fecha_legible(o.inicio) || '.', '/partido/' || pa.id, o.club_id, o.id, pa.id, true);
    end loop;
  end if;
  return jsonb_build_object('estado_inscripcion', v_estado);
end;
$$;

create or replace function public.partido_salir(p_partido_id bigint)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  pa public.partidos%rowtype;
  v_nombre text;
begin
  select * into pa from public.partidos where id = p_partido_id for update;
  if not found then raise exception 'Partido no encontrado' using errcode = 'P0002'; end if;
  if pa.club_id is null and pa.organizador_id = v_uid then
    raise exception 'Organizás este partido: transferí la organización o cancelalo.';
  end if;
  delete from public.participantes_partido
  where partido_id = pa.id and usuario_id = v_uid and estado_inscripcion <> 'rechazado';
  if not found then raise exception 'No estás anotado en este partido'; end if;
  select private.nombre_visible(u.nombre_completo, null) into v_nombre from public.usuarios u where u.id = v_uid;
  perform private.notificar_gestion_partido(pa, 'baja_partido', v_nombre || ' se bajó del partido', null, false);
end;
$$;

create or replace function public.partido_resolver_inscripcion(p_partido_id bigint, p_usuario_id uuid, p_aprobar boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  pa public.partidos%rowtype;
  o public.ocupaciones%rowtype;
begin
  select * into pa from public.partidos where id = p_partido_id for update;
  if not found then raise exception 'Partido no encontrado' using errcode = 'P0002'; end if;
  select * into o from public.ocupaciones where id = pa.ocupacion_id;
  if not private.gestiona_partido(pa) then
    raise exception 'Solo quien organiza puede aprobar inscripciones' using errcode = '42501';
  end if;
  update public.participantes_partido
  set estado_inscripcion = case when p_aprobar then 'confirmado' else 'rechazado' end
  where partido_id = pa.id and usuario_id = p_usuario_id and estado_inscripcion = 'pendiente_aprobacion';
  if not found then raise exception 'No hay una inscripción pendiente de esa persona'; end if;
  perform private.notificar(p_usuario_id,
    case when p_aprobar then 'inscripcion_aprobada' else 'inscripcion_rechazada' end,
    case when p_aprobar then '¡Te aceptaron en el partido!' else 'No te aceptaron en el partido' end,
    'Partido del ' || private.fecha_legible(o.inicio) || '.', '/partido/' || pa.id, o.club_id, o.id, pa.id, p_aprobar);
end;
$$;

create or replace function public.partido_transferir(p_partido_id bigint, p_usuario_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  pa public.partidos%rowtype;
begin
  select * into pa from public.partidos where id = p_partido_id for update;
  if not found then raise exception 'Partido no encontrado' using errcode = 'P0002'; end if;
  if pa.organizador_id is distinct from v_uid then
    raise exception 'Solo quien organiza puede transferir la organización' using errcode = '42501';
  end if;
  if pa.club_id is not null then raise exception 'Los partidos del club no se transfieren'; end if;
  if pa.estado_partido not in ('borrador', 'abierto', 'confirmado') then
    raise exception 'El partido ya no está activo';
  end if;
  if p_usuario_id = v_uid or not exists (
    select 1 from public.participantes_partido pp
    where pp.partido_id = pa.id and pp.usuario_id = p_usuario_id and pp.estado_inscripcion = 'confirmado') then
    raise exception 'Elegí a alguien confirmado en el partido';
  end if;
  update public.partidos set organizador_id = p_usuario_id where id = pa.id;
  perform private.notificar(p_usuario_id, 'nuevo_organizador', 'Ahora organizás un partido',
    'La reserva de la cancha sigue a nombre de quien la pidió.', '/partido/' || pa.id,
    null, pa.ocupacion_id, pa.id, true);
end;
$$;

create or replace function public.partido_actualizar(
  p_partido_id bigint,
  p_cupo_minimo integer,
  p_cupo_maximo integer,
  p_invitados integer,
  p_nivel text,
  p_visibilidad text,
  p_requiere_aprobacion boolean,
  p_descripcion text default null,
  p_precio_por_jugador numeric default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  pa public.partidos%rowtype;
  v_anotados integer;
begin
  select * into pa from public.partidos where id = p_partido_id for update;
  if not found then raise exception 'Partido no encontrado' using errcode = 'P0002'; end if;
  if not private.gestiona_partido(pa) then
    raise exception 'Solo quien organiza puede editar el partido' using errcode = '42501';
  end if;
  if pa.estado_partido not in ('borrador', 'abierto', 'confirmado') then raise exception 'El partido ya no está activo'; end if;
  if p_cupo_minimo is null or p_cupo_maximo is null or p_invitados is null or p_nivel is null
     or p_visibilidad is null or p_requiere_aprobacion is null then
    raise exception 'Completá todos los datos del partido';
  end if;
  if p_cupo_minimo < 2 or p_cupo_maximo < p_cupo_minimo or p_cupo_maximo > 22 then
    raise exception 'El cupo debe ser de 2 a 22 jugadores y el máximo no puede ser menor al mínimo';
  end if;
  if p_invitados < 0 or p_invitados >= p_cupo_maximo then raise exception 'Los invitados deben ser menos que el cupo máximo'; end if;
  if p_nivel not in ('recreativo', 'intermedio', 'competitivo') then raise exception 'Nivel inválido'; end if;
  if p_visibilidad not in ('publico', 'enlace') then raise exception 'Visibilidad inválida'; end if;
  if p_precio_por_jugador is not null and p_precio_por_jugador < 0 then raise exception 'El precio por jugador no es válido'; end if;
  select count(*) into v_anotados from public.participantes_partido pp
  where pp.partido_id = pa.id and pp.estado_inscripcion in ('confirmado', 'pendiente_aprobacion');
  if v_anotados + p_invitados > p_cupo_maximo then
    raise exception 'Ya hay % anotados: el cupo máximo no puede ser menor', v_anotados + p_invitados;
  end if;
  update public.partidos
  set cupo_minimo = p_cupo_minimo, cupo_maximo = p_cupo_maximo, cantidad_invitados_anonimos = p_invitados,
      nivel_requerido = p_nivel, visibilidad = p_visibilidad, requiere_aprobacion = p_requiere_aprobacion,
      descripcion = private.texto(p_descripcion, 'La descripción', 0, 500, true),
      precio_por_jugador = p_precio_por_jugador,
      -- Al pasar de público a "solo con enlace" el enlace anterior deja de servir.
      token_invitacion = case when pa.visibilidad = 'publico' and p_visibilidad <> 'publico'
        then encode(extensions.gen_random_bytes(16), 'hex') else token_invitacion end
  where id = pa.id;
end;
$$;

create or replace function public.partido_cancelar(p_partido_id bigint, p_motivo text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  pa public.partidos%rowtype;
  o public.ocupaciones%rowtype;
  cl public.clubes%rowtype;
  v_motivo text := private.texto(p_motivo, 'El motivo', 0, 300);
  r record;
begin
  select * into pa from public.partidos where id = p_partido_id for update;
  if not found then raise exception 'Partido no encontrado' using errcode = 'P0002'; end if;
  select * into o from public.ocupaciones where id = pa.ocupacion_id for update;
  select * into cl from public.clubes where id = o.club_id;
  if not private.gestiona_partido(pa) then
    raise exception 'Solo quien organiza puede cancelar el partido' using errcode = '42501';
  end if;
  if pa.estado_partido in ('cancelado', 'finalizado') then raise exception 'El partido ya no está activo'; end if;
  update public.partidos set estado_partido = 'cancelado', cancelado_at = pg_catalog.now() where id = pa.id;
  -- Un pedido de cancha todavía sin respuesta se retira junto con el partido.
  if o.estado = 'pendiente' then
    update public.ocupaciones
    set estado = 'cancelada', cancelada_por = 'jugador', cancelada_at = pg_catalog.now(),
        motivo_cancelacion = coalesce(v_motivo, 'Se canceló el partido')
    where id = o.id;
  end if;
  for r in
    select pp.usuario_id from public.participantes_partido pp
    where pp.partido_id = pa.id and pp.usuario_id <> v_uid and pp.estado_inscripcion <> 'rechazado'
  loop
    perform private.notificar(r.usuario_id, 'partido_cancelado', 'Se canceló un partido al que te anotaste',
      'El partido del ' || private.fecha_legible(o.inicio) || ' en ' || cl.nombre || ' no se juega.'
        || coalesce(' Motivo: ' || v_motivo, ''),
      '/partido/' || pa.id, cl.id, o.id, pa.id, true);
  end loop;
end;
$$;

create or replace function public.mis_partidos()
returns setof jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', pa.id,
    'estado_partido', pa.estado_partido,
    'visibilidad', pa.visibilidad,
    'nivel_requerido', pa.nivel_requerido,
    'cupo_minimo', pa.cupo_minimo,
    'cupo_maximo', pa.cupo_maximo,
    'ocupados', private.ocupados_partido(pa.id),
    'inicio', o.inicio,
    'fin', o.fin,
    'estado_reserva', o.estado,
    'soy_organizador', pa.club_id is null and pa.organizador_id = (select auth.uid()),
    'mi_estado', pp.estado_inscripcion,
    'club', jsonb_build_object('id', cl.id, 'nombre', cl.nombre, 'slug', cl.slug, 'zona', cl.zona),
    'cancha', jsonb_build_object('id', ca.id, 'titulo', ca.titulo)
  )
  from public.partidos pa
  join public.ocupaciones o on o.id = pa.ocupacion_id
  join public.clubes cl on cl.id = o.club_id
  join public.canchas ca on ca.id = o.cancha_id
  left join public.participantes_partido pp on pp.partido_id = pa.id and pp.usuario_id = (select auth.uid())
  -- Los partidos que publica un club se gestionan desde su agenda, no acá.
  where ((pa.club_id is null and pa.organizador_id = (select auth.uid())) or pp.usuario_id is not null)
    and o.fin > pg_catalog.now() - interval '30 days'
  order by o.inicio desc
  limit 100
$$;

drop function if exists public.enviar_mensaje(bigint, text);
create or replace function public.enviar_mensaje(p_partido_id bigint, p_texto text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  v_texto text := private.texto(p_texto, 'El mensaje', 1, 500, true);
  v_mensaje public.mensajes_partido%rowtype;
begin
  if not exists (
    select 1 from public.partidos pa
    where pa.id = p_partido_id and (private.gestiona_partido(pa) or exists (
      select 1 from public.participantes_partido pp
      where pp.partido_id = pa.id and pp.usuario_id = v_uid and pp.estado_inscripcion = 'confirmado'))
  ) then
    raise exception 'Solo las personas confirmadas pueden escribir en el partido' using errcode = '42501';
  end if;
  if (select count(*) from public.mensajes_partido m
      where m.usuario_id = v_uid and m.created_at > pg_catalog.now() - interval '1 minute') >= 10 then
    raise exception 'Estás enviando muchos mensajes. Esperá un momento.';
  end if;
  insert into public.mensajes_partido (partido_id, usuario_id, texto)
  values (p_partido_id, v_uid, v_texto)
  returning * into v_mensaje;
  return jsonb_build_object('id', v_mensaje.id, 'texto', v_mensaje.texto, 'created_at', v_mensaje.created_at);
end;
$$;

create or replace function public.mensajes_partido(p_partido_id bigint, p_antes_de bigint default null, p_limite integer default 50)
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := private.exigir_sesion();
begin
  if not exists (
    select 1 from public.partidos pa
    left join public.ocupaciones o on o.id = pa.ocupacion_id
    where pa.id = p_partido_id and (private.gestiona_partido(pa)
      or private.rol_en_club(o.club_id) is not null
      or exists (select 1 from public.participantes_partido pp
        where pp.partido_id = pa.id and pp.usuario_id = v_uid and pp.estado_inscripcion = 'confirmado'))
  ) then
    raise exception 'Solo las personas confirmadas ven los mensajes del partido' using errcode = '42501';
  end if;
  return query
  select jsonb_build_object(
    'id', m.id,
    'texto', m.texto,
    'created_at', m.created_at,
    'autor', private.nombre_visible(u.nombre_completo, null),
    'es_mio', m.usuario_id = v_uid
  )
  from public.mensajes_partido m
  join public.usuarios u on u.id = m.usuario_id
  where m.partido_id = p_partido_id and (p_antes_de is null or m.id < p_antes_de)
  order by m.id desc
  limit least(greatest(coalesce(p_limite, 50), 1), 100);
end;
$$;

-- ---------------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------------

drop function if exists public.mis_notificaciones();
create or replace function public.mis_notificaciones(p_limite integer default 30)
returns setof jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('id', n.id, 'tipo', n.tipo, 'titulo', n.titulo, 'cuerpo', n.cuerpo,
    'url', n.url, 'partido_id', n.partido_id, 'leida', n.leida, 'created_at', n.created_at)
  from public.notificaciones n
  where n.usuario_id = (select auth.uid())
  order by n.created_at desc
  limit least(greatest(coalesce(p_limite, 30), 1), 100)
$$;

create or replace function public.notificaciones_sin_leer()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int from public.notificaciones n
  where n.usuario_id = (select auth.uid()) and not n.leida
$$;

create or replace function public.marcar_notificacion_leida(p_notificacion_id bigint)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := private.exigir_sesion();
begin
  update public.notificaciones set leida = true where id = p_notificacion_id and usuario_id = v_uid;
end;
$$;

create or replace function public.marcar_todas_leidas()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := private.exigir_sesion();
begin
  update public.notificaciones set leida = true where usuario_id = v_uid and not leida;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitaciones al equipo de un club
-- ---------------------------------------------------------------------------

create or replace function public.aceptar_invitacion_club(p_token text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  inv public.club_invitaciones%rowtype;
  v_email text;
  v_club text;
begin
  select * into inv from public.club_invitaciones
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if not found or inv.revocada_at is not null then raise exception 'La invitación no existe o fue revocada'; end if;
  if inv.aceptada_at is not null then raise exception 'La invitación ya fue usada'; end if;
  if inv.expira_at <= pg_catalog.now() then raise exception 'La invitación venció. Pedí una nueva al club.'; end if;
  select u.email into v_email from public.usuarios u where u.id = v_uid;
  if lower(coalesce(v_email, '')) <> lower(inv.email) then
    raise exception 'Esta invitación es para otra dirección de email. Ingresá con la cuenta invitada.' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users au where au.id = v_uid and au.email_confirmed_at is not null) then
    raise exception 'Confirmá tu email antes de aceptar la invitación' using errcode = '42501';
  end if;
  insert into public.club_miembros (club_id, user_id, rol, created_by)
  values (inv.club_id, v_uid, inv.rol, inv.creada_por)
  on conflict (club_id, user_id) do update set rol = case
    when public.club_miembros.rol = 'dueno' then 'dueno' else excluded.rol end;
  update public.club_invitaciones set aceptada_at = pg_catalog.now(), aceptada_por = v_uid where id = inv.id;
  select c.nombre into v_club from public.clubes c where c.id = inv.club_id;
  perform private.notificar_staff(inv.club_id, 'equipo_nuevo', v_email || ' se sumó al equipo de ' || v_club,
    null, '/gestion/' || inv.club_id || '/ajustes', null, false);
  perform private.auditar(inv.club_id, 'equipo.aceptar_invitacion', 'miembro', v_uid::text,
    jsonb_build_object('rol', inv.rol));
  return jsonb_build_object('club_id', inv.club_id, 'club_nombre', v_club, 'rol', inv.rol);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

do $$
declare
  firma text;
begin
  -- Cualquier visitante.
  foreach firma in array array[
    'public.estado_operacion()',
    'public.disponibilidad(bigint,bigint,date,date)',
    'public.explorar_partidos(text,text,double precision,double precision,integer,integer)',
    'public.partido_detalle(bigint,text)',
    'public.buscar_partido_por_token(text)',
    'public.ranking(integer)',
    'public.ver_invitacion_club(text)'
  ] loop
    execute format('revoke all on function %s from public', firma);
    execute format('grant execute on function %s to anon, authenticated', firma);
  end loop;
  -- Solo con sesión.
  foreach firma in array array[
    'public.mi_perfil()',
    'public.actualizar_mi_perfil(text,integer,text)',
    'public.mis_logros()',
    'public.solicitar_reserva(integer,date,jsonb,text)',
    'public.cancelar_mi_reserva(bigint,text)',
    'public.informar_pago(bigint)',
    'public.mis_reservas(boolean)',
    'public.partido_unirse(bigint,text)',
    'public.partido_salir(bigint)',
    'public.partido_resolver_inscripcion(bigint,uuid,boolean)',
    'public.partido_transferir(bigint,uuid)',
    'public.partido_actualizar(bigint,integer,integer,integer,text,text,boolean,text,numeric)',
    'public.partido_cancelar(bigint,text)',
    'public.mis_partidos()',
    'public.enviar_mensaje(bigint,text)',
    'public.mensajes_partido(bigint,bigint,integer)',
    'public.mis_notificaciones(integer)',
    'public.notificaciones_sin_leer()',
    'public.marcar_notificacion_leida(bigint)',
    'public.marcar_todas_leidas()',
    'public.aceptar_invitacion_club(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', firma);
    execute format('grant execute on function %s to authenticated', firma);
  end loop;
end $$;
