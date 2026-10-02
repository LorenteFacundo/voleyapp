-- Modelo v2: una única fuente de ocupación de canchas para reservas de la app,
-- reservas cargadas por el club (WhatsApp, teléfono, mostrador), alquileres
-- fijos y bloqueos; más clientes del club, pagos, equipo y auditoría.
--
-- Todas las tablas nuevas tienen RLS sin políticas: se accede únicamente por
-- funciones RPC que validan permisos. Solo el catálogo público (clubes,
-- canchas y horarios publicados) se lee directo, con columnas acotadas.

-- ---------------------------------------------------------------------------
-- Utilidades de esquema
-- ---------------------------------------------------------------------------

-- Elimina restricciones CHECK de una columna cuyo nombre no se conoce con
-- certeza (algunas tablas se crearon desde el panel).
create or replace function private.quitar_checks_columna(p_tabla regclass, p_columna text)
returns void
language plpgsql
set search_path = ''
as $$
declare r record;
begin
  for r in
    select c.conname from pg_catalog.pg_constraint c
    where c.conrelid = p_tabla and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) ~ ('\m' || p_columna || '\M')
  loop
    execute pg_catalog.format('alter table %s drop constraint %I', p_tabla, r.conname);
  end loop;
end;
$$;
revoke all on function private.quitar_checks_columna(regclass, text) from public, anon, authenticated;

create or replace function private.marcar_actualizacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function private.marcar_actualizacion() from public, anon, authenticated;

-- Slug legible para URLs públicas (/club/mi-club).
create or replace function private.slugificar(p_texto text)
returns text
language sql immutable
set search_path = ''
as $$
  select pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.translate(pg_catalog.lower(coalesce(p_texto, '')),
        'áàâäãéèêëíìîïóòôöõúùûüñç', 'aaaaaeeeeiiiiooooouuuunc'),
      '[^a-z0-9]+', '-', 'g'),
    '-')
$$;
revoke all on function private.slugificar(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------------

alter table public.usuarios
  add column if not exists telefono text,
  add column if not exists updated_at timestamptz not null default now();

-- Nombres limpios (sin saltos de línea ni controles). Si falta, "Jugador":
-- nunca se publica la parte local del email como nombre.
update public.usuarios
set nombre_completo = left(btrim(regexp_replace(nombre_completo, '[\s\x01-\x1f\x7f]+', ' ', 'g')), 80)
where nombre_completo ~ '[\x01-\x1f\x7f]' or nombre_completo <> btrim(nombre_completo) or length(nombre_completo) > 80;
update public.usuarios
set nombre_completo = 'Jugador'
where nombre_completo is null or length(btrim(nombre_completo)) < 2;
update public.usuarios set puntos_total = 0 where puntos_total is null;
update public.usuarios set partidos_jugados = 0 where partidos_jugados is null;

alter table public.usuarios
  alter column puntos_total set default 0,
  alter column puntos_total set not null,
  alter column partidos_jugados set default 0,
  alter column partidos_jugados set not null;

alter table public.usuarios drop constraint if exists usuarios_telefono_formato;
alter table public.usuarios
  add constraint usuarios_telefono_formato check (telefono is null or telefono ~ '^[0-9]{8,15}$');

drop trigger if exists usuarios_actualizado on public.usuarios;
create trigger usuarios_actualizado before update on public.usuarios
  for each row execute function private.marcar_actualizacion();

-- ---------------------------------------------------------------------------
-- Clubes
-- ---------------------------------------------------------------------------

alter table public.clubes
  add column if not exists slug text,
  add column if not exists descripcion text,
  add column if not exists zona text,
  add column if not exists whatsapp text,
  add column if not exists instagram text,
  add column if not exists alias_pago text,
  add column if not exists titular_pago text,
  add column if not exists latitud double precision,
  add column if not exists longitud double precision,
  add column if not exists publicado boolean not null default false,
  add column if not exists confirmacion_automatica boolean not null default false,
  add column if not exists anticipacion_minima_min integer not null default 60,
  add column if not exists ventana_reserva_dias integer not null default 21,
  add column if not exists cancelacion_horas integer not null default 24,
  add column if not exists respuesta_horas integer not null default 12,
  add column if not exists politicas text,
  add column if not exists updated_at timestamptz not null default now();

-- Coordenadas planas: dejan de depender de PostGIS para el mapa y la búsqueda.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'postgis')
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'clubes' and column_name = 'ubicacion') then
    execute 'update public.clubes set latitud = st_y(ubicacion::geometry), longitud = st_x(ubicacion::geometry)
             where ubicacion is not null and latitud is null';
  end if;
