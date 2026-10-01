-- Chequeo previo, SOLO LECTURA: correr en el SQL Editor de producción antes de
-- aplicar las migraciones 20261001130000 en adelante. No modifica nada.
-- Cada consulta lista filas que la migración va a normalizar, omitir o cerrar.

-- 1. Resumen de lo que se va a trasladar.
select
  (select count(*) from public.clubes) as clubes,
  (select count(*) from public.canchas) as canchas,
  (select count(*) from public.horarios_semanales) as horarios,
  (select count(*) from public.disponibilidad_turnos where estado in ('reservado', 'pre_reservado', 'bloqueado_club')) as turnos_ocupados,
  (select count(*) from public.reservas) as reservas,
  (select count(*) from public.partidos) as partidos,
  (select count(*) from public.usuarios) as usuarios,
  (select count(*) from public.administradores_club) as administradores_club;

-- 2. Datos que se normalizan antes de agregar restricciones.
select 'club con nombre fuera de 2..120' as caso, id::text, nombre as valor from public.clubes
  where length(btrim(coalesce(nombre, ''))) not between 2 and 120
union all
select 'cancha con título fuera de 2..80', id::text, titulo from public.canchas
  where length(btrim(coalesce(titulo, ''))) not between 2 and 80
union all
select 'cancha sin club (club_id seguirá admitiendo nulos)', id::text, titulo from public.canchas where club_id is null
union all
select 'precio negativo en cancha', id::text, precio_total::text from public.canchas where precio_total < 0 or precio_sena < 0
union all
select 'horario sin cancha o con inicio = fin (se elimina)', id::text, hora_inicio::text from public.horarios_semanales
  where cancha_id is null or hora_inicio = hora_fin
union all
select 'seña mayor al total en horario (se iguala)', id::text, precio_sena::text from public.horarios_semanales
  where precio_sena > precio_total
union all
select 'partido con invitados >= cupo máximo (se acota)', id::text, cantidad_invitados_anonimos::text from public.partidos
  where cantidad_invitados_anonimos >= cupo_maximo
union all
select 'usuario sin nombre o con caracteres de control (pasa a "Jugador" o se limpia)', id::text, coalesce(nombre_completo, '(vacío)')
  from public.usuarios where length(btrim(coalesce(nombre_completo, ''))) < 2 or nombre_completo ~ '[\x01-\x1f\x7f]';

-- 3. Turnos ocupados que NO se van a trasladar (quedan en private.migracion_omitidos).
select dt.id, dt.fecha, dt.hora_inicio, dt.hora_fin, dt.estado, 'dura más de 12 horas' as motivo
from public.disponibilidad_turnos dt
where dt.estado in ('reservado', 'pre_reservado')
  and ((dt.fecha + dt.hora_fin) - (dt.fecha + dt.hora_inicio)) > interval '12 hours'
union all
select a.id, a.fecha, a.hora_inicio, a.hora_fin, a.estado, 'se superpone con el turno ' || b.id
from public.disponibilidad_turnos a
join public.disponibilidad_turnos b on a.id > b.id and a.cancha_id = b.cancha_id and a.fecha = b.fecha
  and a.hora_inicio < b.hora_fin and b.hora_inicio < a.hora_fin
where a.estado <> 'disponible' and b.estado <> 'disponible';

-- 4. Funciones de public que quedarán sin ejecución para clientes (si alguna
--    se usa desde otra integración, hay que concederla de nuevo a propósito).
select p.oid::regprocedure as funcion
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  and p.proname not like 'club\_%' and p.proname not like 'partido\_%' and p.proname not like 'admin\_%'
  and p.proname not like 'sistema\_%'
order by 1;

-- 5. Vistas de public que quedarán sin acceso para clientes.
select c.oid::regclass as vista from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm')
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');

-- 6. Dueño de PostGIS (si no es postgres, cerrar su acceso desde el panel).
select e.extname, e.extversion, r.rolname as dueno, n.nspname as esquema
from pg_extension e join pg_roles r on r.oid = e.extowner join pg_namespace n on n.oid = e.extnamespace
where e.extname in ('postgis', 'pgcrypto', 'btree_gist', 'pg_cron', 'pg_net');
