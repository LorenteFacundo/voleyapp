-- ============================================================
-- VoleyApp - Schema completo (migración inicial)
-- Fecha: 2026-06-05
-- Descripción: Snapshot del estado actual de la base de datos
--              incluyendo tablas, vistas, funciones, RLS.
-- ============================================================

-- ============ EXTENSIONES ============
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============ SCHEMA PRIVATE ============
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin_global()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and u.rol in ('admin_global', 'superadmin')
  );
$function$;

-- ============ TABLAS ============

-- usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo varchar,
  email varchar NOT NULL UNIQUE,
  nivel_voley int CHECK (nivel_voley >= 1 AND nivel_voley <= 10),
  rol varchar DEFAULT 'jugador' CHECK (rol IN ('jugador', 'admin_cancha', 'admin_global', 'superadmin')),
  created_at timestamptz DEFAULT timezone('utc', now())
);

-- clubes
CREATE TABLE IF NOT EXISTS public.clubes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre varchar NOT NULL,
  direccion varchar,
  telefono varchar,
  ubicacion geometry(Point, 4326),
  created_at timestamptz DEFAULT timezone('utc', now())
);

-- canchas
CREATE TABLE IF NOT EXISTS public.canchas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id bigint REFERENCES public.clubes(id),
  nombre_identificador varchar NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  fotos text[] DEFAULT '{}',
  precio_total numeric NOT NULL,
  precio_sena numeric NOT NULL
);

-- disponibilidad_turnos
CREATE TABLE IF NOT EXISTS public.disponibilidad_turnos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cancha_id bigint REFERENCES public.canchas(id),
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  estado varchar DEFAULT 'disponible'
    CHECK (estado IN ('disponible', 'pre_reservado', 'reservado', 'bloqueado_club'))
);

-- horarios_semanales
CREATE TABLE IF NOT EXISTS public.horarios_semanales (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cancha_id int REFERENCES public.canchas(id),
  dia_semana int NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  precio_total numeric NOT NULL,
  precio_sena numeric DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- reservas
CREATE TABLE IF NOT EXISTS public.reservas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  turno_id bigint REFERENCES public.disponibilidad_turnos(id),
  usuario_id uuid REFERENCES public.usuarios(id),
  monto_sena_pagado numeric DEFAULT 0,
  monto_cargo_servicio numeric DEFAULT 0,
  estado_pago varchar DEFAULT 'pendiente'
    CHECK (estado_pago IN ('pendiente', 'aprobado', 'expirado')),
  id_transaccion_mp varchar,
  expira_at timestamptz,
  created_at timestamptz DEFAULT timezone('utc', now())
);

-- partidos
CREATE TABLE IF NOT EXISTS public.partidos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reserva_id bigint REFERENCES public.reservas(id),
  organizador_id uuid REFERENCES public.usuarios(id),
  cupo_minimo int DEFAULT 12,
  cupo_maximo int DEFAULT 18,
  cantidad_invitados_anonimos int DEFAULT 0,
  visibilidad varchar DEFAULT 'publico'
    CHECK (visibilidad IN ('publico', 'privado', 'enlace')),
  estado_partido varchar DEFAULT 'borrador'
    CHECK (estado_partido IN ('borrador', 'pre_reservado', 'confirmado', 'cancelado')),
  token_invitacion varchar UNIQUE,
  nivel_requerido varchar DEFAULT 'recreativo'
    CHECK (nivel_requerido IN ('recreativo', 'intermedio', 'competitivo')),
  requiere_aprobacion boolean DEFAULT false,
  expira_pre_reserva_at timestamptz
);

-- participantes_partido
CREATE TABLE IF NOT EXISTS public.participantes_partido (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  partido_id bigint REFERENCES public.partidos(id),
  usuario_id uuid REFERENCES public.usuarios(id),
  monto_sena_aportado numeric DEFAULT 0,
  estado_inscripcion varchar DEFAULT 'pendiente_pago'
    CHECK (estado_inscripcion IN ('pendiente_pago', 'pendiente_aprobacion', 'confirmado', 'rechazado')),
  created_at timestamptz DEFAULT timezone('utc', now())
);

-- ============ VISTAS ============

-- clubes_publicos
CREATE OR REPLACE VIEW public.clubes_publicos
WITH (security_invoker = true) AS
SELECT
  id, nombre, direccion, telefono,
  CASE WHEN ubicacion IS NULL THEN NULL
    ELSE ST_Y(ubicacion::geometry) END AS latitud,
  CASE WHEN ubicacion IS NULL THEN NULL
    ELSE ST_X(ubicacion::geometry) END AS longitud
FROM public.clubes;