end $$;

-- Los clubes existentes ya estaban visibles en la app.
update public.clubes set publicado = true where slug is null;

-- Datos existentes normalizados antes de agregar restricciones.
update public.clubes set nombre = left(btrim(nombre), 120) where length(btrim(nombre)) > 120 or nombre <> btrim(nombre);
update public.clubes set nombre = 'Club ' || id where length(btrim(coalesce(nombre, ''))) < 2;

update public.clubes c
set slug = case
  when length(rtrim(left(private.slugificar(c.nombre), 50), '-')) >= 3 then rtrim(left(private.slugificar(c.nombre), 50), '-')
  else 'club-' || c.id
end
where c.slug is null;

update public.clubes c
set slug = c.slug || '-' || c.id
where exists (select 1 from public.clubes o where o.slug = c.slug and o.id < c.id);

alter table public.clubes alter column slug set not null;
create unique index if not exists clubes_slug_unico on public.clubes (slug);

alter table public.clubes
  add constraint clubes_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  add constraint clubes_nombre_largo check (length(btrim(nombre)) between 2 and 120),
  add constraint clubes_descripcion_largo check (descripcion is null or length(descripcion) <= 1000),
  add constraint clubes_zona_largo check (zona is null or length(zona) <= 80),
  add constraint clubes_whatsapp_formato check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  add constraint clubes_instagram_formato check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add constraint clubes_alias_largo check (alias_pago is null or length(alias_pago) <= 60),
  add constraint clubes_titular_largo check (titular_pago is null or length(titular_pago) <= 100),
  add constraint clubes_politicas_largo check (politicas is null or length(politicas) <= 1500),
  add constraint clubes_coordenadas check (
    (latitud is null and longitud is null)
    or (latitud between -90 and 90 and longitud between -180 and 180)),
  add constraint clubes_anticipacion check (anticipacion_minima_min between 0 and 10080),
  add constraint clubes_ventana check (ventana_reserva_dias between 1 and 60),
  add constraint clubes_cancelacion check (cancelacion_horas between 0 and 168),
  add constraint clubes_respuesta check (respuesta_horas between 1 and 72);

drop trigger if exists clubes_actualizado on public.clubes;
create trigger clubes_actualizado before update on public.clubes
  for each row execute function private.marcar_actualizacion();

-- ---------------------------------------------------------------------------
-- Canchas
-- ---------------------------------------------------------------------------

alter table public.canchas
  add column if not exists activa boolean not null default true,
  add column if not exists orden integer not null default 0,
  add column if not exists techada boolean not null default true,
  add column if not exists superficie text,
  add column if not exists updated_at timestamptz not null default now();

update public.canchas set fotos = '{}' where fotos is null;
update public.canchas set titulo = left(btrim(titulo), 80) where length(btrim(titulo)) > 80 or titulo <> btrim(titulo);
update public.canchas set titulo = btrim('Cancha ' || coalesce(btrim(titulo), '')) where length(btrim(coalesce(titulo, ''))) < 2;
update public.canchas set descripcion = left(descripcion, 1000) where length(descripcion) > 1000;
update public.canchas set precio_total = greatest(precio_total, 0), precio_sena = greatest(precio_sena, 0)
where precio_total < 0 or precio_sena < 0;

alter table public.canchas
  add constraint canchas_superficie check (superficie is null or superficie in ('parquet', 'sintetico', 'cemento', 'arena', 'otro')),
  add constraint canchas_titulo_largo check (length(btrim(titulo)) between 2 and 80),
  add constraint canchas_descripcion_largo check (descripcion is null or length(descripcion) <= 1000),
  add constraint canchas_precios check (precio_total >= 0 and precio_sena >= 0);

do $$
begin
  if not exists (select 1 from public.canchas where club_id is null) then
    alter table public.canchas alter column club_id set not null;
  else
    raise notice 'Hay canchas sin club: club_id sigue admitiendo nulos.';
  end if;
end $$;

-- Permite referencias compuestas (cancha, club) que garantizan coherencia.
create unique index if not exists canchas_id_club on public.canchas (id, club_id);

drop trigger if exists canchas_actualizado on public.canchas;
create trigger canchas_actualizado before update on public.canchas
  for each row execute function private.marcar_actualizacion();

