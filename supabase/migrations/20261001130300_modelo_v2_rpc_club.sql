-- RPC del panel de gestión de clubes (dueños y encargados).

-- ---------------------------------------------------------------------------
-- Representaciones y validaciones compartidas
-- ---------------------------------------------------------------------------

create or replace function private.ocupacion_json(o public.ocupaciones)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'cancha_id', o.cancha_id,
    'inicio', o.inicio,
    'fin', o.fin,
    'tipo', o.tipo,
    'estado', o.estado,
    'origen', o.origen,
    'titulo', o.titulo,
    'precio', o.precio,
    'sena', o.sena,
    'pagado', o.pagado,
    'estado_pago', private.estado_pago(o.estado, o.precio, o.pagado),
    'asistencia', o.asistencia,
    'notas', o.notas,
    'vence_at', o.vence_at,
    'pago_informado_at', o.pago_informado_at,
    'motivo_cancelacion', o.motivo_cancelacion,
    'cancelada_por', o.cancelada_por,
    'serie_id', o.serie_id,
    'created_at', o.created_at,
    'cliente', (
      select jsonb_build_object('id', c.id, 'nombre', c.nombre, 'telefono', c.telefono, 'email', c.email,
        'es_usuario_app', c.usuario_id is not null)
      from public.clientes_club c where c.id = o.cliente_id),
    'jugador', (
      select jsonb_build_object('nombre', private.nombre_visible(u.nombre_completo, u.email),
        'email', u.email, 'telefono', u.telefono)
      from public.usuarios u where u.id = o.usuario_id),
    'partido', (
      select jsonb_build_object('id', pa.id, 'estado', pa.estado_partido, 'ocupados', private.ocupados_partido(pa.id),
        'cupo_minimo', pa.cupo_minimo, 'cupo_maximo', pa.cupo_maximo, 'organiza_club', pa.club_id is not null)
      from public.partidos pa where pa.ocupacion_id = o.id)
  )
$$;

create or replace function private.cliente_json(c public.clientes_club)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'nombre', c.nombre,
    'telefono', c.telefono,
    'email', c.email,
    'notas', c.notas,
    'archivado', c.archivado,
    'es_usuario_app', c.usuario_id is not null,
    'created_at', c.created_at
  )
$$;

-- Saldo de un cliente: pagos registrados menos reservas confirmadas que ya
-- empezaron. Negativo = debe; positivo = saldo a favor.
create or replace function private.saldo_cliente(p_cliente_id bigint)
returns numeric
language sql stable
set search_path = ''
as $$
  select coalesce((select sum(p.monto) from public.pagos p
                   where p.cliente_id = p_cliente_id and p.anulado_at is null), 0)
       - coalesce((select sum(o.precio) from public.ocupaciones o
                   where o.cliente_id = p_cliente_id and o.tipo = 'reserva'
                     and o.estado = 'confirmada' and o.inicio <= pg_catalog.now()), 0)
$$;

-- Período de una ocupación cargada por el club: múltiplos de 5 minutos.
create or replace function private.validar_periodo(p_inicio timestamptz, p_fin timestamptz, p_max interval)
returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then
    raise exception 'El horario de fin debe ser posterior al de inicio';
  end if;
  if p_fin - p_inicio < interval '15 minutes' then raise exception 'La reserva debe durar al menos 15 minutos'; end if;
  if p_fin - p_inicio > p_max then raise exception 'La duración supera el máximo permitido'; end if;
  if extract(epoch from p_inicio)::bigint % 300 <> 0 or extract(epoch from p_fin)::bigint % 300 <> 0 then
    raise exception 'Usá horarios en múltiplos de 5 minutos';
  end if;
end;
$$;

-- Devuelve el cliente indicado o lo crea a partir de nombre y teléfono
-- (reutilizando uno existente con el mismo teléfono).
create or replace function private.resolver_cliente(
  p_club_id bigint, p_cliente_id bigint, p_nombre text, p_telefono text
)
returns public.clientes_club
language plpgsql
set search_path = ''
as $$
declare
  c public.clientes_club%rowtype;
  v_nombre text;
  v_telefono text;
begin
  if p_cliente_id is not null then
    select * into c from public.clientes_club where id = p_cliente_id and club_id = p_club_id;
    if not found then raise exception 'El cliente no pertenece a este club'; end if;
    return c;
  end if;
  v_nombre := private.texto(p_nombre, 'El nombre del cliente', 0, 120);
  if v_nombre is null then return null; end if;
  if length(v_nombre) < 2 then raise exception 'El nombre del cliente debe tener al menos 2 caracteres'; end if;
  v_telefono := private.telefono(p_telefono);
  if v_telefono is not null then
    select * into c from public.clientes_club
    where club_id = p_club_id and telefono = v_telefono
    order by archivado, id limit 1;
    if found then
      if c.archivado then
        update public.clientes_club set archivado = false where id = c.id returning * into c;
      end if;
      return c;
    end if;
  end if;
  insert into public.clientes_club (club_id, nombre, telefono)
  values (p_club_id, v_nombre, v_telefono)
  returning * into c;
  return c;
end;
$$;

-- Cancela una ocupación, su partido y avisa a quienes corresponde.
create or replace function private.cancelar_ocupacion(p_ocupacion_id bigint, p_motivo text, p_por text)
returns public.ocupaciones
language plpgsql
set search_path = ''
as $$
declare
  o public.ocupaciones%rowtype;
  cl public.clubes%rowtype;
  v_partido record;
  r record;
begin
  update public.ocupaciones
  set estado = 'cancelada', cancelada_por = p_por, cancelada_at = pg_catalog.now(), motivo_cancelacion = p_motivo
  where id = p_ocupacion_id and estado in ('pendiente', 'confirmada')
  returning * into o;
  if not found then raise exception 'La reserva ya no está activa'; end if;
  select * into cl from public.clubes where id = o.club_id;
  for v_partido in
    update public.partidos set estado_partido = 'cancelado', cancelado_at = pg_catalog.now()
    where ocupacion_id = o.id and estado_partido not in ('cancelado', 'finalizado')
    returning id
  loop
    for r in
      select pp.usuario_id from public.participantes_partido pp
      where pp.partido_id = v_partido.id and pp.estado_inscripcion <> 'rechazado'
        and pp.usuario_id is distinct from o.usuario_id
    loop
      perform private.notificar(r.usuario_id, 'partido_cancelado', 'Se canceló un partido al que te anotaste',
        'El partido del ' || private.fecha_legible(o.inicio) || ' en ' || cl.nombre || ' no se juega.'
          || coalesce(' Motivo: ' || p_motivo, ''),
        '/partido/' || v_partido.id, cl.id, o.id, v_partido.id, true);
    end loop;
  end loop;
  if o.tipo = 'reserva' and o.usuario_id is not null and o.serie_id is null then
    perform private.notificar(o.usuario_id, 'reserva_cancelada_club',
      cl.nombre || ' canceló tu reserva del ' || private.fecha_legible(o.inicio),
      coalesce('Motivo: ' || p_motivo || '. ', '')
        || case when o.pagado > 0 then 'El club te va a contactar por la devolución.' else 'Podés elegir otro horario.' end,
      '/mis-reservas', cl.id, o.id, null, true);
  end if;
  return o;
end;
$$;

-- ---------------------------------------------------------------------------
-- Panel y agenda
-- ---------------------------------------------------------------------------

create or replace function public.club_panel(p_club_id bigint)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rol text := private.exigir_staff(p_club_id);
  cl public.clubes%rowtype;
begin
  select * into cl from public.clubes where id = p_club_id;
  if not found then raise exception 'Club no encontrado' using errcode = 'P0002'; end if;
  perform private.expirar_vencidas(p_club_id);
  return jsonb_build_object(
    'mi_rol', v_rol,
    'club', jsonb_build_object(
      'id', cl.id, 'nombre', cl.nombre, 'slug', cl.slug, 'direccion', cl.direccion, 'zona', cl.zona,
      'telefono', cl.telefono, 'whatsapp', cl.whatsapp, 'instagram', cl.instagram, 'descripcion', cl.descripcion,
      'alias_pago', cl.alias_pago, 'titular_pago', cl.titular_pago, 'latitud', cl.latitud, 'longitud', cl.longitud,
      'publicado', cl.publicado, 'confirmacion_automatica', cl.confirmacion_automatica,
      'anticipacion_minima_min', cl.anticipacion_minima_min, 'ventana_reserva_dias', cl.ventana_reserva_dias,
      'cancelacion_horas', cl.cancelacion_horas, 'respuesta_horas', cl.respuesta_horas, 'politicas', cl.politicas),
    'canchas', coalesce((
      select jsonb_agg(jsonb_build_object('id', ca.id, 'titulo', ca.titulo, 'descripcion', ca.descripcion,
          'precio_total', ca.precio_total, 'precio_sena', ca.precio_sena, 'techada', ca.techada,
          'superficie', ca.superficie, 'activa', ca.activa, 'orden', ca.orden, 'fotos', ca.fotos)
        order by ca.orden, ca.titulo, ca.id)
      from public.canchas ca where ca.club_id = p_club_id), '[]'::jsonb),
    'horarios', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'cancha_id', h.cancha_id, 'dia_semana', h.dia_semana,
          'hora_inicio', pg_catalog.to_char(h.hora_inicio, 'HH24:MI'), 'hora_fin', pg_catalog.to_char(h.hora_fin, 'HH24:MI'),
          'precio_total', h.precio_total, 'precio_sena', h.precio_sena, 'activo', h.activo)
        order by h.cancha_id, h.dia_semana, h.hora_inicio)
      from public.horarios_semanales h join public.canchas ca on ca.id = h.cancha_id
      where ca.club_id = p_club_id), '[]'::jsonb),
    'pendientes', (select count(*) from public.ocupaciones o
      where o.club_id = p_club_id and o.estado = 'pendiente' and o.vence_at > pg_catalog.now()),
    'pagos_informados', (select count(*) from public.ocupaciones o
      where o.club_id = p_club_id and o.estado in ('pendiente', 'confirmada')
        and o.pago_informado_at is not null and o.pagado < o.precio)
  );