-- partidos_publicos
CREATE OR REPLACE VIEW public.partidos_publicos
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.organizador_id,
  p.visibilidad,
  p.estado_partido,
  p.cupo_minimo,
  p.cupo_maximo,
  p.cantidad_invitados_anonimos,
  p.nivel_requerido,
  p.requiere_aprobacion,
  p.expira_pre_reserva_at,
  p.token_invitacion,
  r.id AS reserva_id,
  r.expira_at AS reserva_expira_at,
  t.id AS turno_id,
  t.fecha,
  t.hora_inicio,
  t.hora_fin,
  c.id AS cancha_id,
  c.nombre_identificador AS cancha_nombre,
  c.precio_total,
  c.precio_sena,
  cl.id AS club_id,
  cl.nombre AS club_nombre,
  cl.direccion,
  CASE WHEN cl.ubicacion IS NULL THEN NULL
    ELSE ST_Y(cl.ubicacion::geometry) END AS latitud,
  CASE WHEN cl.ubicacion IS NULL THEN NULL
    ELSE ST_X(cl.ubicacion::geometry) END AS longitud,
  (COALESCE(
    (SELECT count(*)::int FROM participantes_partido pp
     WHERE pp.partido_id = p.id
       AND pp.estado_inscripcion IN ('confirmado', 'pendiente_pago', 'pendiente_aprobacion')),
    0
  ) + COALESCE(p.cantidad_invitados_anonimos, 0)) AS jugadores_confirmados,
  (SELECT pp.estado_inscripcion FROM participantes_partido pp
   WHERE pp.partido_id = p.id AND pp.usuario_id = auth.uid()
   LIMIT 1) AS mi_estado_inscripcion
FROM partidos p
  JOIN reservas r ON r.id = p.reserva_id
  JOIN disponibilidad_turnos t ON t.id = r.turno_id
  JOIN canchas c ON c.id = t.cancha_id
  JOIN clubes cl ON cl.id = c.club_id
WHERE p.visibilidad IN ('publico', 'enlace')
  AND p.estado_partido <> 'cancelado';

-- partido_detalle
CREATE OR REPLACE VIEW public.partido_detalle
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.visibilidad,
  p.estado_partido,
  p.cupo_minimo,
  p.cupo_maximo,
  p.cantidad_invitados_anonimos,
  p.nivel_requerido,
  p.requiere_aprobacion,
  p.expira_pre_reserva_at,
  p.token_invitacion,
  p.organizador_id,
  r.id AS reserva_id,
  r.expira_at AS reserva_expira_at,
  t.id AS turno_id,
  t.fecha,
  t.hora_inicio,
  t.hora_fin,
  c.id AS cancha_id,
  c.nombre_identificador AS cancha_nombre,
  c.precio_total,
  c.precio_sena,
  cl.id AS club_id,
  cl.nombre AS club_nombre,
  cl.direccion,
  CASE WHEN cl.ubicacion IS NULL THEN NULL
    ELSE ST_Y(cl.ubicacion::geometry) END AS latitud,
  CASE WHEN cl.ubicacion IS NULL THEN NULL
    ELSE ST_X(cl.ubicacion::geometry) END AS longitud,
  (COALESCE(
    (SELECT count(*)::int FROM participantes_partido pp
     WHERE pp.partido_id = p.id
       AND pp.estado_inscripcion IN ('confirmado', 'pendiente_pago', 'pendiente_aprobacion')),
    0
  ) + COALESCE(p.cantidad_invitados_anonimos, 0)) AS jugadores_confirmados,
  (SELECT json_agg(json_build_object(
    'usuario_id', pp.usuario_id,
    'nombre', u.nombre_completo,
    'estado_inscripcion', pp.estado_inscripcion,
    'created_at', pp.created_at
  ))
  FROM participantes_partido pp
    LEFT JOIN usuarios u ON u.id = pp.usuario_id
  WHERE pp.partido_id = p.id
    AND pp.estado_inscripcion IN ('confirmado', 'pendiente_pago', 'pendiente_aprobacion')
  ) AS participantes,
  (SELECT pp.estado_inscripcion FROM participantes_partido pp
   WHERE pp.partido_id = p.id AND pp.usuario_id = auth.uid()
   LIMIT 1) AS mi_estado_inscripcion
FROM partidos p
  JOIN reservas r ON r.id = p.reserva_id
  JOIN disponibilidad_turnos t ON t.id = r.turno_id
  JOIN canchas c ON c.id = t.cancha_id
  JOIN clubes cl ON cl.id = c.club_id
WHERE p.visibilidad IN ('publico', 'enlace')
  AND p.estado_partido <> 'cancelado';

-- ============ FUNCIONES AUXILIARES ============

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND rol IN ('admin_global', 'superadmin')
  );
$function$;

-- ============ FUNCIONES DE USUARIO ============