-- ---------------------------------------------------------------------------
-- Horarios publicados (plantilla semanal de bloques reservables)
-- Un bloque con hora_fin <= hora_inicio termina al día siguiente.
-- ---------------------------------------------------------------------------

update public.horarios_semanales set activo = true where activo is null;
update public.horarios_semanales set precio_sena = 0 where precio_sena is null;
update public.horarios_semanales set precio_sena = precio_total where precio_sena > precio_total;
delete from public.horarios_semanales where cancha_id is null or hora_inicio = hora_fin;

alter table public.horarios_semanales
  alter column activo set not null,
  alter column activo set default true,
  alter column precio_sena set not null,
  alter column precio_sena set default 0,
  alter column cancha_id set not null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.horarios_semanales
  add constraint horarios_rango check (hora_inicio <> hora_fin),
  add constraint horarios_precios check (precio_total >= 0 and precio_sena >= 0 and precio_sena <= precio_total);

create index if not exists horarios_cancha_dia on public.horarios_semanales (cancha_id, dia_semana);

drop trigger if exists horarios_actualizado on public.horarios_semanales;
create trigger horarios_actualizado before update on public.horarios_semanales
  for each row execute function private.marcar_actualizacion();

-- ---------------------------------------------------------------------------
-- Equipo del club
-- ---------------------------------------------------------------------------

create table public.club_miembros (
  club_id bigint not null references public.clubes(id) on delete cascade,
  user_id uuid not null references public.usuarios(id) on delete cascade,
  rol text not null check (rol in ('dueno', 'encargado')),
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id) on delete set null,
  primary key (club_id, user_id)
);
create index club_miembros_usuario on public.club_miembros (user_id);