end;
$$;

create or replace function public.club_agenda(
  p_club_id bigint, p_desde date, p_hasta date, p_incluir_canceladas boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_staff(p_club_id);
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta > p_desde + 42 then
    raise exception 'Elegí un rango de hasta 6 semanas';
  end if;
  perform private.expirar_vencidas(p_club_id);
  return jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'ocupaciones', coalesce((
      select jsonb_agg(private.ocupacion_json(o) order by o.inicio, o.cancha_id)
      from public.ocupaciones o
      where o.club_id = p_club_id
        and o.inicio < private.instante_ar(p_hasta + 1, time '00:00')
        and o.fin > private.instante_ar(p_desde, time '00:00')
        and (p_incluir_canceladas or o.estado in ('pendiente', 'confirmada'))
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.club_pendientes(p_club_id bigint)
returns setof jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_staff(p_club_id);
  perform private.expirar_vencidas(p_club_id);
  return query
  select private.ocupacion_json(o) from public.ocupaciones o
  where o.club_id = p_club_id and o.estado = 'pendiente'
  order by o.vence_at, o.inicio;
end;
$$;

create or replace function public.club_crear_reserva(
  p_club_id bigint,
  p_cancha_id bigint,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_cliente_id bigint default null,
  p_cliente_nombre text default null,
  p_cliente_telefono text default null,
  p_origen text default 'whatsapp',
  p_precio numeric default null,
  p_titulo text default null,
  p_notas text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  ca public.canchas%rowtype;
  c public.clientes_club%rowtype;
  o public.ocupaciones%rowtype;
  v_titulo text := private.texto(p_titulo, 'El título', 0, 120);
  v_precio numeric;
begin
  perform private.exigir_staff(p_club_id);
  select * into ca from public.canchas where id = p_cancha_id and club_id = p_club_id;
  if not found then raise exception 'La cancha no pertenece a este club'; end if;
  perform private.validar_periodo(p_inicio, p_fin, interval '12 hours');
  if p_inicio < pg_catalog.now() - interval '30 days' or p_inicio > pg_catalog.now() + interval '400 days' then
    raise exception 'La fecha está fuera del rango permitido';
  end if;
  if p_origen not in ('whatsapp', 'telefono', 'mostrador', 'otro') then raise exception 'Origen inválido'; end if;
  c := private.resolver_cliente(p_club_id, p_cliente_id, p_cliente_nombre, p_cliente_telefono);
  if c.id is null and v_titulo is null then
    raise exception 'Indicá el cliente o un nombre para la reserva';
  end if;
  if p_precio is not null and p_precio < 0 then raise exception 'El precio no puede ser negativo'; end if;
  v_precio := coalesce(p_precio, (
    select h.precio_total from public.horarios_semanales h
    where h.cancha_id = ca.id and h.activo
      and h.dia_semana = extract(dow from p_inicio at time zone 'America/Argentina/Buenos_Aires')::int
      and h.hora_inicio = (p_inicio at time zone 'America/Argentina/Buenos_Aires')::time
      and h.hora_fin = (p_fin at time zone 'America/Argentina/Buenos_Aires')::time
    limit 1), 0);

  perform private.expirar_vencidas(p_club_id);
  begin
    insert into public.ocupaciones (club_id, cancha_id, inicio, fin, tipo, estado, origen, usuario_id,
      cliente_id, titulo, precio, notas, creada_por)
    values (p_club_id, ca.id, p_inicio, p_fin, 'reserva', 'confirmada', p_origen, c.usuario_id,
      c.id, v_titulo, v_precio, private.texto(p_notas, 'La nota', 0, 500, true), auth.uid())
    returning * into o;
  exception when exclusion_violation then
    raise exception 'Se superpone con otra reserva o bloqueo en esa cancha';
  end;

  if o.usuario_id is not null then
    perform private.notificar(o.usuario_id, 'reserva_registrada',
      (select cl.nombre from public.clubes cl where cl.id = p_club_id) || ' registró una reserva a tu nombre',
      ca.titulo || ' · ' || private.fecha_legible(o.inicio), '/mis-reservas', p_club_id, o.id, null, false);
  end if;
  perform private.auditar(p_club_id, 'reserva.crear', 'ocupacion', o.id::text,
    jsonb_build_object('origen', p_origen, 'inicio', o.inicio, 'cancha_id', o.cancha_id));
  return private.ocupacion_json(o);
end;
$$;

create or replace function public.club_conflictos(
  p_club_id bigint, p_canchas bigint[], p_inicio timestamptz, p_fin timestamptz
)
returns setof jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_staff(p_club_id);
  return query
  select private.ocupacion_json(o) from public.ocupaciones o
  where o.club_id = p_club_id and o.cancha_id = any (p_canchas)
    and o.estado in ('pendiente', 'confirmada')
    and tstzrange(o.inicio, o.fin, '[)') && tstzrange(p_inicio, p_fin, '[)')
  order by o.inicio;
end;
$$;

-- Bloquea canchas (lluvia, feriado, torneo). Si hay reservas, solo procede
-- con confirmación explícita: las cancela y devuelve los afectados para
-- avisarles por WhatsApp a quienes no usan la app.
create or replace function public.club_bloquear(
  p_club_id bigint,
  p_canchas bigint[],
  p_inicio timestamptz,
  p_fin timestamptz,
  p_motivo text,
  p_cancelar_reservas boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_motivo text := private.texto(p_motivo, 'El motivo', 2, 120);
  v_cancha bigint;
  v_reservas integer;
  v_bloqueo text;
  v_afectadas jsonb := '[]'::jsonb;
  v_creados integer := 0;
  r record;
  v_cancelada public.ocupaciones%rowtype;
begin
  perform private.exigir_staff(p_club_id);
  if p_canchas is null or cardinality(p_canchas) = 0 then raise exception 'Elegí al menos una cancha'; end if;
  if (select count(distinct ca.id) from public.canchas ca where ca.id = any (p_canchas) and ca.club_id = p_club_id)
     <> (select count(distinct x) from unnest(p_canchas) x) then
    raise exception 'Alguna cancha no pertenece a este club';
  end if;
  perform private.validar_periodo(p_inicio, p_fin, interval '7 days');
  perform private.expirar_vencidas(p_club_id);

  select string_agg(ca.titulo, ', ') into v_bloqueo
  from public.ocupaciones o join public.canchas ca on ca.id = o.cancha_id
  where o.cancha_id = any (p_canchas) and o.tipo = 'bloqueo' and o.estado = 'confirmada'
    and tstzrange(o.inicio, o.fin, '[)') && tstzrange(p_inicio, p_fin, '[)');
  if v_bloqueo is not null then
    raise exception 'Ya hay un bloqueo en ese horario (%)', v_bloqueo;
  end if;

  select count(*) into v_reservas from public.ocupaciones o
  where o.cancha_id = any (p_canchas) and o.tipo = 'reserva' and o.estado in ('pendiente', 'confirmada')
    and tstzrange(o.inicio, o.fin, '[)') && tstzrange(p_inicio, p_fin, '[)');
  if v_reservas > 0 and not coalesce(p_cancelar_reservas, false) then
    raise exception 'Hay % reserva(s) en ese horario. Confirmá si querés cancelarlas.', v_reservas;
  end if;

  for r in
    select o.id from public.ocupaciones o
    where o.cancha_id = any (p_canchas) and o.tipo = 'reserva' and o.estado in ('pendiente', 'confirmada')
      and tstzrange(o.inicio, o.fin, '[)') && tstzrange(p_inicio, p_fin, '[)')
    order by o.inicio
    for update
  loop
    v_cancelada := private.cancelar_ocupacion(r.id, v_motivo, 'club');
    v_afectadas := v_afectadas || private.ocupacion_json(v_cancelada);
  end loop;

  foreach v_cancha in array (select array_agg(distinct x) from unnest(p_canchas) x) loop
    insert into public.ocupaciones (club_id, cancha_id, inicio, fin, tipo, estado, origen, titulo, creada_por)
    values (p_club_id, v_cancha, p_inicio, p_fin, 'bloqueo', 'confirmada', 'otro', v_motivo, auth.uid());
    v_creados := v_creados + 1;
  end loop;

  perform private.auditar(p_club_id, 'agenda.bloquear', 'ocupacion', null,
    jsonb_build_object('canchas', p_canchas, 'inicio', p_inicio, 'fin', p_fin, 'motivo', v_motivo,
      'reservas_canceladas', jsonb_array_length(v_afectadas)));
  return jsonb_build_object('bloqueos', v_creados, 'canceladas', v_afectadas);
end;
$$;

create or replace function public.club_resolver_solicitud(
  p_ocupacion_id bigint, p_confirmar boolean, p_motivo text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.ocupaciones%rowtype;
  cl public.clubes%rowtype;
  ca public.canchas%rowtype;
  v_motivo text := private.texto(p_motivo, 'El motivo', 0, 300);
  v_partido bigint;
begin
  select * into o from public.ocupaciones where id = p_ocupacion_id for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode = 'P0002'; end if;
  perform private.exigir_staff(o.club_id);
  if o.estado <> 'pendiente' then raise exception 'La solicitud ya fue resuelta'; end if;
  if o.vence_at <= pg_catalog.now() then
    perform private.expirar_vencidas(o.club_id);
    return jsonb_build_object('estado', 'vencida');
  end if;
  select * into cl from public.clubes where id = o.club_id;
  select * into ca from public.canchas where id = o.cancha_id;
  select pa.id into v_partido from public.partidos pa where pa.ocupacion_id = o.id;

  if p_confirmar then
    update public.ocupaciones set estado = 'confirmada' where id = o.id;
    update public.partidos set estado_partido = 'abierto' where id = v_partido and estado_partido = 'borrador';
    perform private.notificar(o.usuario_id, 'reserva_confirmada', '¡' || cl.nombre || ' confirmó tu reserva!',
      ca.titulo || ' · ' || private.fecha_legible(o.inicio)
        || case when o.sena > 0 and cl.alias_pago is not null
             then '. Seña: $' || o.sena || ' al alias ' || cl.alias_pago || '.' else '.' end,
      case when v_partido is not null then '/partido/' || v_partido else '/mis-reservas' end,
      cl.id, o.id, v_partido, true);
  else
    update public.ocupaciones
    set estado = 'rechazada', cancelada_por = 'club', cancelada_at = pg_catalog.now(), motivo_cancelacion = v_motivo
    where id = o.id;
    update public.partidos set estado_partido = 'cancelado', cancelado_at = pg_catalog.now()
    where id = v_partido and estado_partido not in ('cancelado', 'finalizado');
    perform private.notificar(o.usuario_id, 'reserva_rechazada', cl.nombre || ' no pudo confirmar tu pedido',
      ca.titulo || ' · ' || private.fecha_legible(o.inicio) || coalesce('. Motivo: ' || v_motivo, '')
        || '. Probá con otro horario.',
      '/mis-reservas', cl.id, o.id, v_partido, true);
  end if;
  perform private.auditar(o.club_id, case when p_confirmar then 'reserva.confirmar' else 'reserva.rechazar' end,
    'ocupacion', o.id::text, jsonb_build_object('motivo', v_motivo));
  return jsonb_build_object('estado', case when p_confirmar then 'confirmada' else 'rechazada' end);
end;
$$;

create or replace function public.club_cancelar_ocupacion(p_ocupacion_id bigint, p_motivo text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.ocupaciones%rowtype;
  v_motivo text := private.texto(p_motivo, 'El motivo', 0, 300);
begin
  select * into o from public.ocupaciones where id = p_ocupacion_id for update;
  if not found then raise exception 'Reserva no encontrada' using errcode = 'P0002'; end if;
  perform private.exigir_staff(o.club_id);
  o := private.cancelar_ocupacion(o.id, v_motivo, 'club');
  perform private.auditar(o.club_id,
    case when o.tipo = 'bloqueo' then 'agenda.desbloquear' else 'reserva.cancelar_club' end,
    'ocupacion', o.id::text, jsonb_build_object('motivo', v_motivo, 'pagado', o.pagado));
  return private.ocupacion_json(o);
end;
$$;

create or replace function public.club_mover_ocupacion(
  p_ocupacion_id bigint, p_cancha_id bigint, p_inicio timestamptz, p_fin timestamptz
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.ocupaciones%rowtype;
  ca public.canchas%rowtype;
  cl public.clubes%rowtype;
  v_antes jsonb;
begin
  select * into o from public.ocupaciones where id = p_ocupacion_id for update;
  if not found then raise exception 'Reserva no encontrada' using errcode = 'P0002'; end if;
  perform private.exigir_staff(o.club_id);
  if o.estado not in ('pendiente', 'confirmada') then raise exception 'La reserva ya no está activa'; end if;
  select * into ca from public.canchas where id = p_cancha_id and club_id = o.club_id;
  if not found then raise exception 'La cancha no pertenece a este club'; end if;
  perform private.validar_periodo(p_inicio, p_fin,
    case when o.tipo = 'bloqueo' then interval '7 days' else interval '12 hours' end);
  v_antes := jsonb_build_object('cancha_id', o.cancha_id, 'inicio', o.inicio, 'fin', o.fin);
  perform private.expirar_vencidas(o.club_id);
  begin
    update public.ocupaciones set cancha_id = ca.id, inicio = p_inicio, fin = p_fin
    where id = o.id returning * into o;
  exception when exclusion_violation then
    raise exception 'Se superpone con otra reserva o bloqueo en esa cancha';
  end;
  if o.tipo = 'reserva' and o.usuario_id is not null then
    select * into cl from public.clubes where id = o.club_id;
    perform private.notificar(o.usuario_id, 'reserva_movida', cl.nombre || ' cambió el horario de tu reserva',
      'Ahora es ' || ca.titulo || ' · ' || private.fecha_legible(o.inicio) || '.', '/mis-reservas',
      cl.id, o.id, null, true);
  end if;
  perform private.auditar(o.club_id, 'reserva.mover', 'ocupacion', o.id::text,
    jsonb_build_object('antes', v_antes, 'despues',
      jsonb_build_object('cancha_id', o.cancha_id, 'inicio', o.inicio, 'fin', o.fin)));
  return private.ocupacion_json(o);
end;
$$;

-- Cambios puntuales: solo se modifican las claves presentes en p_cambios
-- (precio, sena, notas, titulo, asistencia, cliente_id).
create or replace function public.club_actualizar_ocupacion(p_ocupacion_id bigint, p_cambios jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.ocupaciones%rowtype;
  c public.clientes_club%rowtype;
begin
  select * into o from public.ocupaciones where id = p_ocupacion_id for update;
  if not found then raise exception 'Reserva no encontrada' using errcode = 'P0002'; end if;
  perform private.exigir_staff(o.club_id);
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' then raise exception 'Cambios inválidos'; end if;

  if p_cambios ? 'precio' then
    o.precio := private.json_numero(p_cambios, 'precio', 0);
    if o.precio < 0 then raise exception 'El precio no puede ser negativo'; end if;
  end if;
  if p_cambios ? 'sena' then
    o.sena := private.json_numero(p_cambios, 'sena', 0);
    if o.sena < 0 then raise exception 'La seña no puede ser negativa'; end if;
  end if;
  if p_cambios ? 'notas' then o.notas := private.texto(p_cambios ->> 'notas', 'La nota', 0, 500, true); end if;
  if p_cambios ? 'titulo' then o.titulo := private.texto(p_cambios ->> 'titulo', 'El título', 0, 120); end if;
  if p_cambios ? 'asistencia' then
    if o.inicio > pg_catalog.now() then raise exception 'La asistencia se marca cuando el turno ya empezó'; end if;
    o.asistencia := nullif(p_cambios ->> 'asistencia', '');
    if o.asistencia is not null and o.asistencia not in ('jugaron', 'no_vinieron') then
      raise exception 'Asistencia inválida';
    end if;
  end if;
  if p_cambios ? 'cliente_id' then
    if o.origen = 'app' then raise exception 'Las reservas hechas desde la app conservan su cliente'; end if;
    if nullif(p_cambios ->> 'cliente_id', '') is null then
      o.cliente_id := null;
      o.usuario_id := null;
    else
      c := private.resolver_cliente(o.club_id, private.json_entero(p_cambios, 'cliente_id', null)::bigint, null, null);
      o.cliente_id := c.id;
      o.usuario_id := c.usuario_id;
    end if;
  end if;

  update public.ocupaciones
  set precio = o.precio, sena = o.sena, notas = o.notas, titulo = o.titulo, asistencia = o.asistencia,
      cliente_id = o.cliente_id, usuario_id = o.usuario_id
  where id = o.id
  returning * into o;
  perform private.auditar(o.club_id, 'reserva.editar', 'ocupacion', o.id::text, p_cambios);
  return private.ocupacion_json(o);
end;
$$;

-- ---------------------------------------------------------------------------
-- Pagos, caja y deudas
-- ---------------------------------------------------------------------------

create or replace function public.club_registrar_pago(
  p_club_id bigint,
  p_monto numeric,
  p_medio text,
  p_ocupacion_id bigint default null,
  p_cliente_id bigint default null,
  p_fecha date default null,
  p_nota text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  o public.ocupaciones%rowtype;
  c public.clientes_club%rowtype;
  v_cliente bigint := p_cliente_id;
  v_fecha date := coalesce(p_fecha, private.hoy_ar());
  v_id bigint;
begin
  perform private.exigir_staff(p_club_id);
  if p_monto is null or p_monto = 0 or abs(p_monto) > 100000000 then raise exception 'Ingresá un monto válido'; end if;
  if p_medio not in ('efectivo', 'transferencia', 'mercadopago', 'tarjeta', 'otro') then raise exception 'Medio de pago inválido'; end if;
  if v_fecha < private.hoy_ar() - 60 or v_fecha > private.hoy_ar() + 1 then
    raise exception 'La fecha del pago debe estar dentro de los últimos 60 días';
  end if;
  if p_ocupacion_id is not null then
    select * into o from public.ocupaciones where id = p_ocupacion_id and club_id = p_club_id for update;
    if not found then raise exception 'La reserva no pertenece a este club'; end if;
    if p_cliente_id is not null and p_cliente_id is distinct from o.cliente_id then
      raise exception 'El cliente no coincide con el de la reserva';
    end if;
    v_cliente := o.cliente_id;
  elsif v_cliente is null then
    raise exception 'Indicá la reserva o el cliente del pago';
  end if;
  if v_cliente is not null then
    c := private.resolver_cliente(p_club_id, v_cliente, null, null);
  end if;
  insert into public.pagos (club_id, ocupacion_id, cliente_id, monto, medio, fecha, nota, registrado_por)
  values (p_club_id, p_ocupacion_id, v_cliente, round(p_monto, 2), p_medio, v_fecha,
    private.texto(p_nota, 'La nota', 0, 300), auth.uid())
  returning id into v_id;
  perform private.auditar(p_club_id, 'pago.registrar', 'pago', v_id::text,
    jsonb_build_object('monto', p_monto, 'medio', p_medio, 'ocupacion_id', p_ocupacion_id, 'cliente_id', v_cliente));
  return jsonb_build_object(
    'pago_id', v_id,
    'ocupacion', case when p_ocupacion_id is not null then (
      select private.ocupacion_json(x) from public.ocupaciones x where x.id = p_ocupacion_id) end,
    'saldo_cliente', case when v_cliente is not null then private.saldo_cliente(v_cliente) end
  );
end;
$$;

create or replace function public.club_anular_pago(p_pago_id bigint)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare p public.pagos%rowtype;
begin
  select * into p from public.pagos where id = p_pago_id for update;
  if not found then raise exception 'Pago no encontrado' using errcode = 'P0002'; end if;
  perform private.exigir_staff(p.club_id, true);
  if p.anulado_at is not null then raise exception 'El pago ya estaba anulado'; end if;
  update public.pagos set anulado_at = pg_catalog.now(), anulado_por = auth.uid() where id = p.id;
  perform private.auditar(p.club_id, 'pago.anular', 'pago', p.id::text,
    jsonb_build_object('monto', p.monto, 'medio', p.medio));
end;
$$;

create or replace function public.club_caja(p_club_id bigint, p_desde date, p_hasta date)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_staff(p_club_id, true);
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta > p_desde + 93 then
    raise exception 'Elegí un rango de hasta 3 meses';
  end if;
  return jsonb_build_object(
    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'fecha', p.fecha, 'monto', p.monto, 'medio', p.medio, 'nota', p.nota,
          'anulado', p.anulado_at is not null, 'created_at', p.created_at,
          'cliente', case when c.id is not null then jsonb_build_object('id', c.id, 'nombre', c.nombre) end,
          'ocupacion', case when o.id is not null then jsonb_build_object('id', o.id, 'inicio', o.inicio,
            'cancha', ca.titulo, 'titulo', o.titulo) end,
          'registrado_por', private.nombre_visible(u.nombre_completo, u.email)
        ) order by p.fecha desc, p.id desc)
      from public.pagos p
      left join public.clientes_club c on c.id = p.cliente_id
      left join public.ocupaciones o on o.id = p.ocupacion_id
      left join public.canchas ca on ca.id = o.cancha_id
      left join public.usuarios u on u.id = p.registrado_por
      where p.club_id = p_club_id and p.fecha between p_desde and p_hasta
    ), '[]'::jsonb),
    'totales', (
      select jsonb_build_object(
        'total', coalesce(sum(p.monto), 0),
        'ingresos', coalesce(sum(p.monto) filter (where p.monto > 0), 0),
        'devoluciones', coalesce(-sum(p.monto) filter (where p.monto < 0), 0),
        'por_medio', coalesce((
          select jsonb_object_agg(t.medio, t.total)
          from (
            select x.medio, sum(x.monto) as total from public.pagos x
            where x.club_id = p_club_id and x.anulado_at is null and x.fecha between p_desde and p_hasta
            group by x.medio
          ) t), '{}'::jsonb))
      from public.pagos p
      where p.club_id = p_club_id and p.anulado_at is null and p.fecha between p_desde and p_hasta
    ),
    'a_devolver', coalesce((
      select jsonb_agg(private.ocupacion_json(o) order by o.cancelada_at desc)
      from public.ocupaciones o
      where o.club_id = p_club_id and o.estado in ('cancelada', 'rechazada', 'vencida') and o.pagado > 0
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.club_deudas(p_club_id bigint)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_staff(p_club_id);
  return jsonb_build_object(
    'clientes', coalesce((
      select jsonb_agg(x.fila order by x.saldo)
      from (
        select jsonb_build_object('cliente', private.cliente_json(c), 'saldo', private.saldo_cliente(c.id),
          'impagas', (select count(*) from public.ocupaciones o
            where o.cliente_id = c.id and o.tipo = 'reserva' and o.estado = 'confirmada'
              and o.inicio <= pg_catalog.now() and o.pagado < o.precio)) as fila,
          private.saldo_cliente(c.id) as saldo
        from public.clientes_club c
        where c.club_id = p_club_id and private.saldo_cliente(c.id) < 0
      ) x
    ), '[]'::jsonb),
    'sin_cliente', coalesce((
      select jsonb_agg(private.ocupacion_json(o) order by o.inicio desc)
      from public.ocupaciones o
      where o.club_id = p_club_id and o.cliente_id is null and o.tipo = 'reserva' and o.estado = 'confirmada'
        and o.inicio <= pg_catalog.now() and o.pagado < o.precio
        and o.inicio > pg_catalog.now() - interval '120 days'
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------

create or replace function public.club_clientes(
  p_club_id bigint, p_busqueda text default null, p_incluir_archivados boolean default false, p_limite integer default 200
)
returns setof jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_busqueda text := nullif(btrim(coalesce(p_busqueda, '')), '');
  v_digitos text := nullif(pg_catalog.regexp_replace(coalesce(p_busqueda, ''), '[^0-9]', '', 'g'), '');
begin
  perform private.exigir_staff(p_club_id);
  return query
  select private.cliente_json(c) || jsonb_build_object(
    'saldo', private.saldo_cliente(c.id),
    'reservas', (select count(*) from public.ocupaciones o
      where o.cliente_id = c.id and o.tipo = 'reserva' and o.estado = 'confirmada'),
    'ultima', (select max(o.inicio) from public.ocupaciones o
      where o.cliente_id = c.id and o.estado = 'confirmada' and o.inicio <= pg_catalog.now()),
    'proxima', (select min(o.inicio) from public.ocupaciones o
      where o.cliente_id = c.id and o.estado in ('pendiente', 'confirmada') and o.inicio > pg_catalog.now()),
    'fijos', (select count(*) from public.series s where s.cliente_id = c.id and s.activa
      and (s.hasta is null or s.hasta >= private.hoy_ar()))
  )
  from public.clientes_club c
  where c.club_id = p_club_id
    and (p_incluir_archivados or not c.archivado)
    and (v_busqueda is null
      or c.nombre ilike '%' || replace(replace(replace(v_busqueda, '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or (v_digitos is not null and length(v_digitos) >= 3 and c.telefono like '%' || v_digitos || '%'))
  order by c.archivado, lower(c.nombre)
  limit least(greatest(coalesce(p_limite, 200), 1), 500);
end;
$$;

create or replace function public.club_guardar_cliente(
  p_club_id bigint,
  p_nombre text,
  p_id bigint default null,
  p_telefono text default null,
  p_email text default null,
  p_notas text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare c public.clientes_club%rowtype;
begin
  perform private.exigir_staff(p_club_id);
  if p_id is null then
    insert into public.clientes_club (club_id, nombre, telefono, email, notas)
    values (p_club_id, private.texto(p_nombre, 'El nombre', 2, 120), private.telefono(p_telefono),
      private.email(p_email), private.texto(p_notas, 'La nota', 0, 1000, true))
    returning * into c;
  else
    update public.clientes_club
    set nombre = private.texto(p_nombre, 'El nombre', 2, 120),
        telefono = private.telefono(p_telefono),
        email = private.email(p_email),
        notas = private.texto(p_notas, 'La nota', 0, 1000, true)
    where id = p_id and club_id = p_club_id
    returning * into c;
    if not found then raise exception 'Cliente no encontrado' using errcode = 'P0002'; end if;
  end if;
  perform private.auditar(p_club_id, case when p_id is null then 'cliente.crear' else 'cliente.editar' end,
    'cliente', c.id::text, '{}'::jsonb);
  return private.cliente_json(c);
end;
$$;

create or replace function public.club_archivar_cliente(p_cliente_id bigint, p_archivado boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_club bigint;
begin
  select club_id into v_club from public.clientes_club where id = p_cliente_id;
  if not found then raise exception 'Cliente no encontrado' using errcode = 'P0002'; end if;
  perform private.exigir_staff(v_club);
  update public.clientes_club set archivado = coalesce(p_archivado, true) where id = p_cliente_id;
end;
$$;

create or replace function public.club_cliente_detalle(p_cliente_id bigint)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare c public.clientes_club%rowtype;
begin
  select * into c from public.clientes_club where id = p_cliente_id;
  if not found then raise exception 'Cliente no encontrado' using errcode = 'P0002'; end if;
  perform private.exigir_staff(c.club_id);
  return jsonb_build_object(
    'cliente', private.cliente_json(c),
    'saldo', private.saldo_cliente(c.id),
    'ocupaciones', coalesce((
      select jsonb_agg(private.ocupacion_json(o) order by o.inicio desc)
      from (select * from public.ocupaciones x where x.cliente_id = c.id order by x.inicio desc limit 100) o
    ), '[]'::jsonb),
    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'fecha', p.fecha, 'monto', p.monto, 'medio', p.medio,
          'nota', p.nota, 'anulado', p.anulado_at is not null, 'ocupacion_id', p.ocupacion_id)
        order by p.fecha desc, p.id desc)
      from (select * from public.pagos y where y.cliente_id = c.id order by y.fecha desc, y.id desc limit 100) p
    ), '[]'::jsonb),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'titulo', s.titulo, 'dia_semana', s.dia_semana,
          'hora_inicio', pg_catalog.to_char(s.hora_inicio, 'HH24:MI'), 'duracion_min', s.duracion_min,
          'activa', s.activa and (s.hasta is null or s.hasta >= private.hoy_ar())) order by s.id)
      from public.series s where s.cliente_id = c.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Alquileres fijos
-- ---------------------------------------------------------------------------

create or replace function private.validar_serie(
  p_dia integer, p_hora time, p_duracion integer, p_desde date, p_hasta date, p_precio numeric
)
returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if p_dia is null or p_dia not between 0 and 6 then raise exception 'Día inválido'; end if;
  if p_hora is null or extract(minute from p_hora)::int % 5 <> 0 then
    raise exception 'Usá un horario de inicio en múltiplos de 5 minutos';
  end if;
  if p_duracion is null or p_duracion not between 30 and 720 or p_duracion % 15 <> 0 then
    raise exception 'La duración debe ser de 30 minutos a 12 horas, en tramos de 15 minutos';
  end if;
  if p_desde is null or p_desde < private.hoy_ar() - 7 then raise exception 'La fecha de inicio no puede ser anterior a la semana pasada'; end if;
  if p_hasta is not null and p_hasta < p_desde then raise exception 'La fecha de fin no puede ser anterior a la de inicio'; end if;
  if p_precio is null or p_precio < 0 then raise exception 'El precio no es válido'; end if;
end;
$$;

create or replace function public.club_previsualizar_serie(
  p_club_id bigint,
  p_cancha_id bigint,
  p_dia_semana integer,
  p_hora_inicio time,
  p_duracion_min integer,
  p_desde date,
  p_hasta date default null,
  p_excluir_serie bigint default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_fechas date[];
begin
  perform private.exigir_staff(p_club_id);
  if not exists (select 1 from public.canchas where id = p_cancha_id and club_id = p_club_id) then
    raise exception 'La cancha no pertenece a este club';
  end if;
  perform private.validar_serie(p_dia_semana, p_hora_inicio, p_duracion_min, p_desde, p_hasta, 0);
  perform private.expirar_vencidas(p_club_id);
  select array_agg(f) into v_fechas
  from private.fechas_serie(p_dia_semana, greatest(p_desde, private.hoy_ar()),
    least(coalesce(p_hasta, private.horizonte_series()), private.horizonte_series())) f
  where private.instante_ar(f, p_hora_inicio) > pg_catalog.now();
  return jsonb_build_object(
    'fechas', coalesce(cardinality(v_fechas), 0),
    'primera', v_fechas[1],
    'horizonte', private.horizonte_series(),
    'conflictos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', x.fecha, 'detalle', x.detalle) order by x.fecha)
      from private.conflictos_serie(p_cancha_id, p_dia_semana, p_hora_inicio, p_duracion_min,
        p_desde, p_hasta, p_excluir_serie) x
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.club_crear_serie(
  p_club_id bigint,
  p_cancha_id bigint,
  p_titulo text,
  p_dia_semana integer,
  p_hora_inicio time,
  p_duracion_min integer,
  p_desde date,
  p_precio numeric,
  p_hasta date default null,
  p_cliente_id bigint default null,
  p_cliente_nombre text default null,
  p_cliente_telefono text default null,
  p_notas text default null,
  p_omitir_conflictos boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.clientes_club%rowtype;
  v_id bigint;
  v_conflictos text;
  v_resultado jsonb;
begin
  perform private.exigir_staff(p_club_id);
  if not exists (select 1 from public.canchas where id = p_cancha_id and club_id = p_club_id) then
    raise exception 'La cancha no pertenece a este club';
  end if;
  perform private.validar_serie(p_dia_semana, p_hora_inicio, p_duracion_min, p_desde, p_hasta, p_precio);
  c := private.resolver_cliente(p_club_id, p_cliente_id, p_cliente_nombre, p_cliente_telefono);
  perform private.expirar_vencidas(p_club_id);
  if not coalesce(p_omitir_conflictos, false) then
    select string_agg(pg_catalog.to_char(x.fecha, 'DD/MM'), ', ' order by x.fecha) into v_conflictos
    from private.conflictos_serie(p_cancha_id, p_dia_semana, p_hora_inicio, p_duracion_min, p_desde, p_hasta, null) x;
    if v_conflictos is not null then
      raise exception 'La cancha ya está ocupada el %. Podés omitir esas fechas o elegir otro horario.', v_conflictos;
    end if;
  end if;
  insert into public.series (club_id, cancha_id, cliente_id, titulo, dia_semana, hora_inicio, duracion_min,
    desde, hasta, precio, notas, creada_por)
  values (p_club_id, p_cancha_id, c.id,
    coalesce(private.texto(p_titulo, 'El nombre del fijo', 0, 120), c.nombre, 'Alquiler fijo'),
    p_dia_semana, p_hora_inicio, p_duracion_min, p_desde, p_hasta, round(p_precio, 2),
    private.texto(p_notas, 'La nota', 0, 500, true), auth.uid())
  returning id into v_id;
  v_resultado := private.materializar_serie(v_id);
  perform private.auditar(p_club_id, 'fijo.crear', 'serie', v_id::text, v_resultado);
  return jsonb_build_object('serie_id', v_id) || v_resultado;
end;
$$;

create or replace function public.club_series(p_club_id bigint, p_incluir_finalizadas boolean default false)
returns setof jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_staff(p_club_id);
  return query
  select jsonb_build_object(
    'id', s.id,
    'titulo', s.titulo,
    'cliente', case when c.id is not null then jsonb_build_object('id', c.id, 'nombre', c.nombre, 'telefono', c.telefono) end,
    'cancha', jsonb_build_object('id', ca.id, 'titulo', ca.titulo),
    'dia_semana', s.dia_semana,
    'hora_inicio', pg_catalog.to_char(s.hora_inicio, 'HH24:MI'),
    'duracion_min', s.duracion_min,
    'desde', s.desde,
    'hasta', s.hasta,
    'precio', s.precio,
    'notas', s.notas,
    'vigente', s.activa and (s.hasta is null or s.hasta >= private.hoy_ar()),
    'proxima', (select min(o.inicio) from public.ocupaciones o
      where o.serie_id = s.id and o.estado = 'confirmada' and o.inicio > pg_catalog.now()),
    'fechas_futuras', (select count(*) from public.ocupaciones o
      where o.serie_id = s.id and o.estado = 'confirmada' and o.inicio > pg_catalog.now()),
    'deuda', coalesce((select sum(o.precio - o.pagado) from public.ocupaciones o
      where o.serie_id = s.id and o.estado = 'confirmada' and o.inicio <= pg_catalog.now() and o.pagado < o.precio), 0)
  )
  from public.series s
  join public.canchas ca on ca.id = s.cancha_id
  left join public.clientes_club c on c.id = s.cliente_id
  where s.club_id = p_club_id
    and (p_incluir_finalizadas or (s.activa and (s.hasta is null or s.hasta >= private.hoy_ar())))
  order by s.dia_semana, s.hora_inicio, ca.titulo;
end;
$$;

-- Cambia un fijo desde una fecha. Si solo cambian precio o nombre se
-- actualizan las fechas futuras; si cambia el horario, la serie se divide:
-- la anterior termina el día previo y una nueva toma las fechas siguientes.
create or replace function public.club_modificar_serie(
  p_serie_id bigint,
  p_desde_fecha date,
  p_cancha_id bigint,
  p_dia_semana integer,
  p_hora_inicio time,
  p_duracion_min integer,
  p_precio numeric,
  p_titulo text default null,
  p_hasta date default null,
  p_omitir_conflictos boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  s public.series%rowtype;
  v_titulo text;
  v_nueva bigint;
  v_conflictos text;
  v_canceladas integer;
  v_resultado jsonb;
begin
  select * into s from public.series where id = p_serie_id for update;
  if not found then raise exception 'Fijo no encontrado' using errcode = 'P0002'; end if;
  perform private.exigir_staff(s.club_id);
  if p_desde_fecha is null or p_desde_fecha < private.hoy_ar() then
    raise exception 'Los cambios aplican desde hoy en adelante';
  end if;
  if not exists (select 1 from public.canchas where id = p_cancha_id and club_id = s.club_id) then
    raise exception 'La cancha no pertenece a este club';
  end if;
  perform private.validar_serie(p_dia_semana, p_hora_inicio, p_duracion_min, p_desde_fecha, p_hasta, p_precio);
  v_titulo := coalesce(private.texto(p_titulo, 'El nombre del fijo', 0, 120), s.titulo);

  if p_cancha_id = s.cancha_id and p_dia_semana = s.dia_semana and p_hora_inicio = s.hora_inicio
     and p_duracion_min = s.duracion_min then
    update public.series
    set precio = round(p_precio, 2), titulo = v_titulo, hasta = p_hasta
    where id = s.id;
    update public.ocupaciones
    set precio = round(p_precio, 2), titulo = v_titulo
    where serie_id = s.id and estado = 'confirmada' and pagado = 0
      and inicio >= private.instante_ar(p_desde_fecha, time '00:00');
    v_canceladas := 0;
    if p_hasta is not null then
      v_canceladas := private.cancelar_fechas_serie(s.id, p_hasta + 1, 'Fin del fijo');
    end if;
    v_resultado := private.materializar_serie(s.id);
    perform private.auditar(s.club_id, 'fijo.editar', 'serie', s.id::text,
      jsonb_build_object('precio', p_precio, 'desde', p_desde_fecha, 'hasta', p_hasta));
    return jsonb_build_object('serie_id', s.id, 'canceladas', v_canceladas) || v_resultado;
  end if;

  perform private.expirar_vencidas(s.club_id);
  if not coalesce(p_omitir_conflictos, false) then
    select string_agg(pg_catalog.to_char(x.fecha, 'DD/MM'), ', ' order by x.fecha) into v_conflictos
    from private.conflictos_serie(p_cancha_id, p_dia_semana, p_hora_inicio, p_duracion_min,
      p_desde_fecha, p_hasta, s.id) x;
    if v_conflictos is not null then
      raise exception 'La cancha ya está ocupada el %. Podés omitir esas fechas o elegir otro horario.', v_conflictos;
    end if;
  end if;

  v_canceladas := private.cancelar_fechas_serie(s.id, p_desde_fecha, 'Cambio de horario del fijo');
  if p_desde_fecha <= s.desde then
    update public.series set activa = false where id = s.id;
  else
    update public.series set hasta = p_desde_fecha - 1 where id = s.id;
  end if;
  insert into public.series (club_id, cancha_id, cliente_id, titulo, dia_semana, hora_inicio, duracion_min,
    desde, hasta, precio, notas, creada_por)
  values (s.club_id, p_cancha_id, s.cliente_id, v_titulo, p_dia_semana, p_hora_inicio, p_duracion_min,
    p_desde_fecha, p_hasta, round(p_precio, 2), s.notas, auth.uid())
  returning id into v_nueva;
  v_resultado := private.materializar_serie(v_nueva);
  perform private.auditar(s.club_id, 'fijo.reprogramar', 'serie', s.id::text,
    jsonb_build_object('nueva_serie', v_nueva, 'desde', p_desde_fecha, 'canceladas', v_canceladas));
  return jsonb_build_object('serie_id', v_nueva, 'canceladas', v_canceladas) || v_resultado;
end;
$$;

create or replace function public.club_finalizar_serie(p_serie_id bigint, p_desde_fecha date)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  s public.series%rowtype;
  v_canceladas integer;
begin
  select * into s from public.series where id = p_serie_id for update;
  if not found then raise exception 'Fijo no encontrado' using errcode = 'P0002'; end if;
  perform private.exigir_staff(s.club_id);
  if p_desde_fecha is null or p_desde_fecha < private.hoy_ar() then
    raise exception 'El fijo puede terminar desde hoy en adelante';
  end if;
  v_canceladas := private.cancelar_fechas_serie(s.id, p_desde_fecha, 'Fin del fijo');
  if p_desde_fecha <= s.desde then
    update public.series set activa = false where id = s.id;
  else
    update public.series set hasta = p_desde_fecha - 1 where id = s.id;
  end if;
  perform private.auditar(s.club_id, 'fijo.finalizar', 'serie', s.id::text,
    jsonb_build_object('desde', p_desde_fecha, 'canceladas', v_canceladas));
  return jsonb_build_object('canceladas', v_canceladas);
end;
$$;

-- ---------------------------------------------------------------------------
-- Configuración del club, canchas y horarios (solo dueños)
-- ---------------------------------------------------------------------------

create or replace function public.club_actualizar(p_club_id bigint, p_datos jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare c public.clubes%rowtype;
begin
  perform private.exigir_staff(p_club_id, true);
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'Datos inválidos'; end if;
  select * into c from public.clubes where id = p_club_id for update;
  if not found then raise exception 'Club no encontrado' using errcode = 'P0002'; end if;

  if p_datos ? 'nombre' then c.nombre := private.texto(p_datos ->> 'nombre', 'El nombre', 2, 120); end if;
  if p_datos ? 'slug' then
    c.slug := private.slugificar(p_datos ->> 'slug');
    if length(c.slug) < 3 or length(c.slug) > 60 then
      raise exception 'La dirección pública debe tener entre 3 y 60 letras o números';
    end if;
  end if;
  if p_datos ? 'descripcion' then c.descripcion := private.texto(p_datos ->> 'descripcion', 'La descripción', 0, 1000, true); end if;
  if p_datos ? 'direccion' then c.direccion := private.texto(p_datos ->> 'direccion', 'La dirección', 0, 200); end if;
  if p_datos ? 'zona' then c.zona := private.texto(p_datos ->> 'zona', 'La zona', 0, 80); end if;
  if p_datos ? 'telefono' then c.telefono := private.telefono(p_datos ->> 'telefono'); end if;
  if p_datos ? 'whatsapp' then
    c.whatsapp := private.telefono(p_datos ->> 'whatsapp');
    if c.whatsapp is not null and length(c.whatsapp) < 10 then
      raise exception 'El WhatsApp debe incluir código de país y de área (ej. 5491122334455)';
    end if;
  end if;
  if p_datos ? 'instagram' then
    c.instagram := nullif(pg_catalog.regexp_replace(btrim(coalesce(p_datos ->> 'instagram', '')), '^@', ''), '');
    if c.instagram is not null and c.instagram !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'Usuario de Instagram inválido'; end if;
  end if;
  if p_datos ? 'alias_pago' then c.alias_pago := private.texto(p_datos ->> 'alias_pago', 'El alias', 0, 60); end if;
  if p_datos ? 'titular_pago' then c.titular_pago := private.texto(p_datos ->> 'titular_pago', 'El titular', 0, 100); end if;
  if p_datos ? 'politicas' then c.politicas := private.texto(p_datos ->> 'politicas', 'Las políticas', 0, 1500, true); end if;
  if p_datos ? 'latitud' or p_datos ? 'longitud' then
    if nullif(p_datos ->> 'latitud', '') is null or nullif(p_datos ->> 'longitud', '') is null then
      c.latitud := null;
      c.longitud := null;
    elsif (p_datos ->> 'latitud') !~ '^-?[0-9]{1,3}(\.[0-9]{1,10})?$'
       or (p_datos ->> 'longitud') !~ '^-?[0-9]{1,3}(\.[0-9]{1,10})?$' then
      raise exception 'Las coordenadas no son válidas';
    else
      c.latitud := (p_datos ->> 'latitud')::double precision;
      c.longitud := (p_datos ->> 'longitud')::double precision;
    end if;
  end if;
  if p_datos ? 'confirmacion_automatica' then
    c.confirmacion_automatica := private.json_booleano(p_datos, 'confirmacion_automatica', false);
  end if;
  if p_datos ? 'anticipacion_minima_min' then
    c.anticipacion_minima_min := private.json_entero(p_datos, 'anticipacion_minima_min', 60);
  end if;
  if p_datos ? 'ventana_reserva_dias' then
    c.ventana_reserva_dias := private.json_entero(p_datos, 'ventana_reserva_dias', 21);
  end if;
  if p_datos ? 'cancelacion_horas' then c.cancelacion_horas := private.json_entero(p_datos, 'cancelacion_horas', 24); end if;
  if p_datos ? 'respuesta_horas' then c.respuesta_horas := private.json_entero(p_datos, 'respuesta_horas', 12); end if;
  if p_datos ? 'publicado' then
    c.publicado := private.json_booleano(p_datos, 'publicado', false);
    if c.publicado and not exists (
      select 1 from public.canchas ca join public.horarios_semanales h on h.cancha_id = ca.id and h.activo
      where ca.club_id = p_club_id and ca.activa) then
      raise exception 'Cargá al menos una cancha activa con horarios antes de publicar el club';
    end if;
  end if;

  begin
    update public.clubes set
      nombre = c.nombre, slug = c.slug, descripcion = c.descripcion, direccion = c.direccion, zona = c.zona,
      telefono = c.telefono, whatsapp = c.whatsapp, instagram = c.instagram, alias_pago = c.alias_pago,
      titular_pago = c.titular_pago, politicas = c.politicas, latitud = c.latitud, longitud = c.longitud,
      confirmacion_automatica = c.confirmacion_automatica, anticipacion_minima_min = c.anticipacion_minima_min,
      ventana_reserva_dias = c.ventana_reserva_dias, cancelacion_horas = c.cancelacion_horas,
      respuesta_horas = c.respuesta_horas, publicado = c.publicado
    where id = p_club_id;
  exception
    when unique_violation then raise exception 'Esa dirección pública ya está en uso';
    when check_violation then raise exception 'Revisá los datos: algún valor está fuera de rango';
  end;
  perform private.auditar(p_club_id, 'club.configurar', 'club', p_club_id::text, p_datos - 'politicas' - 'descripcion');
  return (public.club_panel(p_club_id)) -> 'club';
end;
$$;

create or replace function public.club_guardar_cancha(
  p_club_id bigint,
  p_titulo text,
  p_id bigint default null,
  p_descripcion text default null,
  p_precio_total numeric default 0,
  p_precio_sena numeric default 0,
  p_techada boolean default true,
  p_superficie text default null,
  p_activa boolean default true,
  p_orden integer default 0,
  p_fotos text[] default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  ca public.canchas%rowtype;
  v_titulo text := private.texto(p_titulo, 'El nombre de la cancha', 2, 80);
  v_foto text;
begin
  perform private.exigir_staff(p_club_id, true);
  if p_precio_total is null or p_precio_total < 0 or p_precio_sena is null or p_precio_sena < 0 then
    raise exception 'Los precios no son válidos';
  end if;
  if p_superficie is not null and p_superficie not in ('parquet', 'sintetico', 'cemento', 'arena', 'otro') then
    raise exception 'Superficie inválida';
  end if;
  if cardinality(coalesce(p_fotos, '{}')) > 8 then raise exception 'Podés cargar hasta 8 fotos'; end if;
  foreach v_foto in array coalesce(p_fotos, '{}') loop
    if v_foto !~ ('^https://[A-Za-z0-9.-]+(:[0-9]+)?/storage/v1/object/public/canchas-fotos/club-' || p_club_id
        || '/[A-Za-z0-9._-]{1,120}$') then
      raise exception 'Las fotos deben subirse desde el panel del club';
    end if;
  end loop;

  if p_id is null then
    insert into public.canchas (club_id, nombre_identificador, titulo, descripcion, fotos, precio_total,
      precio_sena, techada, superficie, activa, orden)
    values (p_club_id, v_titulo, v_titulo, private.texto(p_descripcion, 'La descripción', 0, 1000, true),
      coalesce(p_fotos, '{}'), p_precio_total, p_precio_sena, coalesce(p_techada, true), p_superficie,
      coalesce(p_activa, true), coalesce(p_orden, 0))
    returning * into ca;
  else
    update public.canchas set
      nombre_identificador = v_titulo, titulo = v_titulo,
      descripcion = private.texto(p_descripcion, 'La descripción', 0, 1000, true),
      fotos = coalesce(p_fotos, fotos), precio_total = p_precio_total, precio_sena = p_precio_sena,
      techada = coalesce(p_techada, true), superficie = p_superficie, activa = coalesce(p_activa, true),
      orden = coalesce(p_orden, 0)
    where id = p_id and club_id = p_club_id
    returning * into ca;
    if not found then raise exception 'Cancha no encontrada' using errcode = 'P0002'; end if;
  end if;
  perform private.auditar(p_club_id, case when p_id is null then 'cancha.crear' else 'cancha.editar' end,
    'cancha', ca.id::text, jsonb_build_object('titulo', ca.titulo, 'activa', ca.activa));
  return jsonb_build_object('id', ca.id, 'titulo', ca.titulo, 'descripcion', ca.descripcion,
    'precio_total', ca.precio_total, 'precio_sena', ca.precio_sena, 'techada', ca.techada,
    'superficie', ca.superficie, 'activa', ca.activa, 'orden', ca.orden, 'fotos', ca.fotos);
end;
$$;

-- Reemplaza la plantilla semanal de bloques de una cancha.
-- p_bloques: [{dia_semana, hora_inicio 'HH:MM', hora_fin 'HH:MM', precio_total, precio_sena}]
create or replace function public.club_guardar_horarios(p_cancha_id bigint, p_bloques jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_club bigint;
  v_item jsonb;
  v_dia integer;
  v_inicio time;
  v_fin time;
  v_duracion integer;
  v_total numeric;
  v_sena numeric;
  v_inicios integer[] := '{}';
  v_fines integer[] := '{}';
  v_dias integer[] := '{}';
  v_horas_inicio time[] := '{}';
  v_horas_fin time[] := '{}';
  v_totales numeric[] := '{}';
  v_senas numeric[] := '{}';
  i integer;
  j integer;
begin
  select club_id into v_club from public.canchas where id = p_cancha_id;
  if not found then raise exception 'Cancha no encontrada' using errcode = 'P0002'; end if;
  perform private.exigir_staff(v_club, true);
  if p_bloques is null or jsonb_typeof(p_bloques) <> 'array' then raise exception 'Bloques inválidos'; end if;
  if jsonb_array_length(p_bloques) > 150 then raise exception 'Demasiados bloques para una cancha'; end if;

  for v_item in select value from jsonb_array_elements(p_bloques) loop
    v_dia := private.json_entero(v_item, 'dia_semana', null);
    if v_dia is null or v_dia not between 0 and 6 then raise exception 'Día inválido en un bloque'; end if;
    if coalesce(v_item ->> 'hora_inicio', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(v_item ->> 'hora_fin', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Usá horarios con formato HH:MM';
    end if;
    v_inicio := (v_item ->> 'hora_inicio')::time;
    v_fin := (v_item ->> 'hora_fin')::time;
    v_duracion := (extract(epoch from (v_fin - v_inicio))::int / 60 + 1440) % 1440;
    if v_duracion < 30 or v_duracion > 720 then
      raise exception 'Cada bloque debe durar entre 30 minutos y 12 horas';
    end if;
    v_total := private.json_numero(v_item, 'precio_total', 0);
    v_sena := private.json_numero(v_item, 'precio_sena', 0);
    if v_total < 0 or v_sena < 0 or v_sena > v_total then
      raise exception 'Revisá los precios: la seña no puede superar el total';
    end if;
    v_inicios := v_inicios || (v_dia * 1440 + extract(hour from v_inicio)::int * 60 + extract(minute from v_inicio)::int);
    v_fines := v_fines || (v_inicios[cardinality(v_inicios)] + v_duracion);
    v_dias := v_dias || v_dia;
    v_horas_inicio := v_horas_inicio || v_inicio;
    v_horas_fin := v_horas_fin || v_fin;
    v_totales := v_totales || v_total;
    v_senas := v_senas || v_sena;
  end loop;

  -- Superposiciones dentro de la semana (incluye bloques que cruzan medianoche
  -- y el paso de sábado a domingo).
  for i in 1 .. coalesce(cardinality(v_inicios), 0) loop
    for j in i + 1 .. cardinality(v_inicios) loop
      if (v_inicios[i] < v_fines[j] and v_inicios[j] < v_fines[i])
         or (v_inicios[i] < v_fines[j] + 10080 and v_inicios[j] + 10080 < v_fines[i])
         or (v_inicios[i] + 10080 < v_fines[j] and v_inicios[j] < v_fines[i] + 10080) then
        raise exception 'Hay bloques superpuestos el mismo día. Revisá los horarios.';
      end if;
    end loop;
  end loop;

  delete from public.horarios_semanales where cancha_id = p_cancha_id;
  insert into public.horarios_semanales (cancha_id, dia_semana, hora_inicio, hora_fin, precio_total, precio_sena, activo)
  select p_cancha_id::int, b.dia, b.inicio, b.fin, b.total, b.sena, true
  from unnest(v_dias, v_horas_inicio, v_horas_fin, v_totales, v_senas) as b(dia, inicio, fin, total, sena);
  perform private.auditar(v_club, 'horarios.guardar', 'cancha', p_cancha_id::text,
    jsonb_build_object('bloques', coalesce(cardinality(v_inicios), 0)));
  return coalesce(cardinality(v_inicios), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Equipo
-- ---------------------------------------------------------------------------

create or replace function public.club_equipo(p_club_id bigint)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_staff(p_club_id, true);
  return jsonb_build_object(
    'miembros', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'nombre', private.nombre_visible(u.nombre_completo, u.email),
          'email', u.email, 'rol', m.rol, 'created_at', m.created_at, 'soy_yo', m.user_id = auth.uid())
        order by m.rol, u.nombre_completo)
      from public.club_miembros m join public.usuarios u on u.id = m.user_id
      where m.club_id = p_club_id), '[]'::jsonb),
    'invitaciones', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'rol', i.rol, 'expira_at', i.expira_at,
          'created_at', i.created_at) order by i.created_at desc)
      from public.club_invitaciones i
      where i.club_id = p_club_id and i.aceptada_at is null and i.revocada_at is null
        and i.expira_at > pg_catalog.now()), '[]'::jsonb)
  );
end;
$$;

-- Devuelve el token una única vez; se guarda solo su hash.
create or replace function public.club_invitar(p_club_id bigint, p_email text, p_rol text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := private.email(p_email);
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_expira timestamptz := pg_catalog.now() + interval '7 days';
  v_id bigint;
begin
  perform private.exigir_staff(p_club_id, true);
  if v_email is null then raise exception 'Ingresá el email de la persona a invitar'; end if;
  if p_rol not in ('dueno', 'encargado') then raise exception 'Rol inválido'; end if;
  if exists (select 1 from public.club_miembros m join public.usuarios u on u.id = m.user_id
             where m.club_id = p_club_id and lower(u.email) = v_email) then
    raise exception 'Esa persona ya es parte del equipo';
  end if;
  update public.club_invitaciones set revocada_at = pg_catalog.now()
  where club_id = p_club_id and lower(email) = v_email and aceptada_at is null and revocada_at is null;
  insert into public.club_invitaciones (club_id, email, rol, token_hash, expira_at, creada_por)
  values (p_club_id, v_email, p_rol, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expira, auth.uid())
  returning id into v_id;
  perform private.auditar(p_club_id, 'equipo.invitar', 'invitacion', v_id::text,
    jsonb_build_object('email', v_email, 'rol', p_rol));
  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email, 'rol', p_rol, 'expira_at', v_expira);
end;
$$;

create or replace function public.club_revocar_invitacion(p_invitacion_id bigint)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_club bigint;
begin
  select club_id into v_club from public.club_invitaciones where id = p_invitacion_id;
  if not found then raise exception 'Invitación no encontrada' using errcode = 'P0002'; end if;
  perform private.exigir_staff(v_club, true);
  update public.club_invitaciones set revocada_at = pg_catalog.now()
  where id = p_invitacion_id and aceptada_at is null and revocada_at is null;
  perform private.auditar(v_club, 'equipo.revocar_invitacion', 'invitacion', p_invitacion_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.club_cambiar_miembro(p_club_id bigint, p_user_id uuid, p_rol text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_actual text;
begin
  perform private.exigir_staff(p_club_id, true);
  select rol into v_actual from public.club_miembros where club_id = p_club_id and user_id = p_user_id for update;
  if not found then raise exception 'Esa persona no es parte del equipo'; end if;
  if p_rol is not null and p_rol not in ('dueno', 'encargado') then raise exception 'Rol inválido'; end if;
  if v_actual = 'dueno' and coalesce(p_rol, '') <> 'dueno'
     and (select count(*) from public.club_miembros where club_id = p_club_id and rol = 'dueno') <= 1 then
    raise exception 'El club necesita al menos un dueño';
  end if;
  if p_rol is null then
    delete from public.club_miembros where club_id = p_club_id and user_id = p_user_id;
  else
    update public.club_miembros set rol = p_rol where club_id = p_club_id and user_id = p_user_id;
  end if;
  perform private.auditar(p_club_id, case when p_rol is null then 'equipo.quitar' else 'equipo.cambiar_rol' end,
    'miembro', p_user_id::text, jsonb_build_object('rol', p_rol, 'rol_anterior', v_actual));
end;
$$;

-- ---------------------------------------------------------------------------
-- Partidos abiertos organizados por el club (para llenar horas libres)
-- ---------------------------------------------------------------------------

create or replace function public.club_publicar_partido(
  p_club_id bigint,
  p_cancha_id bigint,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_cupo_minimo integer,
  p_cupo_maximo integer,
  p_nivel text,
  p_precio_por_jugador numeric,
  p_descripcion text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ocupacion bigint;
  v_partido bigint;
begin
  perform private.exigir_staff(p_club_id);
  if not exists (select 1 from public.canchas where id = p_cancha_id and club_id = p_club_id and activa) then
    raise exception 'La cancha no pertenece a este club';
  end if;
  perform private.validar_periodo(p_inicio, p_fin, interval '12 hours');
  if p_inicio <= pg_catalog.now() then raise exception 'El partido tiene que ser en el futuro'; end if;
  if p_cupo_minimo < 2 or p_cupo_maximo < p_cupo_minimo or p_cupo_maximo > 22 then
    raise exception 'El cupo debe ser de 2 a 22 jugadores y el máximo no puede ser menor al mínimo';
  end if;
  if p_nivel not in ('recreativo', 'intermedio', 'competitivo') then raise exception 'Nivel inválido'; end if;
  if p_precio_por_jugador is null or p_precio_por_jugador < 0 then raise exception 'Indicá el precio por jugador'; end if;
  perform private.expirar_vencidas(p_club_id);
  begin
    insert into public.ocupaciones (club_id, cancha_id, inicio, fin, tipo, estado, origen, titulo, creada_por)
    values (p_club_id, p_cancha_id, p_inicio, p_fin, 'reserva', 'confirmada', 'otro', 'Partido abierto', auth.uid())
    returning id into v_ocupacion;
  exception when exclusion_violation then
    raise exception 'Se superpone con otra reserva o bloqueo en esa cancha';
  end;
  insert into public.partidos (ocupacion_id, organizador_id, club_id, cupo_minimo, cupo_maximo,
    cantidad_invitados_anonimos, visibilidad, estado_partido, token_invitacion, nivel_requerido,
    requiere_aprobacion, descripcion, precio_por_jugador)
  values (v_ocupacion, auth.uid(), p_club_id, p_cupo_minimo, p_cupo_maximo, 0, 'publico', 'abierto',
    encode(extensions.gen_random_bytes(16), 'hex'), p_nivel, false,
    private.texto(p_descripcion, 'La descripción', 0, 500, true), round(p_precio_por_jugador, 2))
  returning id into v_partido;
  perform private.auditar(p_club_id, 'partido.publicar', 'partido', v_partido::text,
    jsonb_build_object('ocupacion_id', v_ocupacion));
  return jsonb_build_object('partido_id', v_partido, 'ocupacion_id', v_ocupacion);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reportes y auditoría (solo dueños)
-- ---------------------------------------------------------------------------

create or replace function public.club_reporte(p_club_id bigint, p_desde date, p_hasta date)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_desde timestamptz;
  v_hasta timestamptz;
  v_resultado jsonb;
begin
  perform private.exigir_staff(p_club_id, true);
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta > p_desde + 186 then
    raise exception 'Elegí un período de hasta 6 meses';
  end if;
  v_desde := private.instante_ar(p_desde, time '00:00');
  v_hasta := private.instante_ar(p_hasta + 1, time '00:00');

  with dias as (
    select d::date as fecha
    from pg_catalog.generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') d
  ),
  disponibles as (
    -- Bloques publicados en el período: base para medir ocupación.
    select ca.id as cancha_id, private.instante_ar(d.fecha, h.hora_inicio) as inicio,
      private.instante_ar(d.fecha, h.hora_inicio)
        + make_interval(mins => ((extract(epoch from (h.hora_fin - h.hora_inicio))::int / 60 + 1440) % 1440)) as fin
    from dias d
    join public.horarios_semanales h on h.dia_semana = extract(dow from d.fecha)::int and h.activo
    join public.canchas ca on ca.id = h.cancha_id and ca.club_id = p_club_id and ca.activa
  ),
  reservas as (
    select o.* from public.ocupaciones o
    where o.club_id = p_club_id and o.tipo = 'reserva' and o.estado = 'confirmada'
      and o.inicio >= v_desde and o.inicio < v_hasta
  ),
  horas_reservadas as (
    select r.cancha_id,
      extract(dow from h.hora)::int as dia,
      extract(hour from h.hora)::int as hora,
      extract(epoch from (least(h.hora + interval '1 hour', r.fin_local) - greatest(h.hora, r.inicio_local))) / 60 as minutos
    from (select x.cancha_id, x.inicio at time zone 'America/Argentina/Buenos_Aires' as inicio_local,
            x.fin at time zone 'America/Argentina/Buenos_Aires' as fin_local from reservas x) r
    cross join lateral pg_catalog.generate_series(date_trunc('hour', r.inicio_local),
      r.fin_local - interval '1 second', interval '1 hour') as h(hora)
  ),
  horas_disponibles as (
    select d.cancha_id,
      extract(dow from h.hora)::int as dia,
      extract(hour from h.hora)::int as hora,
      extract(epoch from (least(h.hora + interval '1 hour', d.fin_local) - greatest(h.hora, d.inicio_local))) / 60 as minutos
    from (select x.cancha_id, x.inicio at time zone 'America/Argentina/Buenos_Aires' as inicio_local,
            x.fin at time zone 'America/Argentina/Buenos_Aires' as fin_local from disponibles x) d
    cross join lateral pg_catalog.generate_series(date_trunc('hour', d.inicio_local),
      d.fin_local - interval '1 second', interval '1 hour') as h(hora)
  ),
  calor as (
    select coalesce(a.dia, b.dia) as dia, coalesce(a.hora, b.hora) as hora,
      coalesce(a.minutos, 0) as ocupados, coalesce(b.minutos, 0) as disponibles
    from (select dia, hora, sum(minutos) as minutos from horas_reservadas group by dia, hora) a
    full join (select dia, hora, sum(minutos) as minutos from horas_disponibles group by dia, hora) b
      on a.dia = b.dia and a.hora = b.hora
  )
  select jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'minutos_disponibles', (select coalesce(sum(extract(epoch from (fin - inicio)) / 60), 0) from disponibles),
    'minutos_reservados', (select coalesce(sum(extract(epoch from (fin - inicio)) / 60), 0) from reservas),
    'reservas', (select count(*) from reservas),
    'facturado', (select coalesce(sum(precio), 0) from reservas),
    'cobrado', (select coalesce(sum(p.monto), 0) from public.pagos p
      where p.club_id = p_club_id and p.anulado_at is null and p.fecha between p_desde and p_hasta),
    'por_origen', (select coalesce(jsonb_object_agg(origen, total), '{}'::jsonb)
      from (select origen, count(*) as total from reservas group by origen) t),
    'canceladas', (select coalesce(jsonb_object_agg(coalesce(cancelada_por, 'otro'), total), '{}'::jsonb)
      from (select cancelada_por, count(*) as total from public.ocupaciones o
        where o.club_id = p_club_id and o.tipo = 'reserva' and o.estado in ('cancelada', 'rechazada', 'vencida')
          and o.inicio >= v_desde and o.inicio < v_hasta group by cancelada_por) t),
    'no_vinieron', (select count(*) from reservas where asistencia = 'no_vinieron'),
    'por_cancha', (select coalesce(jsonb_agg(jsonb_build_object('cancha_id', ca.id, 'titulo', ca.titulo,
        'minutos_disponibles', coalesce((select sum(extract(epoch from (d.fin - d.inicio)) / 60)
          from disponibles d where d.cancha_id = ca.id), 0),
        'minutos_reservados', coalesce((select sum(extract(epoch from (r.fin - r.inicio)) / 60)
          from reservas r where r.cancha_id = ca.id), 0)) order by ca.orden, ca.titulo), '[]'::jsonb)
      from public.canchas ca where ca.club_id = p_club_id),
    'calor', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'hora', hora,
        'ocupados', round(ocupados::numeric), 'disponibles', round(disponibles::numeric)) order by dia, hora), '[]'::jsonb)
      from calor),
    'top_clientes', (select coalesce(jsonb_agg(t.fila order by t.reservas desc, t.monto desc), '[]'::jsonb) from (
        select jsonb_build_object('cliente_id', c.id, 'nombre', c.nombre, 'reservas', count(*), 'monto', sum(r.precio)) as fila,
          count(*) as reservas, sum(r.precio) as monto
        from reservas r join public.clientes_club c on c.id = r.cliente_id
        group by c.id, c.nombre order by count(*) desc, sum(r.precio) desc limit 8) t)
  ) into v_resultado;
  return v_resultado;
end;
$$;

create or replace function public.club_auditoria(p_club_id bigint, p_limite integer default 100)
returns setof jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_staff(p_club_id, true);
  return query
  select jsonb_build_object('id', a.id, 'created_at', a.created_at, 'accion', a.accion, 'entidad', a.entidad,
    'entidad_id', a.entidad_id, 'detalle', a.detalle,
    'actor', case when a.actor_id is null then 'Sistema' else private.nombre_visible(u.nombre_completo, u.email) end)
  from public.auditoria a left join public.usuarios u on u.id = a.actor_id
  where a.club_id = p_club_id
  order by a.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limite, 100), 1), 500);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos: todas requieren sesión; cada función valida el rol en el club.
-- ---------------------------------------------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'club\_%'
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
  for f in
    select p.oid::regprocedure as firma from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('ocupacion_json', 'cliente_json', 'saldo_cliente', 'validar_periodo',
        'resolver_cliente', 'cancelar_ocupacion', 'validar_serie')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
  end loop;
end $$;