CREATE OR REPLACE FUNCTION public.unirse_a_partido(p_partido_id bigint)
RETURNS participantes_partido
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_partido partidos%ROWTYPE;
  v_usuario usuarios%ROWTYPE;
  v_jugadores_confirmados integer;
  v_inscripcion participantes_partido%ROWTYPE;
  v_estado_inscripcion text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;
  IF v_partido IS NULL THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;

  IF v_partido.estado_partido NOT IN ('abierto', 'confirmado') THEN
    RAISE EXCEPTION 'El partido no está abierto para inscripciones';
  END IF;

  SELECT * INTO v_inscripcion FROM participantes_partido
  WHERE partido_id = p_partido_id AND usuario_id = auth.uid();
  IF v_inscripcion IS NOT NULL THEN RAISE EXCEPTION 'Ya estás inscrito en este partido'; END IF;

  -- Validación de nivel
  SELECT * INTO v_usuario FROM usuarios WHERE id = auth.uid();
  IF v_partido.nivel_requerido = 'intermedio' AND (v_usuario.nivel_voley IS NULL OR v_usuario.nivel_voley < 3) THEN
    RAISE EXCEPTION 'Nivel de vóley insuficiente. Se requiere nivel intermedio (3+).';
  END IF;
  IF v_partido.nivel_requerido = 'competitivo' AND (v_usuario.nivel_voley IS NULL OR v_usuario.nivel_voley < 6) THEN
    RAISE EXCEPTION 'Nivel de vóley insuficiente. Se requiere nivel competitivo (6+).';
  END IF;

  SELECT COUNT(*) INTO v_jugadores_confirmados FROM participantes_partido
  WHERE partido_id = p_partido_id AND estado_inscripcion IN ('confirmado', 'pendiente_aprobacion');

  IF v_jugadores_confirmados >= v_partido.cupo_maximo THEN
    RAISE EXCEPTION 'El partido está lleno';
  END IF;

  v_estado_inscripcion := CASE WHEN v_partido.requiere_aprobacion THEN 'pendiente_aprobacion' ELSE 'confirmado' END;

  INSERT INTO participantes_partido (partido_id, usuario_id, estado_inscripcion, monto_sena_aportado)
  VALUES (p_partido_id, auth.uid(), v_estado_inscripcion, 0)
  RETURNING * INTO v_inscripcion;

  RETURN v_inscripcion;
END;
$function$;

