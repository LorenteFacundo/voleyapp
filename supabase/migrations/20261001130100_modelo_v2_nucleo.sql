-- Núcleo del modelo v2: funciones internas (esquema private, no expuesto por
-- la API) que usan las RPC públicas. Todas fijan search_path vacío y
-- califican cada objeto.

-- ---------------------------------------------------------------------------
-- Tiempo, textos y formatos
-- ---------------------------------------------------------------------------

create or replace function private.hoy_ar()
returns date
language sql stable
set search_path = ''
as $$
  select (pg_catalog.now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- Instante real de una fecha y hora de pared en Buenos Aires.
create or replace function private.instante_ar(p_fecha date, p_hora time)
returns timestamptz
language sql stable
set search_path = ''
as $$
  select (p_fecha + p_hora) at time zone 'America/Argentina/Buenos_Aires'
$$;

create or replace function private.fecha_legible(p_instante timestamptz)
returns text
language sql stable
set search_path = ''
as $$
  select (array['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'])[extract(dow from l)::int + 1]
    || ' ' || pg_catalog.to_char(l, 'DD/MM HH24:MI')
  from (select p_instante at time zone 'America/Argentina/Buenos_Aires' as l) x
$$;

create or replace function private.nombre_visible(p_nombre text, p_email text)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when length(btrim(coalesce(p_nombre, ''))) >= 2 then left(btrim(p_nombre), 120)
    when length(split_part(coalesce(p_email, ''), '@', 1)) >= 2 then left(split_part(p_email, '@', 1), 120)
    else 'Jugador'
  end
$$;

-- Limpia un texto libre: recorta, colapsa espacios (salvo multilinea) y
-- valida largo. Devuelve null si queda vacío y no es obligatorio.
create or replace function private.texto(
  p_texto text, p_campo text, p_min integer, p_max integer, p_multilinea boolean default false
)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare v text;
begin
  v := case when p_multilinea
    then pg_catalog.regexp_replace(coalesce(p_texto, ''), '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', 'g')
    else pg_catalog.regexp_replace(coalesce(p_texto, ''), '[\s\x01-\x1f\x7f]+', ' ', 'g')
  end;
  v := nullif(btrim(v), '');
  if v is null then
    if p_min > 0 then raise exception '% es obligatorio', p_campo; end if;
    return null;
  end if;
  if length(v) < p_min then raise exception '% debe tener al menos % caracteres', p_campo, p_min; end if;
  if length(v) > p_max then raise exception '% no puede superar % caracteres', p_campo, p_max; end if;
  return v;
end;
$$;

create or replace function private.telefono(p_telefono text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare v text := pg_catalog.regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g');
begin
  if v = '' then return null; end if;
  if length(v) < 8 or length(v) > 15 then
    raise exception 'El teléfono debe tener entre 8 y 15 dígitos';
  end if;
  return v;
end;
$$;

create or replace function private.email(p_email text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare v text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if v is null then return null; end if;
  if v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v) > 254 then
    raise exception 'El email no es válido';
  end if;
  return v;
end;
$$;

create or replace function private.estado_pago(p_estado text, p_precio numeric, p_pagado numeric)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when p_estado in ('cancelada', 'rechazada', 'vencida') then
      case when p_pagado > 0 then 'a_devolver' else 'sin_cargo' end
    when p_precio <= 0 then 'sin_cargo'
    when p_pagado >= p_precio then 'pagado'
    when p_pagado > 0 then 'parcial'
    else 'pendiente'
  end
$$;

create or replace function private.nivel_minimo(p_nivel text)
returns integer
language sql immutable
set search_path = ''
as $$
  select case p_nivel when 'intermedio' then 4 when 'competitivo' then 7 else 1 end
$$;

-- ---------------------------------------------------------------------------
-- Identidad y permisos
-- ---------------------------------------------------------------------------

create or replace function private.exigir_sesion()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'Iniciá sesión para continuar' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- 'dueno', 'encargado' o null. El admin global actúa como dueño de cualquier club.
create or replace function private.rol_en_club(p_club_id bigint)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null or p_club_id is null then null
    when (select private.is_admin_global()) then 'dueno'
    else (
      select m.rol from public.club_miembros m
      where m.club_id = p_club_id and m.user_id = (select auth.uid())
    )
  end
$$;

create or replace function private.exigir_staff(p_club_id bigint, p_solo_dueno boolean default false)
returns text
language plpgsql stable
set search_path = ''
as $$
declare v_rol text := private.rol_en_club(p_club_id);
begin
  if v_rol is null then
    raise exception 'No tenés permiso para gestionar este club' using errcode = '42501';
  end if;
  if p_solo_dueno and v_rol <> 'dueno' then
    raise exception 'Solo el dueño del club puede hacer esto' using errcode = '42501';
  end if;
  return v_rol;
end;
$$;

-- Jugadores: sesión, email confirmado, reservas no pausadas y, durante el
-- piloto, cuenta habilitada. El admin global puede probar siempre.
create or replace function private.exigir_puede_reservar()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sesion();
  v_conf public.app_config%rowtype;
begin
  if private.is_admin_global() then return v_uid; end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'Confirmá tu email antes de reservar' using errcode = '42501';
  end if;
  select * into v_conf from public.app_config where id;
  if coalesce(v_conf.reservas_pausadas, true) then
    raise exception '%', coalesce(nullif(v_conf.motivo_pausa, ''), 'Las reservas están pausadas por el momento')
      using errcode = '55000';
  end if;
  if coalesce(v_conf.requiere_lista_acceso, true)
     and not exists (select 1 from public.acceso_piloto a where a.usuario_id = v_uid) then
    raise exception 'Tu cuenta todavía no está habilitada para reservar durante el piloto' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoría y notificaciones
-- ---------------------------------------------------------------------------

create or replace function private.auditar(
  p_club_id bigint, p_accion text, p_entidad text, p_entidad_id text, p_detalle jsonb default '{}'::jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.auditoria (club_id, actor_id, accion, entidad, entidad_id, detalle)
  values (p_club_id, auth.uid(), p_accion, p_entidad, p_entidad_id, coalesce(p_detalle, '{}'::jsonb))
$$;

create or replace function private.notificar(
  p_usuario_id uuid,
  p_tipo text,
  p_titulo text,
  p_cuerpo text default null,
  p_url text default null,
  p_club_id bigint default null,
  p_ocupacion_id bigint default null,
  p_partido_id bigint default null,
  p_email boolean default false
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
  v_email text;
begin
  if p_usuario_id is null then return; end if;
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, url, club_id, ocupacion_id, partido_id)
  values (p_usuario_id, p_tipo, left(p_titulo, 200), left(p_cuerpo, 1000), p_url, p_club_id, p_ocupacion_id, p_partido_id)
  returning id into v_id;
  if p_email then
    select u.email into v_email from public.usuarios u where u.id = p_usuario_id;
    if v_email is not null then
      insert into public.envios_notificacion (notificacion_id, canal, destino, asunto, cuerpo, url)
      values (v_id, 'email', v_email, left(p_titulo, 200), coalesce(left(p_cuerpo, 1000), left(p_titulo, 200)), p_url);
    end if;
  end if;
end;
$$;

create or replace function private.notificar_staff(
  p_club_id bigint,
  p_tipo text,
  p_titulo text,
  p_cuerpo text,
  p_url text,
  p_ocupacion_id bigint default null,
  p_email boolean default false
)
returns void
language plpgsql
set search_path = ''
as $$
declare r record;
begin
  for r in
    select m.user_id from public.club_miembros m
    where m.club_id = p_club_id and m.user_id is distinct from auth.uid()
  loop
    perform private.notificar(r.user_id, p_tipo, p_titulo, p_cuerpo, p_url, p_club_id, p_ocupacion_id, null, p_email);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clientes y ocupaciones
-- ---------------------------------------------------------------------------

-- Registro del jugador en la agenda de contactos del club (se crea al reservar).
create or replace function private.cliente_de_usuario(p_club_id bigint, p_usuario_id uuid)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_id bigint;
  v_u record;
begin
  select u.nombre_completo, u.email, u.telefono into v_u from public.usuarios u where u.id = p_usuario_id;
  if not found then return null; end if;
  insert into public.clientes_club as c (club_id, nombre, telefono, email, usuario_id)
  values (
    p_club_id,
    private.nombre_visible(v_u.nombre_completo, v_u.email),
    v_u.telefono,
    case when v_u.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_u.email end,
    p_usuario_id
  )
  on conflict (club_id, usuario_id) do update
    set telefono = coalesce(c.telefono, excluded.telefono),
        email = coalesce(c.email, excluded.email),
        archivado = false
  returning c.id into v_id;
  return v_id;
end;
$$;

-- Las solicitudes vencidas liberan el horario. Se ejecuta antes de crear o
-- mover ocupaciones y, si está disponible, periódicamente con pg_cron.
create or replace function private.expirar_vencidas(p_club_id bigint default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_total integer := 0;
begin
  for r in
    update public.ocupaciones o
    set estado = 'vencida',
        cancelada_por = 'sistema',
        cancelada_at = pg_catalog.now(),
        motivo_cancelacion = 'El club no respondió a tiempo'
    where o.estado = 'pendiente'
      and o.vence_at <= pg_catalog.now()
      and (p_club_id is null or o.club_id = p_club_id)
    returning o.id, o.usuario_id, o.club_id, o.inicio
  loop
    v_total := v_total + 1;
    update public.partidos
    set estado_partido = 'cancelado', cancelado_at = pg_catalog.now()
    where ocupacion_id = r.id and estado_partido not in ('cancelado', 'finalizado');
    perform private.notificar(
      r.usuario_id, 'reserva_vencida', 'Tu solicitud venció',
      'El club no respondió a tiempo tu pedido para el ' || private.fecha_legible(r.inicio)
        || '. Podés elegir otro horario.',
      '/mis-reservas', r.club_id, r.id, null, true);
  end loop;
  return v_total;
end;
$$;

-- Mantiene ocupaciones.pagado como suma de pagos vigentes.
create or replace function private.sincronizar_pagado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_ids bigint[];
begin
  v_ids := array_remove(array[
    case when tg_op <> 'INSERT' then old.ocupacion_id end,
    case when tg_op <> 'DELETE' then new.ocupacion_id end
  ], null);
  if cardinality(v_ids) > 0 then
    update public.ocupaciones o
    set pagado = coalesce((
      select sum(p.monto) from public.pagos p
      where p.ocupacion_id = o.id and p.anulado_at is null
    ), 0)
    where o.id = any (v_ids);
  end if;
  return null;
end;
$$;

drop trigger if exists pagos_sincronizar on public.pagos;
create trigger pagos_sincronizar after insert or update or delete on public.pagos
  for each row execute function private.sincronizar_pagado();

-- ---------------------------------------------------------------------------
-- Alquileres fijos
-- ---------------------------------------------------------------------------

-- Hasta dónde se generan las fechas de los fijos. Supera la ventana máxima de
-- reserva de los jugadores (60 días), así un jugador nunca toma el lugar de
-- un fijo antes de que exista en la agenda.
create or replace function private.horizonte_series()
returns date
language sql stable
set search_path = ''
as $$
  select private.hoy_ar() + 84
$$;

create or replace function private.fechas_serie(p_dia integer, p_desde date, p_hasta date)
returns setof date
language sql immutable
set search_path = ''
as $$
  select d::date
  from pg_catalog.generate_series(
    (p_desde + ((p_dia - extract(dow from p_desde)::int + 7) % 7))::timestamp,
    p_hasta::timestamp,
    interval '7 days') d
$$;

-- Fechas en las que una serie chocaría con otras ocupaciones vigentes.
create or replace function private.conflictos_serie(
  p_cancha_id bigint, p_dia integer, p_hora time, p_duracion integer,
  p_desde date, p_hasta date, p_excluir_serie bigint default null
)
returns table (fecha date, detalle text)
language sql stable
set search_path = ''
as $$
  select f.fecha,
    coalesce(o.titulo, c.nombre, case o.tipo when 'bloqueo' then 'Bloqueo' else 'Reserva' end)
      || ' (' || pg_catalog.to_char(o.inicio at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI')
      || '–' || pg_catalog.to_char(o.fin at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') || ')'
  from private.fechas_serie(
    p_dia,
    greatest(p_desde, private.hoy_ar()),
    least(coalesce(p_hasta, private.horizonte_series()), private.horizonte_series())
  ) as f(fecha)
  join public.ocupaciones o
    on o.cancha_id = p_cancha_id
   and o.estado in ('pendiente', 'confirmada')
   and (p_excluir_serie is null or o.serie_id is distinct from p_excluir_serie)
   and tstzrange(o.inicio, o.fin, '[)') && tstzrange(
         private.instante_ar(f.fecha, p_hora),
         private.instante_ar(f.fecha, p_hora) + make_interval(mins => p_duracion), '[)')
  left join public.clientes_club c on c.id = o.cliente_id
  where private.instante_ar(f.fecha, p_hora) > pg_catalog.now()
  order by f.fecha
$$;

-- Genera las fechas futuras de un fijo hasta el horizonte. Las fechas que
-- chocan con otra ocupación se omiten y se informan.
create or replace function private.materializar_serie(p_serie_id bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.series%rowtype;
  v_fecha date;
  v_inicio timestamptz;
  v_usuario uuid;
  v_creadas integer := 0;
  v_conflictos date[] := '{}';
begin
  select * into s from public.series where id = p_serie_id for update;
  if not found or not s.activa then
    return jsonb_build_object('creadas', 0, 'conflictos', '[]'::jsonb);
  end if;
  select c.usuario_id into v_usuario from public.clientes_club c where c.id = s.cliente_id;
  for v_fecha in
    select f from private.fechas_serie(
      s.dia_semana,
      greatest(s.desde, private.hoy_ar()),
      least(coalesce(s.hasta, private.horizonte_series()), private.horizonte_series())
    ) as f
  loop
    v_inicio := private.instante_ar(v_fecha, s.hora_inicio);
    continue when v_inicio <= pg_catalog.now();
    continue when exists (select 1 from public.ocupaciones o where o.serie_id = s.id and o.inicio = v_inicio);
    begin
      insert into public.ocupaciones (club_id, cancha_id, inicio, fin, tipo, estado, origen,
        usuario_id, cliente_id, serie_id, titulo, precio, creada_por)
      values (s.club_id, s.cancha_id, v_inicio, v_inicio + make_interval(mins => s.duracion_min),
        'reserva', 'confirmada', 'fijo', v_usuario, s.cliente_id, s.id, s.titulo, s.precio, s.creada_por);
      v_creadas := v_creadas + 1;
    exception when exclusion_violation then
      v_conflictos := v_conflictos || v_fecha;
    end;
  end loop;
  return jsonb_build_object('creadas', v_creadas, 'conflictos', to_jsonb(v_conflictos));
end;
$$;

-- Cancela las fechas futuras de un fijo desde una fecha. Si alguna ya fue
-- cobrada no se toca nada: el club primero registra la devolución o la mueve.
create or replace function private.cancelar_fechas_serie(p_serie_id bigint, p_desde date, p_motivo text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_cobradas text;
  v_total integer;
begin
  select string_agg(private.fecha_legible(o.inicio), ', ' order by o.inicio) into v_cobradas
  from public.ocupaciones o
  where o.serie_id = p_serie_id and o.estado = 'confirmada' and o.pagado > 0
    and o.inicio >= private.instante_ar(p_desde, time '00:00');
  if v_cobradas is not null then
    raise exception 'Hay fechas futuras ya cobradas (%). Registrá la devolución o movelas antes de cambiar el fijo.', v_cobradas;
  end if;
  update public.ocupaciones o
  set estado = 'cancelada', cancelada_por = 'club', cancelada_at = pg_catalog.now(), motivo_cancelacion = p_motivo
  where o.serie_id = p_serie_id and o.estado in ('pendiente', 'confirmada')
    and o.inicio >= private.instante_ar(p_desde, time '00:00');
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Partidos: cupo, puntos y logros
-- ---------------------------------------------------------------------------

create or replace function private.ocupados_partido(p_partido_id bigint)
returns integer
language sql stable
set search_path = ''
as $$
  select (
    select count(*)::int from public.participantes_partido pp
    where pp.partido_id = p_partido_id and pp.estado_inscripcion in ('confirmado', 'pendiente_aprobacion')
  ) + coalesce((select p.cantidad_invitados_anonimos from public.partidos p where p.id = p_partido_id), 0)
$$;

create or replace function private.otorgar_puntos(p_usuario_id uuid, p_puntos integer, p_motivo text, p_referencia bigint)
returns void
language sql
set search_path = ''
as $$
  insert into public.puntos_actividad (usuario_id, puntos, motivo, referencia_id)
  values (p_usuario_id, p_puntos, p_motivo, p_referencia);
  update public.usuarios set puntos_total = puntos_total + p_puntos where id = p_usuario_id;
$$;

create or replace function private.verificar_logros(p_usuario_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_jugados integer;
  v_organizados integer;
  v_nivel integer;
  v_racha integer;
  v_logro text;
  v_logros text[] := '{}';
begin
  select count(*) into v_jugados
  from public.participantes_partido pp join public.partidos p on p.id = pp.partido_id
  where pp.usuario_id = p_usuario_id and pp.estado_inscripcion = 'confirmado' and p.estado_partido = 'finalizado';
  select count(*) into v_organizados
  from public.partidos p where p.organizador_id = p_usuario_id and p.estado_partido = 'finalizado';
  select u.nivel_voley into v_nivel from public.usuarios u where u.id = p_usuario_id;
  -- Tres partidos seguidos con no más de una semana entre cada uno.
  select count(*) into v_racha from (
    select o.inicio, lag(o.inicio) over (order by o.inicio desc) as siguiente
    from public.participantes_partido pp
    join public.partidos p on p.id = pp.partido_id
    join public.ocupaciones o on o.id = p.ocupacion_id
    where pp.usuario_id = p_usuario_id and pp.estado_inscripcion = 'confirmado' and p.estado_partido = 'finalizado'
    order by o.inicio desc limit 3
  ) t where t.siguiente is not null and t.siguiente - t.inicio <= interval '7 days';

  if v_jugados >= 1 then v_logros := array_append(v_logros, 'primer_partido'); end if;
  if v_jugados >= 10 then v_logros := array_append(v_logros, 'sociable'); end if;
  if v_jugados >= 25 then v_logros := array_append(v_logros, 'veterano'); end if;
  if v_organizados >= 5 then v_logros := array_append(v_logros, 'organizador_nato'); end if;
  if coalesce(v_nivel, 0) >= 8 then v_logros := array_append(v_logros, 'nivel_alto'); end if;
  if v_racha >= 2 then v_logros := array_append(v_logros, 'racha_3'); end if;

  foreach v_logro in array v_logros loop
    if exists (select 1 from public.badges_catalogo b where b.id = v_logro) then
      insert into public.usuario_badges (usuario_id, badge_id) values (p_usuario_id, v_logro)
      on conflict (usuario_id, badge_id) do nothing;
      if found then
        perform private.notificar(p_usuario_id, 'logro',
          '¡Nuevo logro: ' || (select b.nombre from public.badges_catalogo b where b.id = v_logro) || '!',
          null, '/perfil');
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tareas periódicas
-- ---------------------------------------------------------------------------

-- Cierra partidos ya jugados: suma puntos y partidos jugados una sola vez.
create or replace function private.finalizar_partidos()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  r record;
  p record;
  v_total integer := 0;
begin
  for r in
    select pa.id, pa.organizador_id, pa.club_id
    from public.partidos pa join public.ocupaciones o on o.id = pa.ocupacion_id
    where pa.estado_partido in ('abierto', 'confirmado', 'pre_reservado')
      and o.estado = 'confirmada' and o.fin < pg_catalog.now()
    for update of pa skip locked
  loop
    update public.partidos set estado_partido = 'finalizado', finalizado_at = pg_catalog.now() where id = r.id;
    for p in
      select pp.usuario_id from public.participantes_partido pp
      where pp.partido_id = r.id and pp.estado_inscripcion = 'confirmado'
    loop
      perform private.otorgar_puntos(p.usuario_id, 10, 'partido_jugado', r.id);
      update public.usuarios set partidos_jugados = partidos_jugados + 1 where id = p.usuario_id;
    end loop;
    -- Los partidos abiertos que organiza un club no suman puntos a su staff.
    if r.organizador_id is not null and r.club_id is null then
      perform private.otorgar_puntos(r.organizador_id, 5, 'partido_organizado', r.id);
    end if;
    for p in
      select distinct x.usuario_id from (
        select pp.usuario_id from public.participantes_partido pp
        where pp.partido_id = r.id and pp.estado_inscripcion = 'confirmado'
        union select case when r.club_id is null then r.organizador_id end
      ) x where x.usuario_id is not null
    loop
      perform private.verificar_logros(p.usuario_id);
    end loop;
    v_total := v_total + 1;
  end loop;

  -- Partidos cuya reserva ya no está vigente.
  update public.partidos pa
  set estado_partido = 'cancelado', cancelado_at = pg_catalog.now()
  from public.ocupaciones o
  where o.id = pa.ocupacion_id
    and o.estado in ('cancelada', 'rechazada', 'vencida')
    and pa.estado_partido not in ('cancelado', 'finalizado');
  return v_total;
end;
$$;

-- Recordatorio el día anterior para reservas de la app y jugadores anotados.
create or replace function private.encolar_recordatorios()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  r record;
  p record;
  v_total integer := 0;
  v_cuerpo text;
begin
  for r in
    select o.id, o.usuario_id, o.club_id, o.inicio, ca.titulo as cancha, cl.nombre as club,
      cl.direccion, pa.id as partido_id
    from public.ocupaciones o
    join public.canchas ca on ca.id = o.cancha_id
    join public.clubes cl on cl.id = o.club_id
    left join public.partidos pa on pa.ocupacion_id = o.id and pa.estado_partido in ('abierto', 'confirmado')
    where o.estado = 'confirmada' and o.tipo = 'reserva' and o.recordatorio_at is null
      and o.inicio between pg_catalog.now() + interval '20 hours' and pg_catalog.now() + interval '28 hours'
    for update of o skip locked
  loop
    v_cuerpo := r.cancha || ' · ' || private.fecha_legible(r.inicio) || coalesce(' · ' || r.direccion, '');
    perform private.notificar(r.usuario_id, 'recordatorio', 'Mañana jugás en ' || r.club, v_cuerpo,
      case when r.partido_id is not null then '/partido/' || r.partido_id else '/mis-reservas' end,
      r.club_id, r.id, r.partido_id, true);
    if r.partido_id is not null then
      for p in
        select pp.usuario_id from public.participantes_partido pp
        where pp.partido_id = r.partido_id and pp.estado_inscripcion = 'confirmado'
          and pp.usuario_id is distinct from r.usuario_id
      loop
        perform private.notificar(p.usuario_id, 'recordatorio', 'Mañana jugás en ' || r.club, v_cuerpo,
          '/partido/' || r.partido_id, r.club_id, r.id, r.partido_id, true);
      end loop;
    end if;
    update public.ocupaciones set recordatorio_at = pg_catalog.now() where id = r.id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

-- Genera fechas de fijos que entraron al horizonte y avisa conflictos nuevos.
create or replace function private.materializar_series()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  s record;
  v_resultado jsonb;
  v_nuevos text;
  v_total integer := 0;
begin
  for s in
    select se.id, se.club_id, se.titulo from public.series se
    where se.activa and (se.hasta is null or se.hasta >= private.hoy_ar())
  loop
    v_resultado := private.materializar_serie(s.id);
    v_total := v_total + (v_resultado ->> 'creadas')::int;
    select string_agg(to_char(f::date, 'DD/MM'), ', ') into v_nuevos
    from jsonb_array_elements_text(v_resultado -> 'conflictos') f
    where f::date > private.horizonte_series() - 7;
    if v_nuevos is not null then
      perform private.notificar_staff(s.club_id, 'fijo_conflicto',
        'No se pudo agendar el fijo "' || s.titulo || '"',
        'La cancha ya está ocupada el ' || v_nuevos || '. Revisá la agenda.', null, null, true);
    end if;
  end loop;
  return v_total;
end;
$$;

create or replace function private.procesar_tareas()
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'vencidas', private.expirar_vencidas(null),
    'partidos_finalizados', private.finalizar_partidos(),
    'recordatorios', private.encolar_recordatorios()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Alta de usuarios desde Auth
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_nivel_texto text := new.raw_user_meta_data ->> 'nivel_voley';
  v_telefono text := pg_catalog.regexp_replace(coalesce(new.raw_user_meta_data ->> 'telefono', ''), '[^0-9]', '', 'g');
begin
  insert into public.usuarios (id, email, nombre_completo, nivel_voley, rol, telefono)
  values (
    new.id,
    new.email,
    private.nombre_visible(new.raw_user_meta_data ->> 'nombre_completo', new.email),
    case when v_nivel_texto ~ '^[0-9]{1,2}$' then least(greatest(v_nivel_texto::int, 1), 10) else 3 end,
    'jugador',
    case when v_telefono ~ '^[0-9]{8,15}$' then v_telefono end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.usuarios set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Fotos de canchas en Storage: el dueño gestiona la carpeta de su club.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "Dueños suben fotos de su club" on storage.objects;
    drop policy if exists "Dueños actualizan fotos de su club" on storage.objects;
    drop policy if exists "Dueños eliminan fotos de su club" on storage.objects;
    create policy "Dueños suben fotos de su club" on storage.objects for insert to authenticated
      with check (bucket_id = 'canchas-fotos'
        and private.rol_en_club(private.club_de_ruta_foto(name)) = 'dueno');
    create policy "Dueños actualizan fotos de su club" on storage.objects for update to authenticated
      using (bucket_id = 'canchas-fotos' and private.rol_en_club(private.club_de_ruta_foto(name)) = 'dueno')
      with check (bucket_id = 'canchas-fotos' and private.rol_en_club(private.club_de_ruta_foto(name)) = 'dueno');
    create policy "Dueños eliminan fotos de su club" on storage.objects for delete to authenticated
      using (bucket_id = 'canchas-fotos' and private.rol_en_club(private.club_de_ruta_foto(name)) = 'dueno');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos: nada de este archivo es invocable directamente por clientes,
-- salvo el helper que usan las políticas de Storage.
-- ---------------------------------------------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
  end loop;
end $$;

grant execute on function private.is_admin_global() to authenticated;
grant execute on function private.rol_en_club(bigint) to authenticated;
grant execute on function private.club_de_ruta_foto(text) to authenticated;
