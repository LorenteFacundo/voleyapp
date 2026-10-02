-- Cierre de seguridad urgente.
--
-- Se puede aplicar sola, antes del resto del plan, y es compatible con el
-- frontend publicado: solo quita accesos que ese frontend no usa y corrige
-- funciones sin cambiar su contrato.

-- 1. Vistas: nunca deben aceptar escrituras desde la API.
--    clubes_publicos perdió security_invoker al recrearse (20260527165602) y,
--    con los permisos por defecto de Supabase, anon podía modificar, crear y
--    borrar clubes a través de ella sin pasar por RLS.
alter view public.clubes_publicos set (security_invoker = true);

do $$
declare v record;
begin
  for v in
    select c.oid::regclass as vista
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on %s from public, anon, authenticated', v.vista);
  end loop;
end $$;

-- spatial_ref_sys pertenece a PostGIS (sin RLS). Si este rol no es su dueño,
-- el permiso se ajusta desde el panel.
do $$
begin
  revoke insert, update, delete, truncate on public.spatial_ref_sys from public, anon, authenticated;
exception when others then
  raise notice 'spatial_ref_sys: no se pudieron ajustar permisos (%).', sqlerrm;
end $$;

-- 2. Reservas y partidos heredados: cualquier usuario autenticado podía ocupar
--    o bloquear turnos de cualquier club (p_estado_final = 'bloqueado_club') o
--    insertar ocupaciones arbitrarias sin dejar registro.
do $$
declare firma text;
begin
  foreach firma in array array[
    'public.reservar_turno_rango(bigint,date,time,time)',
    'public.reservar_turno_rango(bigint,date,time,time,text)',
    'public.reservar_turno_virtual(integer,text,text,text,numeric,numeric)',
    'public.crear_partido_virtual(integer,text,text,text,numeric,numeric,integer,integer,integer,text,boolean,text)',
    'public.crear_partido(bigint,integer,integer,integer,character varying,boolean,character varying)',
    'public.crear_partido(bigint,integer,integer,integer,text,text,boolean)',
    -- unirse_a_partido no valida visibilidad ni token y cuenta el cupo sin
    -- bloquear el partido; el frontend publicado no la invoca.
    'public.unirse_a_partido(bigint)',
    -- Borrados físicos heredados (cascada sobre partidos, reservas y chat).
    'public.admin_cancelar_reserva(integer)',
    'public.admin_eliminar_turno(integer)',
    'public.admin_eliminar_cancha(integer)',
    'public.admin_eliminar_club(integer)',
    'public.admin_eliminar_horario_semanal(integer)',
    'public.admin_crear_turno(integer,text,text,text)'
  ] loop
    if to_regprocedure(firma) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', firma);
    end if;
  end loop;
end $$;

-- Las funciones de notificaciones solo tienen sentido con sesión iniciada.
revoke execute on function public.mis_notificaciones() from public, anon;
revoke execute on function public.marcar_notificacion_leida(bigint) from public, anon;
revoke execute on function public.marcar_todas_leidas() from public, anon;
grant execute on function public.mis_notificaciones() to authenticated;
grant execute on function public.marcar_notificacion_leida(bigint) to authenticated;
grant execute on function public.marcar_todas_leidas() to authenticated;

-- 3. Búsqueda de partidos: listaba partidos "solo por enlace" (y a anónimos).
create or replace function public.buscar_partidos(
  p_nivel text default null,
  p_texto text default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_radio_km int default null
)
returns setof json
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $function$
begin
  return query
  select json_build_object(
    'id', pp.id, 'organizador_id', pp.organizador_id,
    'estado_partido', pp.estado_partido, 'cupo_minimo', pp.cupo_minimo,
    'cupo_maximo', pp.cupo_maximo, 'cantidad_invitados_anonimos', pp.cantidad_invitados_anonimos,
    'nivel_requerido', pp.nivel_requerido, 'requiere_aprobacion', pp.requiere_aprobacion,
    'expira_pre_reserva_at', pp.expira_pre_reserva_at,
    'fecha', pp.fecha, 'hora_inicio', pp.hora_inicio, 'hora_fin', pp.hora_fin,
    'cancha_nombre', pp.cancha_nombre, 'precio_total', pp.precio_total,
    'precio_sena', pp.precio_sena, 'club_nombre', pp.club_nombre,
    'direccion', pp.direccion, 'latitud', pp.latitud, 'longitud', pp.longitud,
    'jugadores_confirmados', pp.jugadores_confirmados,
    'mi_estado_inscripcion', pp.mi_estado_inscripcion
  )
  from partidos_publicos pp
  join clubes cl on cl.id = pp.club_id
  where pp.visibilidad = 'publico'
    and (p_nivel is null or pp.nivel_requerido = p_nivel)
    and (p_texto is null or (
      pp.club_nombre ilike '%' || p_texto || '%'
      or pp.cancha_nombre ilike '%' || p_texto || '%'
      or coalesce(pp.direccion, '') ilike '%' || p_texto || '%'
    ))
    and (p_radio_km is null or p_lat is null or p_lng is null or
      st_dwithin(cl.ubicacion::geography, st_makepoint(p_lng, p_lat)::geography, p_radio_km * 1000))
  order by pp.fecha asc, pp.hora_inicio asc;