CREATE OR REPLACE FUNCTION public.salirse_de_partido(p_partido_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_partido partidos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;
  IF v_partido IS NULL THEN RAISE EXCEPTION 'Partido no encontrado'; END IF;
  IF v_partido.estado_partido = 'cancelado' THEN RAISE EXCEPTION 'El partido está cancelado'; END IF;
  IF v_partido.organizador_id = auth.uid() THEN
    RAISE EXCEPTION 'El organizador no puede abandonar el partido. Cancelalo si no queres jugar.';
  END IF;

  DELETE FROM participantes_partido WHERE partido_id = p_partido_id AND usuario_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'No estás inscrito en este partido'; END IF;
END;
$function$;

-- ============ FUNCIONES DE RESERVA ============

CREATE OR REPLACE FUNCTION public.reservar_turno_rango(
  p_cancha_id bigint, p_fecha date,
  p_hora_inicio time, p_hora_fin time,
  p_estado_final text DEFAULT 'reservado'
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
declare
  v_row record;
  v_reserved_id bigint;
begin
  if (select auth.uid()) is null then raise exception 'Debes iniciar sesión para reservar'; end if;
  if p_hora_fin <= p_hora_inicio then raise exception 'La hora de fin debe ser posterior a la hora de inicio'; end if;
  if p_estado_final not in ('disponible', 'pre_reservado', 'reservado', 'bloqueado_club') then
    raise exception 'Estado final no válido: %', p_estado_final;
  end if;

  select * into v_row from public.disponibilidad_turnos t
  where t.cancha_id = p_cancha_id and t.fecha = p_fecha
    and t.estado = 'disponible' and t.hora_inicio <= p_hora_inicio and t.hora_fin >= p_hora_fin
  order by t.hora_inicio limit 1 for update;

  if v_row.id is null then raise exception 'No hay disponibilidad que cubra ese rango'; end if;

  if v_row.hora_inicio = p_hora_inicio and v_row.hora_fin = p_hora_fin then
    update public.disponibilidad_turnos set estado = p_estado_final where id = v_row.id;
    return v_row.id;
  end if;

  update public.disponibilidad_turnos
  set hora_inicio = p_hora_inicio, hora_fin = p_hora_fin, estado = p_estado_final
  where id = v_row.id returning id into v_reserved_id;

  if v_row.hora_inicio < p_hora_inicio then
    insert into public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
    values (p_cancha_id, p_fecha, v_row.hora_inicio, p_hora_inicio, 'disponible');
  end if;

  if p_hora_fin < v_row.hora_fin then
    insert into public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
    values (p_cancha_id, p_fecha, p_hora_fin, v_row.hora_fin, 'disponible');
  end if;

  return v_reserved_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reservar_turno_virtual(
  p_cancha_id int, p_fecha text, p_hora_inicio text, p_hora_fin text,
  p_precio_total numeric, p_precio_sena numeric
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_turno_id int; v_existe int;
BEGIN
  SELECT id INTO v_existe FROM public.disponibilidad_turnos
  WHERE cancha_id = p_cancha_id AND fecha = p_fecha::date
    AND hora_inicio = p_hora_inicio::time AND hora_fin = p_hora_fin::time;
  IF v_existe IS NOT NULL THEN RAISE EXCEPTION 'Ese horario ya no está disponible'; END IF;

  INSERT INTO public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
  VALUES (p_cancha_id, p_fecha::date, p_hora_inicio::time, p_hora_fin::time, 'reservado')
  RETURNING id INTO v_turno_id;

  INSERT INTO public.reservas (turno_id, usuario_id, monto_sena_pagado, estado_pago)
  VALUES (v_turno_id, auth.uid(), 0, 'pendiente');

  RETURN v_turno_id;
END;
$function$;

-- ============ FUNCIONES DE PARTIDO ============

CREATE OR REPLACE FUNCTION public.crear_partido(
  p_turno_id bigint, p_cupo_minimo int DEFAULT 12, p_cupo_maximo int DEFAULT 18,
  p_invitados int DEFAULT 0, p_nivel varchar DEFAULT 'recreativo',
  p_requiere_aprobacion boolean DEFAULT false, p_visibilidad varchar DEFAULT 'publico'
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_reserva_id bigint;
  v_partido_id bigint;
  v_estado_inscripcion varchar;
begin
  if (select auth.uid()) is null then raise exception 'Debes iniciar sesión para crear un partido'; end if;
  if p_cupo_minimo < 2 or p_cupo_maximo < p_cupo_minimo or p_cupo_maximo > 22 then
    raise exception 'Los cupos deben ser coherentes y no superar 22 jugadores';
  end if;
  if p_invitados < 0 or p_invitados >= p_cupo_maximo then
    raise exception 'La cantidad de invitados debe ser menor al cupo máximo';
  end if;

  update public.disponibilidad_turnos set estado = 'pre_reservado'
  where id = p_turno_id and estado = 'disponible';
  if not found then raise exception 'El turno ya no está disponible'; end if;

  insert into public.reservas (turno_id, usuario_id, estado_pago, expira_at)
  values (p_turno_id, (select auth.uid()), 'pendiente', now() + interval '4 hours')
  returning id into v_reserva_id;

  insert into public.partidos (
    reserva_id, organizador_id, cupo_minimo, cupo_maximo,
    cantidad_invitados_anonimos, visibilidad, estado_partido,
    token_invitacion, nivel_requerido, requiere_aprobacion, expira_pre_reserva_at
  ) values (
    v_reserva_id, (select auth.uid()), p_cupo_minimo, p_cupo_maximo,
    p_invitados, p_visibilidad, 'pre_reservado',
    encode(gen_random_bytes(12), 'hex'), p_nivel, p_requiere_aprobacion,
    now() + interval '4 hours'
  ) returning id into v_partido_id;

  v_estado_inscripcion := case when p_requiere_aprobacion then 'pendiente_aprobacion' else 'confirmado' end;
  insert into public.participantes_partido (partido_id, usuario_id, estado_inscripcion)
  values (v_partido_id, (select auth.uid()), v_estado_inscripcion);

  return v_partido_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.crear_partido_virtual(
  p_cancha_id int, p_fecha text, p_hora_inicio text, p_hora_fin text,
  p_precio_total numeric, p_precio_sena numeric,
  p_cupo_minimo int, p_cupo_maximo int, p_invitados int,
  p_nivel text, p_requiere_aprobacion boolean, p_visibilidad text
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_turno_id int; v_reserva_id int; v_partido_id int; v_token text;
BEGIN
  INSERT INTO public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
  VALUES (p_cancha_id, p_fecha::date, p_hora_inicio::time, p_hora_fin::time, 'pre_reservado')
  RETURNING id INTO v_turno_id;

  INSERT INTO public.reservas (turno_id, usuario_id, estado_pago)
  VALUES (v_turno_id, auth.uid(), 'pendiente')
  RETURNING id INTO v_reserva_id;

  v_token := encode(gen_random_bytes(12), 'hex');

  INSERT INTO public.partidos (
    reserva_id, organizador_id, cupo_minimo, cupo_maximo,
    cantidad_invitados_anonimos, visibilidad, estado_partido,
    token_invitacion, nivel_requerido, requiere_aprobacion, expira_pre_reserva_at
  ) VALUES (
    v_reserva_id, auth.uid(), p_cupo_minimo, p_cupo_maximo,
    p_invitados, p_visibilidad, 'pre_reservado',
    v_token, p_nivel, p_requiere_aprobacion, now() + interval '4 hours'
  ) RETURNING id INTO v_partido_id;

  INSERT INTO public.participantes_partido (partido_id, usuario_id, estado_inscripcion)
  VALUES (v_partido_id, auth.uid(), 'confirmado');

  RETURN v_partido_id;
END;
$function$;

-- ============ FUNCIONES DE TURNOS VIRTUALES ============

CREATE OR REPLACE FUNCTION public.obtener_turnos_disponibles(
  p_cancha_id int, p_desde date, p_hasta date
)
RETURNS SETOF json
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_dia date; v_dow int; v_hs record; v_existe record;
BEGIN
  v_dia := p_desde;
  WHILE v_dia <= p_hasta LOOP
    v_dow := EXTRACT(DOW FROM v_dia);
    FOR v_hs IN SELECT * FROM public.horarios_semanales WHERE cancha_id = p_cancha_id AND dia_semana = v_dow AND activo = true LOOP
      SELECT id, estado INTO v_existe FROM public.disponibilidad_turnos
      WHERE cancha_id = p_cancha_id AND fecha = v_dia AND hora_inicio = v_hs.hora_inicio AND hora_fin = v_hs.hora_fin LIMIT 1;

      IF v_existe.id IS NOT NULL THEN
        RETURN QUERY SELECT json_build_object(
          'id', v_existe.id, 'cancha_id', p_cancha_id, 'fecha', v_dia,
          'hora_inicio', v_hs.hora_inicio, 'hora_fin', v_hs.hora_fin,
          'estado', v_existe.estado, 'precio_total', v_hs.precio_total,
          'precio_sena', v_hs.precio_sena, 'horario_semanal_id', v_hs.id
        );
      ELSE
        RETURN QUERY SELECT json_build_object(
          'id', NULL, 'cancha_id', p_cancha_id, 'fecha', v_dia,
          'hora_inicio', v_hs.hora_inicio, 'hora_fin', v_hs.hora_fin,
          'estado', 'disponible', 'precio_total', v_hs.precio_total,
          'precio_sena', v_hs.precio_sena, 'horario_semanal_id', v_hs.id
        );
      END IF;
    END LOOP;
    v_dia := v_dia + 1;
  END LOOP;
END;
$function$;

-- ============ FUNCIONES ADMIN ============

CREATE OR REPLACE FUNCTION public.admin_crear_cancha(
  p_club_nombre text, p_club_direccion text,
  p_latitud double precision, p_longitud double precision,
  p_titulo text, p_precio_total numeric, p_precio_sena numeric,
  p_club_telefono text DEFAULT NULL, p_nombre_identificador text DEFAULT NULL,
  p_descripcion text DEFAULT NULL, p_fotos text[] DEFAULT '{}',
  p_turnos jsonb DEFAULT '[]', p_club_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_club_id bigint; v_cancha_id bigint; v_turno record; v_turnos_creados int := 0;
  v_nombre_identificador text; v_club record;
begin
  if not (select private.is_admin_global()) then raise exception 'Solo admin_global o superadmin pueden crear canchas'; end if;
  if coalesce(trim(p_titulo), '') = '' then raise exception 'El titulo de la cancha es obligatorio'; end if;
  if p_precio_total <= 0 or p_precio_sena < 0 or p_precio_sena > p_precio_total then
    raise exception 'Los precios deben ser validos y la sena no puede superar el total';
  end if;

  v_nombre_identificador := coalesce(nullif(trim(p_nombre_identificador), ''), trim(p_titulo));

  if p_club_id is not null then
    select id into v_club from public.clubes where id = p_club_id;
    if v_club.id is null then raise exception 'El club seleccionado no existe'; end if;
    v_club_id := v_club.id;
    update public.clubes set telefono = nullif(trim(p_club_telefono), ''),
      direccion = coalesce(nullif(trim(p_club_direccion), ''), direccion),
      ubicacion = st_setsrid(st_makepoint(p_longitud, p_latitud), 4326)
    where id = v_club_id;
  else
    if coalesce(trim(p_club_nombre), '') = '' then raise exception 'El nombre del club es obligatorio'; end if;
    insert into public.clubes (nombre, direccion, telefono, ubicacion)
    values (trim(p_club_nombre), nullif(trim(p_club_direccion), ''), nullif(trim(p_club_telefono), ''),
      st_setsrid(st_makepoint(p_longitud, p_latitud), 4326))
    returning id into v_club_id;
  end if;

  insert into public.canchas (club_id, nombre_identificador, titulo, descripcion, fotos, precio_total, precio_sena)
  values (v_club_id, v_nombre_identificador, trim(p_titulo), nullif(trim(p_descripcion), ''),
    coalesce(p_fotos, '{}'), p_precio_total, p_precio_sena)
  returning id into v_cancha_id;

  for v_turno in
    select (value->>'fecha')::date as fecha, (value->>'hora_inicio')::time as hora_inicio, (value->>'hora_fin')::time as hora_fin
    from jsonb_array_elements(coalesce(p_turnos, '[]'::jsonb))
  loop
    if v_turno.fecha is null or v_turno.hora_inicio is null or v_turno.hora_fin is null then
      raise exception 'Cada turno debe incluir fecha, hora_inicio y hora_fin';
    end if;
    if v_turno.hora_fin <= v_turno.hora_inicio then raise exception 'La hora de fin debe ser posterior a la hora de inicio'; end if;
    insert into public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
    values (v_cancha_id, v_turno.fecha, v_turno.hora_inicio, v_turno.hora_fin, 'disponible');
    v_turnos_creados := v_turnos_creados + 1;
  end loop;

  return jsonb_build_object('club_id', v_club_id, 'cancha_id', v_cancha_id, 'turnos_creados', v_turnos_creados);
end;
$function$;

-- Admin CRUD simples
CREATE OR REPLACE FUNCTION public.admin_listar_clubes() RETURNS SETOF json LANGUAGE sql SECURITY DEFINER AS $function$
  SELECT json_build_object('id', c.id, 'nombre', c.nombre, 'direccion', c.direccion, 'telefono', c.telefono,
    'latitud', ST_Y(c.ubicacion::geometry), 'longitud', ST_X(c.ubicacion::geometry),
    'created_at', c.created_at, 'canchas_count', (SELECT count(*) FROM public.canchas WHERE club_id = c.id)
  ) FROM public.clubes c ORDER BY c.nombre;
$function$;

CREATE OR REPLACE FUNCTION public.admin_actualizar_club(p_club_id int, p_nombre text, p_direccion text, p_telefono text, p_latitud numeric, p_longitud numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  UPDATE public.clubes SET nombre=p_nombre, direccion=p_direccion, telefono=p_telefono,
    ubicacion=ST_SetSRID(ST_MakePoint(p_longitud,p_latitud),4326) WHERE id=p_club_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_eliminar_club(p_club_id int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF EXISTS (SELECT 1 FROM public.canchas WHERE club_id=p_club_id) THEN RAISE EXCEPTION 'No se puede eliminar un club con canchas asociadas'; END IF;
  DELETE FROM public.clubes WHERE id=p_club_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_listar_canchas() RETURNS SETOF json LANGUAGE sql SECURITY DEFINER AS $function$
  SELECT json_build_object('id', ca.id, 'club_id', ca.club_id,
    'club_nombre', (SELECT nombre FROM public.clubes WHERE id=ca.club_id),
    'titulo', ca.titulo, 'nombre_identificador', ca.nombre_identificador,
    'descripcion', ca.descripcion, 'precio_total', ca.precio_total,
    'precio_sena', ca.precio_sena, 'fotos', ca.fotos,
    'turnos_count', (SELECT count(*) FROM public.disponibilidad_turnos WHERE cancha_id=ca.id)
  ) FROM public.canchas ca ORDER BY ca.titulo;
$function$;

CREATE OR REPLACE FUNCTION public.admin_actualizar_cancha(p_cancha_id int, p_titulo text, p_descripcion text, p_precio_total numeric, p_precio_sena numeric, p_fotos text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  UPDATE public.canchas SET titulo=p_titulo, descripcion=p_descripcion, precio_total=p_precio_total, precio_sena=p_precio_sena, fotos=p_fotos WHERE id=p_cancha_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_eliminar_cancha(p_cancha_id int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF EXISTS (SELECT 1 FROM public.disponibilidad_turnos WHERE cancha_id=p_cancha_id AND estado IN ('reservado','pre_reservado')) THEN
    RAISE EXCEPTION 'No se puede eliminar una cancha con turnos reservados'; END IF;
  DELETE FROM public.disponibilidad_turnos WHERE cancha_id=p_cancha_id;
  DELETE FROM public.canchas WHERE id=p_cancha_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_listar_turnos(p_cancha_id int DEFAULT NULL, p_fecha_desde text DEFAULT NULL, p_fecha_hasta text DEFAULT NULL) RETURNS SETOF json LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN RETURN QUERY SELECT json_build_object('id', t.id, 'cancha_id', t.cancha_id,
    'cancha_titulo', (SELECT titulo FROM public.canchas WHERE id=t.cancha_id),
    'club_nombre', (SELECT cl.nombre FROM public.clubes cl JOIN public.canchas ca ON ca.club_id=cl.id WHERE ca.id=t.cancha_id),
    'fecha', t.fecha, 'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin, 'estado', t.estado)
  FROM public.disponibilidad_turnos t
  WHERE (p_cancha_id IS NULL OR t.cancha_id=p_cancha_id)
    AND (p_fecha_desde IS NULL OR t.fecha>=p_fecha_desde::date)
    AND (p_fecha_hasta IS NULL OR t.fecha<=p_fecha_hasta::date)
  ORDER BY t.fecha DESC, t.hora_inicio;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_listar_turnos_cancha(p_cancha_id int) RETURNS SETOF json LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN RETURN QUERY SELECT json_build_object('id', t.id, 'cancha_id', t.cancha_id,
    'fecha', t.fecha, 'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin, 'estado', t.estado)
  FROM public.disponibilidad_turnos t WHERE t.cancha_id = p_cancha_id ORDER BY t.fecha DESC, t.hora_inicio;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_crear_turno(p_cancha_id int, p_fecha text, p_hora_inicio text, p_hora_fin text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  INSERT INTO public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
  VALUES (p_cancha_id, p_fecha::date, p_hora_inicio::time, p_hora_fin::time, 'disponible');
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_eliminar_turno(p_turno_id int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_reserva_id int;
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT id INTO v_reserva_id FROM public.reservas WHERE turno_id = p_turno_id;
  IF v_reserva_id IS NOT NULL THEN
    DELETE FROM public.participantes_partido WHERE partido_id IN (SELECT id FROM public.partidos WHERE reserva_id = v_reserva_id);
    DELETE FROM public.partidos WHERE reserva_id = v_reserva_id;
    DELETE FROM public.reservas WHERE id = v_reserva_id;
  END IF;
  DELETE FROM public.disponibilidad_turnos WHERE id = p_turno_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_listar_reservas() RETURNS SETOF json LANGUAGE sql SECURITY DEFINER AS $function$
  SELECT json_build_object('id', r.id, 'turno_id', r.turno_id, 'usuario_id', r.usuario_id,
    'usuario_nombre', (SELECT nombre_completo FROM public.usuarios WHERE id=r.usuario_id),
    'usuario_email', (SELECT email FROM public.usuarios WHERE id=r.usuario_id),
    'cancha_titulo', (SELECT ca.titulo FROM public.canchas ca JOIN public.disponibilidad_turnos t ON t.cancha_id=ca.id WHERE t.id=r.turno_id),
    'club_nombre', (SELECT cl.nombre FROM public.clubes cl JOIN public.canchas ca ON ca.club_id=cl.id JOIN public.disponibilidad_turnos t ON t.cancha_id=ca.id WHERE t.id=r.turno_id),
    'fecha', (SELECT fecha FROM public.disponibilidad_turnos WHERE id=r.turno_id),
    'hora_inicio', (SELECT hora_inicio FROM public.disponibilidad_turnos WHERE id=r.turno_id),
    'hora_fin', (SELECT hora_fin FROM public.disponibilidad_turnos WHERE id=r.turno_id),
    'monto_sena_pagado', r.monto_sena_pagado, 'estado_pago', r.estado_pago, 'created_at', r.created_at
  ) FROM public.reservas r ORDER BY r.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancelar_reserva(p_reserva_id int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_turno_id int;
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT turno_id INTO v_turno_id FROM public.reservas WHERE id = p_reserva_id;
  DELETE FROM public.participantes_partido WHERE partido_id IN (SELECT id FROM public.partidos WHERE reserva_id = p_reserva_id);
  DELETE FROM public.partidos WHERE reserva_id = p_reserva_id;
  DELETE FROM public.reservas WHERE id = p_reserva_id;
  UPDATE public.disponibilidad_turnos SET estado = 'disponible' WHERE id = v_turno_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_listar_partidos() RETURNS SETOF json LANGUAGE sql SECURITY DEFINER AS $function$
  SELECT json_build_object('id', p.id, 'organizador_id', p.organizador_id,
    'organizador_nombre', (SELECT nombre_completo FROM public.usuarios WHERE id=p.organizador_id),
    'organizador_email', (SELECT email FROM public.usuarios WHERE id=p.organizador_id),
    'cancha_titulo', (SELECT ca.titulo FROM public.canchas ca JOIN public.disponibilidad_turnos t ON t.cancha_id=ca.id JOIN public.reservas r ON r.turno_id=t.id WHERE r.id=p.reserva_id),
    'club_nombre', (SELECT cl.nombre FROM public.clubes cl JOIN public.canchas ca ON ca.club_id=cl.id JOIN public.disponibilidad_turnos t ON t.cancha_id=ca.id JOIN public.reservas r ON r.turno_id=t.id WHERE r.id=p.reserva_id),
    'fecha', (SELECT t.fecha FROM public.disponibilidad_turnos t JOIN public.reservas r ON r.turno_id=t.id WHERE r.id=p.reserva_id),
    'hora_inicio', (SELECT t.hora_inicio FROM public.disponibilidad_turnos t JOIN public.reservas r ON r.turno_id=t.id WHERE r.id=p.reserva_id),
    'hora_fin', (SELECT t.hora_fin FROM public.disponibilidad_turnos t JOIN public.reservas r ON r.turno_id=t.id WHERE r.id=p.reserva_id),
    'nivel_requerido', p.nivel_requerido, 'estado_partido', p.estado_partido,
    'cupo_minimo', p.cupo_minimo, 'cupo_maximo', p.cupo_maximo,
    'jugadores_confirmados', (SELECT count(*) FROM public.participantes_partido WHERE partido_id=p.id AND estado_inscripcion='confirmado'),
    'requiere_aprobacion', p.requiere_aprobacion
  ) FROM public.partidos p ORDER BY p.id DESC;
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancelar_partido(p_partido_id int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  UPDATE public.partidos SET estado_partido='cancelado' WHERE id=p_partido_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_listar_usuarios() RETURNS SETOF json LANGUAGE sql SECURITY DEFINER AS $function$
  SELECT json_build_object('id', u.id, 'nombre_completo', u.nombre_completo, 'email', u.email,
    'nivel_voley', u.nivel_voley, 'rol', u.rol, 'created_at', u.created_at
  ) FROM public.usuarios u ORDER BY u.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.admin_actualizar_rol(p_usuario_id uuid, p_rol text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_rol NOT IN ('jugador','admin_cancha','admin_global','superadmin') THEN RAISE EXCEPTION 'Rol invalido: %', p_rol; END IF;
  UPDATE public.usuarios SET rol=p_rol WHERE id=p_usuario_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_listar_horarios_semanales(p_cancha_id int) RETURNS SETOF json LANGUAGE sql SECURITY DEFINER AS $function$
  SELECT json_build_object('id', h.id, 'cancha_id', h.cancha_id, 'dia_semana', h.dia_semana,
    'hora_inicio', h.hora_inicio, 'hora_fin', h.hora_fin, 'precio_total', h.precio_total,
    'precio_sena', h.precio_sena, 'activo', h.activo)
  FROM public.horarios_semanales h WHERE h.cancha_id = p_cancha_id AND h.activo = true ORDER BY h.dia_semana, h.hora_inicio;
$function$;

CREATE OR REPLACE FUNCTION public.admin_guardar_horarios_semanales(p_cancha_id int, p_horarios jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  DELETE FROM public.horarios_semanales WHERE cancha_id = p_cancha_id;
  INSERT INTO public.horarios_semanales (cancha_id, dia_semana, hora_inicio, hora_fin, precio_total, precio_sena)
  SELECT p_cancha_id, (h->>'dia_semana')::int, (h->>'hora_inicio')::time, (h->>'hora_fin')::time,
    (h->>'precio_total')::numeric, (h->>'precio_sena')::numeric
  FROM jsonb_array_elements(p_horarios) AS h;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_eliminar_horario_semanal(p_horario_id int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  DELETE FROM public.horarios_semanales WHERE id = p_horario_id;
END; $function$;

-- ============ RLS ============

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canchas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilidad_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_semanales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participantes_partido ENABLE ROW LEVEL SECURITY;

-- usuarios
CREATE POLICY "Perfiles visibles para todos" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Usuario crea su propio perfil" ON public.usuarios FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Actualizar propio perfil" ON public.usuarios FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- clubes
CREATE POLICY "Clubes visibles para todos" ON public.clubes FOR SELECT USING (true);
CREATE POLICY "Admins globales gestionan clubes" ON public.clubes FOR ALL USING (private.is_admin_global()) WITH CHECK (private.is_admin_global());

-- canchas
CREATE POLICY "Canchas visibles para todos" ON public.canchas FOR SELECT USING (true);
CREATE POLICY "Admins globales gestionan canchas" ON public.canchas FOR ALL USING (private.is_admin_global()) WITH CHECK (private.is_admin_global());

-- disponibilidad_turnos
CREATE POLICY "Turnos visibles para todos" ON public.disponibilidad_turnos FOR SELECT USING (true);
CREATE POLICY "Admins globales gestionan turnos" ON public.disponibilidad_turnos FOR ALL USING (private.is_admin_global()) WITH CHECK (private.is_admin_global());
CREATE POLICY "Usuario pre-reserva turno disponible" ON public.disponibilidad_turnos FOR UPDATE USING (estado = 'disponible') WITH CHECK (estado = 'pre_reservado');
CREATE POLICY "Usuario reserva rango dentro de bloque" ON public.disponibilidad_turnos FOR UPDATE USING (estado = 'disponible') WITH CHECK (estado IN ('reservado', 'pre_reservado'));

-- horarios_semanales
CREATE POLICY "Lectura pública horarios semanales" ON public.horarios_semanales FOR SELECT USING (true);
CREATE POLICY "Admin gestiona horarios semanales" ON public.horarios_semanales FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- reservas
CREATE POLICY "Reservas visibles para participantes" ON public.reservas FOR SELECT USING (
  usuario_id = auth.uid()
  OR EXISTS (SELECT 1 FROM partidos p WHERE p.reserva_id = reservas.id AND p.visibilidad IN ('publico', 'enlace'))
  OR private.is_admin_global()
);
CREATE POLICY "Usuario crea su reserva" ON public.reservas FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "Usuario actualiza su reserva pendiente" ON public.reservas FOR UPDATE USING (usuario_id = auth.uid() AND estado_pago = 'pendiente') WITH CHECK (usuario_id = auth.uid());

-- partidos
CREATE POLICY "Partidos públicos visibles" ON public.partidos FOR SELECT USING (visibilidad = 'publico');
CREATE POLICY "Partidos por enlace visibles" ON public.partidos FOR SELECT USING (visibilidad = 'enlace');
CREATE POLICY "Usuario crea su partido" ON public.partidos FOR INSERT WITH CHECK (organizador_id = auth.uid());
CREATE POLICY "Organizador edita su partido" ON public.partidos FOR UPDATE USING (organizador_id = auth.uid() OR private.is_admin_global()) WITH CHECK (organizador_id = auth.uid() OR private.is_admin_global());

-- participantes_partido
CREATE POLICY "Lista de participantes visible" ON public.participantes_partido FOR SELECT USING (true);
CREATE POLICY "Usuario se inscribe" ON public.participantes_partido FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Organizador gestiona participantes" ON public.participantes_partido FOR UPDATE USING (
  EXISTS (SELECT 1 FROM partidos p WHERE p.id = participantes_partido.partido_id AND p.organizador_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM partidos p WHERE p.id = participantes_partido.partido_id AND p.organizador_id = auth.uid())
);
