-- Administración global, cola de envíos de email y tareas programadas.

create or replace function private.exigir_admin_global()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare v_uid uuid := private.exigir_sesion();
begin
  if not private.is_admin_global() then
    raise exception 'Solo la administración de VoleyApp puede hacer esto' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;
revoke all on function private.exigir_admin_global() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Administración global
-- ---------------------------------------------------------------------------

create or replace function public.admin_resumen()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.exigir_admin_global();
  return jsonb_build_object(
    'clubes', (select count(*) from public.clubes),
    'clubes_publicados', (select count(*) from public.clubes where publicado),
    'canchas', (select count(*) from public.canchas where activa),
    'usuarios', (select count(*) from public.usuarios),
    'usuarios_semana', (select count(*) from public.usuarios where created_at > pg_catalog.now() - interval '7 days'),
    'reservas_semana', (select count(*) from public.ocupaciones
      where tipo = 'reserva' and created_at > pg_catalog.now() - interval '7 days'),
    'reservas_app_semana', (select count(*) from public.ocupaciones
      where tipo = 'reserva' and origen = 'app' and created_at > pg_catalog.now() - interval '7 days'),
    'pendientes', (select count(*) from public.ocupaciones where estado = 'pendiente' and vence_at > pg_catalog.now()),
    'vencidas_semana', (select count(*) from public.ocupaciones
      where estado = 'vencida' and cancelada_at > pg_catalog.now() - interval '7 days'),
    'leads_nuevos', (select count(*) from public.solicitudes_club where estado = 'nuevo'),
    'envios_con_error', (select count(*) from public.envios_notificacion where estado = 'error'),
    'operacion', public.estado_operacion()
  );
end;
$$;

create or replace function public.admin_clubes()
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.exigir_admin_global();
  return query
  select jsonb_build_object(
    'id', c.id,
    'nombre', c.nombre,
    'slug', c.slug,
    'zona', c.zona,
    'direccion', c.direccion,
    'publicado', c.publicado,
    'created_at', c.created_at,
    'canchas', (select count(*) from public.canchas ca where ca.club_id = c.id and ca.activa),
    'reservas_proximas', (select count(*) from public.ocupaciones o
      where o.club_id = c.id and o.tipo = 'reserva' and o.estado = 'confirmada' and o.inicio > pg_catalog.now()),
    'equipo', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', private.nombre_visible(u.nombre_completo, u.email),
        'email', u.email, 'rol', m.rol) order by m.rol, u.email)
      from public.club_miembros m join public.usuarios u on u.id = m.user_id where m.club_id = c.id), '[]'::jsonb)
  )
  from public.clubes c
  order by c.nombre;
end;
$$;