end;
$function$;
revoke execute on function public.buscar_partidos(text, text, numeric, numeric, integer) from public, anon;
grant execute on function public.buscar_partidos(text, text, numeric, numeric, integer) to authenticated;

-- Los tokens de partidos privados o "por enlace" estuvieron expuestos en vistas
-- públicas: se regeneran (los enlaces compartidos anteriormente dejan de servir).
update public.partidos
set token_invitacion = encode(extensions.gen_random_bytes(16), 'hex')
where coalesce(visibilidad, 'publico') <> 'publico';

-- 4. Perfiles: nadie crea ni borra filas de usuarios desde la API (las crea el
--    trigger de Auth). La política de alta permitía elegir cualquier rol.
drop policy if exists "Usuario crea su propio perfil" on public.usuarios;
revoke insert, delete, truncate, references, trigger on public.usuarios from public, anon, authenticated;
-- El rol solo es visible con sesión (el frontend publicado lee el propio).
revoke select (rol) on public.usuarios from anon;

-- El helper de políticas deja de depender de que el invocador pueda leer roles.
create or replace function private.is_admin_global()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid())
      and u.rol in ('admin_global', 'superadmin')
  );
$$;
revoke all on function private.is_admin_global() from public, anon;
grant execute on function private.is_admin_global() to authenticated;

-- Cambio de rol: sin autopromoción, y solo superadmin otorga o quita roles
-- de administración global.
create or replace function public.admin_actualizar_rol(p_usuario_id uuid, p_rol text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor text;
  v_actual text;
begin
  select u.rol into v_actor from public.usuarios u where u.id = (select auth.uid());
  if v_actor is null or v_actor not in ('admin_global', 'superadmin') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_usuario_id = (select auth.uid()) then
    raise exception 'No podés cambiar tu propio rol' using errcode = '42501';
  end if;
  if p_rol not in ('jugador', 'admin_cancha', 'admin_global', 'superadmin') then
    raise exception 'Rol inválido';
  end if;
  select u.rol into v_actual from public.usuarios u where u.id = p_usuario_id;
  if v_actual is null then raise exception 'Usuario no encontrado'; end if;
  if v_actor <> 'superadmin' and (p_rol in ('admin_global', 'superadmin') or v_actual in ('admin_global', 'superadmin')) then
    raise exception 'Solo un superadmin puede otorgar o quitar roles de administración global' using errcode = '42501';
  end if;
  update public.usuarios set rol = p_rol where id = p_usuario_id;
end;
$$;
revoke all on function public.admin_actualizar_rol(uuid, text) from public, anon;
grant execute on function public.admin_actualizar_rol(uuid, text) to authenticated;

-- 5. Formulario de clubes: el alta directa salteaba el límite de envíos de la
--    Edge Function. Desde ahora solo la función (rol de servicio) inserta.
revoke insert on public.solicitudes_club from public, anon, authenticated;
revoke usage on sequence public.solicitudes_club_id_seq from public, anon, authenticated;
drop policy if exists "Canchas pueden enviar su interés" on public.solicitudes_club;

create table if not exists public.captacion_limites (
  huella text primary key check (huella ~ '^[a-f0-9]{64}$'),
  ventana_inicio timestamptz not null,
  intentos integer not null check (intentos > 0)
);
alter table public.captacion_limites enable row level security;
revoke all on public.captacion_limites from public, anon, authenticated;

-- Hasta 5 envíos por hora por origen. Solo la Edge Function (service_role).
create or replace function public.captacion_registrar_intento(p_huella text)
returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_intentos integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_huella is null or p_huella !~ '^[a-f0-9]{64}$' then return false; end if;
  delete from public.captacion_limites where ventana_inicio < pg_catalog.now() - interval '1 day';
  insert into public.captacion_limites as l (huella, ventana_inicio, intentos)
  values (p_huella, pg_catalog.now(), 1)
  on conflict (huella) do update set
    intentos = case when l.ventana_inicio <= pg_catalog.now() - interval '1 hour' then 1 else l.intentos + 1 end,
    ventana_inicio = case when l.ventana_inicio <= pg_catalog.now() - interval '1 hour' then pg_catalog.now() else l.ventana_inicio end
  returning intentos into v_intentos;
  return v_intentos <= 5;
end;
$$;
revoke all on function public.captacion_registrar_intento(text) from public, anon, authenticated;
grant execute on function public.captacion_registrar_intento(text) to service_role;

-- 6. Funciones SECURITY DEFINER heredadas sin search_path fijo: se fija el
--    mismo que usaban en la práctica (sin cambiar su comportamiento).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef and p.proconfig is null
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.firma);
  end loop;
end $$;