create table public.club_invitaciones (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubes(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  rol text not null check (rol in ('dueno', 'encargado')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expira_at timestamptz not null,
  creada_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  aceptada_at timestamptz,
  aceptada_por uuid references public.usuarios(id) on delete set null,
  revocada_at timestamptz
);
create index club_invitaciones_club on public.club_invitaciones (club_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Clientes del club (agenda de contactos propia de cada club)
-- ---------------------------------------------------------------------------

create table public.clientes_club (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubes(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 2 and 120),
  telefono text check (telefono ~ '^[0-9]{8,15}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  usuario_id uuid references public.usuarios(id) on delete set null,
  notas text check (length(notas) <= 1000),
  archivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, usuario_id),
  unique (id, club_id)
);
create index clientes_club_nombre on public.clientes_club (club_id, lower(nombre));
create index clientes_club_telefono on public.clientes_club (club_id, telefono) where telefono is not null;

create trigger clientes_club_actualizado before update on public.clientes_club
  for each row execute function private.marcar_actualizacion();

-- ---------------------------------------------------------------------------
-- Alquileres fijos (series semanales). Sus fechas se materializan como
-- ocupaciones, de modo que cada semana tiene su propio cobro y asistencia.
-- ---------------------------------------------------------------------------

create table public.series (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubes(id) on delete cascade,
  cancha_id bigint not null,
  cliente_id bigint,
  titulo text not null check (length(btrim(titulo)) between 2 and 120),
  dia_semana integer not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  duracion_min integer not null check (duracion_min between 30 and 720 and duracion_min % 15 = 0),
  desde date not null,
  hasta date,
  precio numeric(12, 2) not null default 0 check (precio >= 0),
  activa boolean not null default true,
  notas text check (length(notas) <= 500),
  creada_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hasta is null or hasta >= desde),
  unique (id, club_id),
  foreign key (cancha_id, club_id) references public.canchas (id, club_id),
  foreign key (cliente_id, club_id) references public.clientes_club (id, club_id) on delete set null (cliente_id)
);
create index series_club on public.series (club_id) where activa;

create trigger series_actualizado before update on public.series
  for each row execute function private.marcar_actualizacion();

-- ---------------------------------------------------------------------------
-- Ocupaciones: toda reserva o bloqueo de una cancha en un período.
-- La restricción de exclusión impide superposiciones entre ocupaciones
-- pendientes o confirmadas de la misma cancha, incluso con concurrencia.
-- ---------------------------------------------------------------------------

create table public.ocupaciones (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubes(id),
  cancha_id bigint not null,
  inicio timestamptz not null,
  fin timestamptz not null,
  tipo text not null default 'reserva' check (tipo in ('reserva', 'bloqueo')),
  estado text not null check (estado in ('pendiente', 'confirmada', 'rechazada', 'cancelada', 'vencida')),
  origen text not null check (origen in ('app', 'whatsapp', 'telefono', 'mostrador', 'fijo', 'otro')),
  usuario_id uuid references public.usuarios(id) on delete set null,
  cliente_id bigint,
  serie_id bigint,
  -- Fecha de la serie a la que corresponde (no cambia si la fecha se mueve).
  serie_fecha date,
  titulo text check (length(titulo) <= 120),
  precio numeric(12, 2) not null default 0 check (precio >= 0),
  sena numeric(12, 2) not null default 0 check (sena >= 0),
  pagado numeric(12, 2) not null default 0,
  asistencia text check (asistencia in ('jugaron', 'no_vinieron')),
  notas text check (length(notas) <= 500),
  vence_at timestamptz,
  pago_informado_at timestamptz,
  recordatorio_at timestamptz,
  motivo_cancelacion text check (length(motivo_cancelacion) <= 300),
  cancelada_por text check (cancelada_por in ('club', 'jugador', 'sistema')),
  cancelada_at timestamptz,
  creada_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  legado_turno_id bigint unique,
  legado_reserva_id bigint unique,
  -- Una reserva dura hasta 12 horas; un bloqueo (lluvia, feriado, torneo) hasta 7 días.
  constraint ocupaciones_rango check (fin > inicio and fin - inicio <= case
    when tipo = 'bloqueo' then interval '7 days' else interval '12 hours' end),
  constraint ocupaciones_pendiente_vence check (estado <> 'pendiente' or vence_at is not null),
  constraint ocupaciones_serie_fecha check (serie_id is null or serie_fecha is not null),
  unique (id, club_id),
  foreign key (cancha_id, club_id) references public.canchas (id, club_id),
  foreign key (cliente_id, club_id) references public.clientes_club (id, club_id) on delete set null (cliente_id),
  foreign key (serie_id, club_id) references public.series (id, club_id) on delete set null (serie_id),
  constraint ocupaciones_sin_superposicion exclude using gist (
    cancha_id with =,
    tstzrange(inicio, fin, '[)') with &&
  ) where (estado in ('pendiente', 'confirmada'))
);
-- Una fecha de un fijo existe una sola vez aunque se la mueva de horario.
create unique index ocupaciones_serie_fecha on public.ocupaciones (serie_id, serie_fecha) where serie_id is not null;
create index ocupaciones_club_inicio on public.ocupaciones (club_id, inicio);
create index ocupaciones_usuario on public.ocupaciones (usuario_id, inicio desc) where usuario_id is not null;
create index ocupaciones_cliente on public.ocupaciones (cliente_id) where cliente_id is not null;
create index ocupaciones_pendientes on public.ocupaciones (vence_at) where estado = 'pendiente';

create trigger ocupaciones_actualizado before update on public.ocupaciones
  for each row execute function private.marcar_actualizacion();

-- ---------------------------------------------------------------------------
-- Pagos registrados por el club (montos negativos = devoluciones)
-- ---------------------------------------------------------------------------

create table public.pagos (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubes(id),
  ocupacion_id bigint,
  cliente_id bigint,
  monto numeric(12, 2) not null check (monto <> 0 and abs(monto) <= 100000000),
  medio text not null check (medio in ('efectivo', 'transferencia', 'mercadopago', 'tarjeta', 'otro')),
  fecha date not null,
  nota text check (length(nota) <= 300),
  registrado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  anulado_at timestamptz,
  anulado_por uuid references public.usuarios(id) on delete set null,
  check (ocupacion_id is not null or cliente_id is not null),
  foreign key (ocupacion_id, club_id) references public.ocupaciones (id, club_id),
  foreign key (cliente_id, club_id) references public.clientes_club (id, club_id) on delete set null (cliente_id)
);
create index pagos_club_fecha on public.pagos (club_id, fecha desc);
create index pagos_ocupacion on public.pagos (ocupacion_id) where ocupacion_id is not null;
create index pagos_cliente on public.pagos (cliente_id) where cliente_id is not null;

-- ---------------------------------------------------------------------------
-- Auditoría de acciones sensibles
-- ---------------------------------------------------------------------------

create table public.auditoria (
  id bigint generated always as identity primary key,
  club_id bigint references public.clubes(id) on delete cascade,
  actor_id uuid references public.usuarios(id) on delete set null,
  accion text not null,
  entidad text not null,
  entidad_id text,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index auditoria_club_fecha on public.auditoria (club_id, created_at desc);
create index auditoria_fecha on public.auditoria (created_at desc);

-- ---------------------------------------------------------------------------
-- Operación del piloto: pausa global y lista de acceso, controladas en el
-- servidor (la interfaz solo refleja este estado).
-- ---------------------------------------------------------------------------

create table public.app_config (
  id boolean primary key default true check (id),
  reservas_pausadas boolean not null default true,
  motivo_pausa text check (length(motivo_pausa) <= 300),
  requiere_lista_acceso boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.usuarios(id) on delete set null
);
insert into public.app_config (id, motivo_pausa)
values (true, 'Las reservas de jugadores se habilitan al iniciar el piloto.')
on conflict (id) do nothing;

create table public.acceso_piloto (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  habilitado_at timestamptz not null default now(),
  habilitado_por uuid references public.usuarios(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Partidos: se apoyan en una ocupación de la nueva agenda.
-- ---------------------------------------------------------------------------

alter table public.partidos
  add column if not exists ocupacion_id bigint references public.ocupaciones(id),
  add column if not exists club_id bigint references public.clubes(id),
  add column if not exists descripcion text,
  add column if not exists precio_por_jugador numeric(12, 2),
  add column if not exists cancelado_at timestamptz,
  add column if not exists finalizado_at timestamptz,
  add column if not exists minimo_avisado_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists partidos_ocupacion_unica on public.partidos (ocupacion_id) where ocupacion_id is not null;

-- Valores existentes completados y acotados antes de exigirlos.
update public.partidos set cupo_minimo = 12 where cupo_minimo is null;
update public.partidos set cupo_maximo = greatest(cupo_minimo, 18) where cupo_maximo is null;
update public.partidos set visibilidad = 'publico' where visibilidad is null;
update public.partidos set nivel_requerido = 'recreativo' where nivel_requerido is null;
update public.partidos set estado_partido = 'borrador' where estado_partido is null;
update public.partidos set cantidad_invitados_anonimos = 0 where cantidad_invitados_anonimos is null;
update public.partidos set cantidad_invitados_anonimos = greatest(0, least(cantidad_invitados_anonimos, cupo_maximo - 1))
where cantidad_invitados_anonimos < 0 or cantidad_invitados_anonimos >= cupo_maximo;
alter table public.partidos
  alter column cupo_minimo set not null,
  alter column cupo_maximo set not null,
  alter column visibilidad set not null,
  alter column nivel_requerido set not null,
  alter column estado_partido set not null,
  alter column cantidad_invitados_anonimos set not null;

select private.quitar_checks_columna('public.partidos'::regclass, 'estado_partido');
alter table public.partidos
  add constraint partidos_estado check (estado_partido in
    ('borrador', 'pre_reservado', 'abierto', 'confirmado', 'cancelado', 'finalizado')),
  add constraint partidos_descripcion_largo check (descripcion is null or length(descripcion) <= 500),
  add constraint partidos_precio_jugador check (precio_por_jugador is null or precio_por_jugador >= 0),
  add constraint partidos_invitados check (cantidad_invitados_anonimos >= 0 and cantidad_invitados_anonimos < cupo_maximo);

drop trigger if exists partidos_actualizado on public.partidos;
create trigger partidos_actualizado before update on public.partidos
  for each row execute function private.marcar_actualizacion();

create index if not exists participantes_usuario_estado on public.participantes_partido (usuario_id, estado_inscripcion);
drop index if exists public.idx_participantes_partido_id;

-- ---------------------------------------------------------------------------
-- Notificaciones y su cola de envío por email (outbox con reintentos)
-- ---------------------------------------------------------------------------

alter table public.notificaciones
  add column if not exists cuerpo text,
  add column if not exists url text,
  add column if not exists club_id bigint references public.clubes(id) on delete cascade,
  add column if not exists ocupacion_id bigint references public.ocupaciones(id) on delete set null;

update public.notificaciones set leida = false where leida is null;
alter table public.notificaciones
  alter column leida set not null,
  alter column leida set default false,
  add constraint notificaciones_url_interna check (url is null or url ~ '^/[A-Za-z0-9/_?=&%.-]*$');

create index if not exists notificaciones_usuario_fecha on public.notificaciones (usuario_id, created_at desc);
create index if not exists mensajes_partido_fecha on public.mensajes_partido (partido_id, created_at desc);

create table public.envios_notificacion (
  id bigint generated always as identity primary key,
  notificacion_id bigint not null references public.notificaciones(id) on delete cascade,
  canal text not null check (canal in ('email')),
  destino text not null,
  asunto text not null,
  cuerpo text not null,
  url text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviando', 'enviado', 'error', 'descartado')),
  intentos integer not null default 0,
  proximo_intento_at timestamptz not null default now(),
  ultimo_error text,
  created_at timestamptz not null default now(),
  enviado_at timestamptz,
  unique (notificacion_id, canal)
);
create index envios_pendientes on public.envios_notificacion (proximo_intento_at) where estado = 'pendiente';

-- ---------------------------------------------------------------------------
-- Formulario de clubes interesados: notas internas del equipo.
-- ---------------------------------------------------------------------------

alter table public.solicitudes_club add column if not exists notas text;
alter table public.solicitudes_club
  add constraint solicitudes_club_notas_largo check (notas is null or length(notas) <= 1000);

-- ---------------------------------------------------------------------------
-- Acceso desde la API
-- ---------------------------------------------------------------------------

alter table public.club_miembros enable row level security;
alter table public.club_invitaciones enable row level security;
alter table public.clientes_club enable row level security;
alter table public.series enable row level security;
alter table public.ocupaciones enable row level security;
alter table public.pagos enable row level security;
alter table public.auditoria enable row level security;
alter table public.app_config enable row level security;
alter table public.acceso_piloto enable row level security;
alter table public.envios_notificacion enable row level security;

revoke all on
  public.club_miembros, public.club_invitaciones, public.clientes_club, public.series,
  public.ocupaciones, public.pagos, public.auditoria, public.app_config, public.acceso_piloto,
  public.envios_notificacion
from public, anon, authenticated;

-- Catálogo público: solo clubes publicados, canchas activas y sus horarios.
drop policy if exists "Clubes visibles para todos" on public.clubes;
drop policy if exists "Admins globales gestionan clubes" on public.clubes;
drop policy if exists "Canchas visibles para todos" on public.canchas;
drop policy if exists "Admins globales gestionan canchas" on public.canchas;
drop policy if exists "Lectura pública horarios semanales" on public.horarios_semanales;
drop policy if exists "Admin gestiona horarios semanales" on public.horarios_semanales;

revoke all on public.clubes, public.canchas, public.horarios_semanales from public, anon, authenticated;

grant select (id, nombre, slug, direccion, zona, telefono, whatsapp, instagram, descripcion,
  latitud, longitud, politicas, confirmacion_automatica, anticipacion_minima_min,
  ventana_reserva_dias, cancelacion_horas, respuesta_horas, publicado)
  on public.clubes to anon, authenticated;
grant select (id, club_id, nombre_identificador, titulo, descripcion, fotos, precio_total,
  precio_sena, techada, superficie, orden, activa)
  on public.canchas to anon, authenticated;
grant select (id, cancha_id, dia_semana, hora_inicio, hora_fin, precio_total, precio_sena, activo)
  on public.horarios_semanales to anon, authenticated;

create policy "Clubes publicados" on public.clubes
  for select to anon, authenticated using (publicado);
create policy "Canchas activas de clubes publicados" on public.canchas
  for select to anon, authenticated
  using (activa and exists (select 1 from public.clubes c where c.id = canchas.club_id and c.publicado));
create policy "Horarios de canchas visibles" on public.horarios_semanales
  for select to anon, authenticated
  using (activo and exists (select 1 from public.canchas ca where ca.id = horarios_semanales.cancha_id));

-- Fotos de canchas: además del admin global, el dueño sube a la carpeta de su
-- club (club-<id>/archivo).
create or replace function private.club_de_ruta_foto(p_nombre text)
returns bigint
language sql immutable
set search_path = ''
as $$
  select case
    when p_nombre ~ '^club-[0-9]{1,18}/[A-Za-z0-9._-]{1,120}$'
      then pg_catalog.split_part(pg_catalog.split_part(p_nombre, '/', 1), '-', 2)::bigint
  end
$$;
revoke all on function private.club_de_ruta_foto(text) from public, anon;
grant execute on function private.club_de_ruta_foto(text) to authenticated;
