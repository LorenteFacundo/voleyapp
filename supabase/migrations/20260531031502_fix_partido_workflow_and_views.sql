-- 1. Fix crear_partido: partido debe quedar 'abierto' para que otros puedan unirse
CREATE OR REPLACE FUNCTION public.crear_partido(
  p_turno_id bigint,
  p_cupo_minimo integer,
  p_cupo_maximo integer,
  p_invitados integer,
  p_visibilidad text,
  p_nivel text,
  p_requiere_aprobacion boolean
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_reserva_id bigint;
  v_partido_id bigint;
  v_estado_inscripcion varchar;
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión para crear un partido';
  end if;

  if p_cupo_minimo < 2 or p_cupo_maximo < p_cupo_minimo or p_cupo_maximo > 22 then
    raise exception 'Los cupos deben ser coherentes y no superar 22 jugadores';
  end if;

  if p_invitados < 0 or p_invitados >= p_cupo_maximo then
    raise exception 'La cantidad de invitados debe ser menor al cupo máximo';
  end if;

  -- Validar que el turno exista y esté disponible
  update public.disponibilidad_turnos
  set estado = 'pre_reservado'
  where id = p_turno_id
    and estado = 'disponible';

  if not found then
    raise exception 'El turno ya no está disponible';
  end if;

  insert into public.reservas (turno_id, usuario_id, estado_pago, expira_at)
  values (p_turno_id, (select auth.uid()), 'pendiente', now() + interval '4 hours')
  returning id into v_reserva_id;

  insert into public.partidos (
    reserva_id,
    organizador_id,
    cupo_minimo,
    cupo_maximo,
    cantidad_invitados_anonimos,
    visibilidad,
    estado_partido,
    token_invitacion,
    nivel_requerido,
    requiere_aprobacion,
    expira_pre_reserva_at
  ) values (
    v_reserva_id,
    (select auth.uid()),
    p_cupo_minimo,
    p_cupo_maximo,
    p_invitados,
    p_visibilidad,
    'abierto',  -- CAMBIO: antes era 'pre_reservado', ahora 'abierto' para permitir inscripciones inmediatas
    encode(gen_random_bytes(12), 'hex'),
    p_nivel,
    p_requiere_aprobacion,
    now() + interval '4 hours'
  )
  returning id into v_partido_id;

  v_estado_inscripcion := case when p_requiere_aprobacion then 'pendiente_aprobacion' else 'confirmado' end;

  insert into public.participantes_partido (partido_id, usuario_id, estado_inscripcion)
  values (v_partido_id, (select auth.uid()), v_estado_inscripcion);

  return v_partido_id;
end;
$$;

-- 2. Fix inconsistency: partidos_publicos debe contar pendiente_aprobacion igual que partido_detalle
CREATE OR REPLACE VIEW public.partidos_publicos AS
 SELECT p.id,
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
        CASE
            WHEN (cl.ubicacion IS NULL) THEN NULL::double precision
            ELSE st_y((cl.ubicacion)::geometry)
        END AS latitud,
        CASE
            WHEN (cl.ubicacion IS NULL) THEN NULL::double precision
            ELSE st_x((cl.ubicacion)::geometry)
        END AS longitud,
    (COALESCE(( SELECT (count(*))::integer AS count
           FROM participantes_partido pp
          WHERE ((pp.partido_id = p.id) AND ((pp.estado_inscripcion)::text = ANY (ARRAY['confirmado'::text, 'pendiente_pago'::text, 'pendiente_aprobacion'::text])))), 0) + COALESCE(p.cantidad_invitados_anonimos, 0)) AS jugadores_confirmados
   FROM ((((partidos p
     JOIN reservas r ON ((r.id = p.reserva_id)))
     JOIN disponibilidad_turnos t ON ((t.id = r.turno_id)))
     JOIN canchas c ON ((c.id = t.cancha_id)))
     JOIN clubes cl ON ((cl.id = c.club_id)))
  WHERE (((p.visibilidad)::text = ANY (ARRAY['publico'::text, 'enlace'::text])) AND ((p.estado_partido)::text <> 'cancelado'::text));

-- 3. Agregar whitelist a reservar_turno_rango
CREATE OR REPLACE FUNCTION public.reservar_turno_rango(
  p_cancha_id bigint,
  p_fecha date,
  p_hora_inicio time without time zone,
  p_hora_fin time without time zone,
  p_estado_final text DEFAULT 'reservado'::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_row record;
  v_reserved_id bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión para reservar';
  end if;

  if p_hora_fin <= p_hora_inicio then
    raise exception 'La hora de fin debe ser posterior a la hora de inicio';
  end if;

  -- Validar estado final permitido
  if p_estado_final not in ('disponible', 'pre_reservado', 'reservado', 'bloqueado_club') then
    raise exception 'Estado final no válido: %', p_estado_final;
  end if;

  select * into v_row
  from public.disponibilidad_turnos t
  where t.cancha_id = p_cancha_id
    and t.fecha = p_fecha
    and t.estado = 'disponible'
    and t.hora_inicio <= p_hora_inicio
    and t.hora_fin >= p_hora_fin
  order by t.hora_inicio
  limit 1
  for update;

  if v_row.id is null then
    raise exception 'No hay disponibilidad que cubra ese rango';
  end if;

  if v_row.hora_inicio = p_hora_inicio and v_row.hora_fin = p_hora_fin then
    update public.disponibilidad_turnos
    set estado = p_estado_final
    where id = v_row.id;
    return v_row.id;
  end if;

  update public.disponibilidad_turnos
  set hora_inicio = p_hora_inicio,
      hora_fin = p_hora_fin,
      estado = p_estado_final
  where id = v_row.id
  returning id into v_reserved_id;

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
$$;

-- 4. Crear función para salirse de un partido
CREATE OR REPLACE FUNCTION public.salirse_de_partido(p_partido_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partido partidos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;
  IF v_partido IS NULL THEN
    RAISE EXCEPTION 'Partido no encontrado';
  END IF;

  IF v_partido.estado_partido = 'cancelado' THEN
    RAISE EXCEPTION 'El partido está cancelado';
  END IF;

  -- No permitir que el organizador se salga (debe cancelar el partido)
  IF v_partido.organizador_id = auth.uid() THEN
    RAISE EXCEPTION 'El organizador no puede abandonar el partido. Cancelalo si no queres jugar.';
  END IF;

  DELETE FROM participantes_partido
  WHERE partido_id = p_partido_id AND usuario_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No estás inscrito en este partido';
  END IF;
END;
$$;

-- 5. Actualizar unirse_a_partido para permitir 'abierto' y 'confirmado' (ya lo hacía)
--    y agregar validación de que el partido no esté lleno con mejor manejo
CREATE OR REPLACE FUNCTION public.unirse_a_partido(p_partido_id bigint)
RETURNS participantes_partido
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partido partidos%ROWTYPE;
  v_jugadores_confirmados integer;
  v_inscripcion participantes_partido%ROWTYPE;
  v_estado_inscripcion text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_partido FROM partidos WHERE id = p_partido_id;
  IF v_partido IS NULL THEN
    RAISE EXCEPTION 'Partido no encontrado';
  END IF;

  IF v_partido.estado_partido NOT IN ('abierto', 'confirmado') THEN
    RAISE EXCEPTION 'El partido no está abierto para inscripciones';
  END IF;

  SELECT * INTO v_inscripcion
  FROM participantes_partido
  WHERE partido_id = p_partido_id AND usuario_id = auth.uid();

  IF v_inscripcion IS NOT NULL THEN
    RAISE EXCEPTION 'Ya estás inscrito en este partido';
  END IF;

  SELECT COUNT(*) INTO v_jugadores_confirmados
  FROM participantes_partido
  WHERE partido_id = p_partido_id
  AND estado_inscripcion IN ('confirmado', 'pendiente_aprobacion');

  IF v_jugadores_confirmados >= v_partido.cupo_maximo THEN
    RAISE EXCEPTION 'El partido está lleno';
  END IF;

  IF v_partido.requiere_aprobacion THEN
    v_estado_inscripcion := 'pendiente_aprobacion';
  ELSE
    v_estado_inscripcion := 'confirmado';
  END IF;

  INSERT INTO participantes_partido (
    partido_id,
    usuario_id,
    estado_inscripcion,
    monto_sena_aportado
  ) VALUES (
    p_partido_id,
    auth.uid(),
    v_estado_inscripcion,
    0
  )
  RETURNING * INTO v_inscripcion;

  RETURN v_inscripcion;
END;
$$;
