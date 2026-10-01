-- Retiro del acceso heredado. Se eliminan vistas y funciones reemplazadas por
-- el modelo v2; las tablas anteriores conservan sus datos pero dejan de estar
-- expuestas por la API. Desde aquí, todo acceso de clientes pasa por RPC
-- explícitas o por el catálogo público de clubes, canchas y horarios.

drop view if exists public.partido_detalle;
drop view if exists public.partidos_publicos;
drop view if exists public.partidos_listado;
drop view if exists public.turnos_disponibles_listado;
drop view if exists public.clubes_mapa;
drop view if exists public.clubes_publicos;
drop view if exists public.ranking_jugadores;

do $$
declare firma text;
begin
  foreach firma in array array[
    'public.crear_partido(bigint,integer,integer,integer,character varying,boolean,character varying)',
    'public.crear_partido(bigint,integer,integer,integer,text,text,boolean)',
    'public.crear_partido_virtual(integer,text,text,text,numeric,numeric,integer,integer,integer,text,boolean,text)',
    'public.reservar_turno_rango(bigint,date,time,time)',
    'public.reservar_turno_rango(bigint,date,time,time,text)',
    'public.reservar_turno_virtual(integer,text,text,text,numeric,numeric)',
    'public.obtener_turnos_disponibles(integer,date,date)',
    'public.unirse_a_partido(bigint)',
    'public.salirse_de_partido(bigint)',
    'public.buscar_partidos(text,text,numeric,numeric,integer)',
    'public.crear_notificacion(uuid,character varying,text,bigint)',
    'public.otorgar_puntos(uuid,integer,character varying,bigint)',
    'public.verificar_badges(uuid)',
    'public.admin_crear_cancha(text,text,double precision,double precision,text,numeric,numeric,text,text,text,text[],jsonb)',
    'public.admin_crear_cancha(text,text,double precision,double precision,text,numeric,numeric,text,text,text,text[],jsonb,bigint)',
    'public.admin_actualizar_club(integer,text,text,text,numeric,numeric)',
    'public.admin_eliminar_club(integer)',
    'public.admin_actualizar_cancha(integer,text,text,numeric,numeric,text[])',
    'public.admin_eliminar_cancha(integer)',
    'public.admin_crear_turno(integer,text,text,text)',
    'public.admin_eliminar_turno(integer)',
    'public.admin_cancelar_reserva(integer)',
    'public.admin_cancelar_partido(integer)',
    'public.admin_listar_clubes()',
    'public.admin_listar_canchas()',
    'public.admin_listar_turnos(integer,text,text)',
    'public.admin_listar_turnos_cancha(integer)',
    'public.admin_listar_reservas()',
    'public.admin_listar_partidos()',
    'public.admin_listar_usuarios()',
    'public.admin_listar_horarios_semanales(integer)',
    'public.admin_guardar_horarios_semanales(integer,jsonb)',
    'public.admin_eliminar_horario_semanal(integer)',
    'public.is_admin()'
  ] loop
    if to_regprocedure(firma) is not null then
      execute format('drop function %s', firma);
    end if;
  end loop;
end $$;

-- Tablas heredadas: sin acceso desde la API ni políticas abiertas.
drop policy if exists "Turnos visibles para todos" on public.disponibilidad_turnos;
drop policy if exists "Admins globales gestionan turnos" on public.disponibilidad_turnos;
drop policy if exists "Usuario pre-reserva turno disponible" on public.disponibilidad_turnos;
drop policy if exists "Usuario reserva rango dentro de bloque" on public.disponibilidad_turnos;
drop policy if exists "Reservas propias o admin global" on public.reservas;
drop policy if exists "Usuario crea su reserva" on public.reservas;
drop policy if exists "Usuario actualiza su reserva pendiente" on public.reservas;
drop policy if exists "Admins globales gestionan administradores de club" on public.administradores_club;
drop policy if exists "Admin de club ve su asignacion" on public.administradores_club;
revoke all on public.disponibilidad_turnos, public.reservas, public.administradores_club
  from public, anon, authenticated;