create or replace function public.admin_crear_club(
  p_nombre text,
  p_zona text default null,
  p_direccion text default null,
  p_latitud double precision default null,
  p_longitud double precision default null,
  p_telefono text default null,
  p_whatsapp text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_slug text;
  v_id bigint;
begin
  perform private.exigir_admin_global();
  v_nombre := private.texto(p_nombre, 'El nombre del club', 2, 120);
  if (p_latitud is null) <> (p_longitud is null) then raise exception 'Indicá latitud y longitud juntas'; end if;
  v_slug := private.slugificar(v_nombre);
  if length(v_slug) < 3 then v_slug := 'club-' || v_slug; end if;
  if exists (select 1 from public.clubes where slug = v_slug) then
    v_slug := left(v_slug, 50) || '-' || substr(md5(random()::text), 1, 6);
  end if;
  insert into public.clubes (nombre, slug, zona, direccion, latitud, longitud, telefono, whatsapp, publicado)
  values (v_nombre, v_slug, private.texto(p_zona, 'La zona', 0, 80), private.texto(p_direccion, 'La dirección', 0, 200),
    p_latitud, p_longitud, private.telefono(p_telefono), private.telefono(p_whatsapp), false)
  returning id into v_id;
  perform private.auditar(v_id, 'club.crear', 'club', v_id::text, jsonb_build_object('nombre', v_nombre));
  return jsonb_build_object('club_id', v_id, 'slug', v_slug);
end;
$$;

create or replace function public.admin_usuarios(p_busqueda text default null, p_limite integer default 50)
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_busqueda text := nullif(btrim(coalesce(p_busqueda, '')), '');
begin
  perform private.exigir_admin_global();
  return query
  select jsonb_build_object(
    'id', u.id,
    'nombre', u.nombre_completo,
    'email', u.email,
    'rol', u.rol,
    'nivel', u.nivel_voley,
    'telefono', u.telefono,
    'created_at', u.created_at,
    'habilitado', exists (select 1 from public.acceso_piloto a where a.usuario_id = u.id),
    'clubes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'rol', m.rol))
      from public.club_miembros m join public.clubes c on c.id = m.club_id where m.user_id = u.id), '[]'::jsonb)
  )
  from public.usuarios u
  where v_busqueda is null
    or u.email ilike '%' || replace(replace(replace(v_busqueda, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    or u.nombre_completo ilike '%' || replace(replace(replace(v_busqueda, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by u.created_at desc
  limit least(greatest(coalesce(p_limite, 50), 1), 200);
end;
$$;

create or replace function public.admin_configurar_operacion(
  p_reservas_pausadas boolean, p_requiere_lista_acceso boolean, p_motivo text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := private.exigir_admin_global();
begin
  update public.app_config
  set reservas_pausadas = coalesce(p_reservas_pausadas, true),
      requiere_lista_acceso = coalesce(p_requiere_lista_acceso, true),
      motivo_pausa = private.texto(p_motivo, 'El motivo', 0, 300),
      updated_at = pg_catalog.now(),
      updated_by = v_uid
  where id;
  perform private.auditar(null, 'operacion.configurar', 'app_config', null,
    jsonb_build_object('reservas_pausadas', p_reservas_pausadas, 'requiere_lista_acceso', p_requiere_lista_acceso));
  return public.estado_operacion();
end;
$$;

create or replace function public.admin_definir_acceso(p_usuario_id uuid, p_habilitado boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := private.exigir_admin_global();
begin
  if not exists (select 1 from public.usuarios where id = p_usuario_id) then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
  if p_habilitado then
    insert into public.acceso_piloto (usuario_id, habilitado_por) values (p_usuario_id, v_uid)
    on conflict (usuario_id) do nothing;
    perform private.notificar(p_usuario_id, 'acceso_habilitado', '¡Tu cuenta ya puede reservar!',
      'Ya podés pedir canchas y sumarte a partidos desde VoleyApp.', '/canchas', null, null, null, true);
  else
    delete from public.acceso_piloto where usuario_id = p_usuario_id;
  end if;
  perform private.auditar(null, case when p_habilitado then 'acceso.habilitar' else 'acceso.quitar' end,
    'usuario', p_usuario_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.admin_auditoria(p_limite integer default 200)
returns setof jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.exigir_admin_global();
  return query
  select jsonb_build_object('id', a.id, 'created_at', a.created_at, 'accion', a.accion, 'entidad', a.entidad,
    'entidad_id', a.entidad_id, 'detalle', a.detalle,
    'club', (select c.nombre from public.clubes c where c.id = a.club_id),
    'actor', case when a.actor_id is null then 'Sistema' else private.nombre_visible(u.nombre_completo, u.email) end)
  from public.auditoria a left join public.usuarios u on u.id = a.actor_id
  order by a.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end;
$$;

-- Ejecuta las tareas periódicas a demanda (útil si pg_cron no está activo).
create or replace function public.admin_ejecutar_tareas()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.exigir_admin_global();
  return private.procesar_tareas() || jsonb_build_object('fijos_generados', private.materializar_series());
end;
$$;

-- ---------------------------------------------------------------------------
-- Cola de emails: la Edge Function enviar-notificaciones (rol de servicio)
-- toma lotes, los envía y registra el resultado con reintentos exponenciales.
-- ---------------------------------------------------------------------------

create or replace function public.sistema_tomar_envios(p_limite integer default 20)
returns setof jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  -- Envíos que quedaron tomados por una ejecución interrumpida.
  update public.envios_notificacion
  set estado = 'pendiente'
  where estado = 'enviando' and proximo_intento_at < pg_catalog.now() - interval '15 minutes';
  return query
  update public.envios_notificacion e
  set estado = 'enviando', intentos = e.intentos + 1, proximo_intento_at = pg_catalog.now()
  where e.id in (
    select x.id from public.envios_notificacion x
    where x.estado = 'pendiente' and x.proximo_intento_at <= pg_catalog.now()
    order by x.id
    limit least(greatest(coalesce(p_limite, 20), 1), 100)
    for update skip locked
  )
  returning jsonb_build_object('id', e.id, 'destino', e.destino, 'asunto', e.asunto, 'cuerpo', e.cuerpo,
    'url', e.url, 'intentos', e.intentos);
end;
$$;

create or replace function public.sistema_resultado_envio(p_id bigint, p_ok boolean, p_error text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.envios_notificacion
  set estado = case when p_ok then 'enviado' when intentos >= 5 then 'error' else 'pendiente' end,
      enviado_at = case when p_ok then pg_catalog.now() end,
      ultimo_error = case when p_ok then null else left(p_error, 500) end,
      proximo_intento_at = case when p_ok then proximo_intento_at
        else pg_catalog.now() + make_interval(mins => (2 ^ least(intentos, 8))::int) end
  where id = p_id and estado = 'enviando';
end;
$$;

-- ---------------------------------------------------------------------------
-- Tareas programadas con pg_cron (si la extensión está disponible).
-- Sin pg_cron, las vencimientos igual se aplican al operar y el admin puede
-- ejecutar las tareas desde su panel.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron no disponible (%): habilitalo desde el panel de Supabase.', sqlerrm;
    end;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('voleyapp-tareas', '*/5 * * * *', 'select private.procesar_tareas()');
    perform cron.schedule('voleyapp-fijos', '15 6 * * *', 'select private.materializar_series()');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%' and p.proname <> 'admin_actualizar_rol'
      and p.proname in ('admin_resumen', 'admin_clubes', 'admin_crear_club', 'admin_usuarios',
        'admin_configurar_operacion', 'admin_definir_acceso', 'admin_auditoria', 'admin_ejecutar_tareas')
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to authenticated', f.firma);
  end loop;
end $$;

revoke all on function public.sistema_tomar_envios(integer) from public, anon, authenticated;
revoke all on function public.sistema_resultado_envio(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.sistema_tomar_envios(integer) to service_role;
grant execute on function public.sistema_resultado_envio(bigint, boolean, text) to service_role;