-- Partidos, participantes, perfiles, mensajes y notificaciones: solo por RPC.
drop policy if exists "Partidos públicos visibles" on public.partidos;
drop policy if exists "Partidos por enlace visibles" on public.partidos;
drop policy if exists "Usuario crea su partido" on public.partidos;
drop policy if exists "Organizador edita su partido" on public.partidos;
drop policy if exists "Lista de participantes visible" on public.participantes_partido;
drop policy if exists "Usuario se inscribe" on public.participantes_partido;
drop policy if exists "Organizador gestiona participantes" on public.participantes_partido;
drop policy if exists "Perfiles visibles para todos" on public.usuarios;
drop policy if exists "Actualizar propio perfil" on public.usuarios;
drop policy if exists "Usuario crea su propio perfil" on public.usuarios;
drop policy if exists "Mensajes visibles para participantes" on public.mensajes_partido;
drop policy if exists "Participantes envían mensajes" on public.mensajes_partido;
drop policy if exists "Usuario ve sus notificaciones" on public.notificaciones;
drop policy if exists "Usuario actualiza sus notificaciones" on public.notificaciones;
drop policy if exists "Badges de usuario visibles" on public.usuario_badges;
drop policy if exists "Usuario ve sus puntos" on public.puntos_actividad;
revoke all on public.partidos, public.participantes_partido, public.usuarios, public.mensajes_partido,
  public.notificaciones, public.usuario_badges, public.puntos_actividad
  from public, anon, authenticated;

-- Catálogo de logros: lectura pública.
revoke all on public.badges_catalogo from public, anon, authenticated;
grant select on public.badges_catalogo to anon, authenticated;

-- Bandeja de clubes interesados: el admin global la lee y actualiza.
revoke all on public.solicitudes_club from public, anon, authenticated;
grant select on public.solicitudes_club to authenticated;
grant update (estado, notas) on public.solicitudes_club to authenticated;

-- Objetos nuevos en public quedan cerrados por defecto: cada tabla o función
-- expuesta necesita un GRANT explícito (ver docs/arquitectura.md).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- Las secuencias existentes no se usan desde la API.
do $$
declare s record;
begin
  for s in
    select c.oid::regclass as secuencia from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('revoke all on sequence %s from public, anon, authenticated', s.secuencia);
  end loop;
end $$;

-- Toda función de public que no forme parte de la API publicada queda sin
-- ejecución para clientes (incluye funciones creadas a mano en el panel).
do $$
declare
  f record;
  v_api text[] := array[
    'estado_operacion', 'disponibilidad', 'explorar_partidos', 'partido_detalle', 'buscar_partido_por_token',
    'ranking', 'ver_invitacion_club', 'mi_perfil', 'actualizar_mi_perfil', 'mis_logros', 'solicitar_reserva',
    'cancelar_mi_reserva', 'informar_pago', 'mis_reservas', 'mis_partidos', 'enviar_mensaje', 'mensajes_partido',
    'mis_notificaciones', 'notificaciones_sin_leer', 'marcar_notificacion_leida', 'marcar_todas_leidas',
    'aceptar_invitacion_club', 'admin_actualizar_rol', 'admin_resumen', 'admin_clubes', 'admin_crear_club',
    'admin_usuarios', 'admin_configurar_operacion', 'admin_definir_acceso', 'admin_auditoria',
    'admin_ejecutar_tareas', 'sistema_tomar_envios', 'sistema_resultado_envio', 'captacion_registrar_intento'
  ];
begin
  for f in
    select p.oid::regprocedure as firma from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and not (p.proname = any (v_api) or p.proname like 'club\_%' or p.proname like 'partido\_%')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
  end loop;
end $$;

notify pgrst, 'reload schema';
