-- Traslado de los datos existentes al modelo v2. Las tablas anteriores se
-- conservan intactas (solo dejan de estar expuestas por la API).
--
-- Antes de aplicar en producción, revisá supabase/preflight/antes_del_modelo_v2.sql:
-- informa qué filas se van a normalizar u omitir.

-- Filas que no se pudieron trasladar, para revisarlas a mano.
create table if not exists private.migracion_omitidos (
  turno_id bigint primary key,
  motivo text not null,
  created_at timestamptz not null default now()
);
revoke all on private.migracion_omitidos from public, anon, authenticated;

-- Equipo: cada administrador de club pasa a ser dueño de ese club.
insert into public.club_miembros (club_id, user_id, rol)
select distinct a.club_id, a.user_id, 'dueno'
from public.administradores_club a
join public.usuarios u on u.id = a.user_id
join public.clubes c on c.id = a.club_id
on conflict (club_id, user_id) do nothing;

-- Reservas y bloqueos: cada turno ocupado se convierte en una ocupación.
do $$
declare
  t record;
  v_reserva record;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_estado text;
  v_precio numeric;
  v_cliente bigint;
  v_id bigint;
begin
  for t in
    select dt.id, dt.cancha_id, dt.fecha, dt.hora_inicio, dt.hora_fin, dt.estado, ca.club_id, ca.precio_total
    from public.disponibilidad_turnos dt
    join public.canchas ca on ca.id = dt.cancha_id
    where dt.estado in ('reservado', 'pre_reservado', 'bloqueado_club')
      and ca.club_id is not null
      and not exists (select 1 from public.ocupaciones o where o.legado_turno_id = dt.id)
    order by dt.fecha, dt.hora_inicio
  loop
    begin
      v_inicio := private.instante_ar(t.fecha, t.hora_inicio);
      v_fin := private.instante_ar(t.fecha + case when t.hora_fin <= t.hora_inicio then 1 else 0 end, t.hora_fin);

      if t.estado = 'bloqueado_club' then
        insert into public.ocupaciones (club_id, cancha_id, inicio, fin, tipo, estado, origen, titulo, legado_turno_id)
        values (t.club_id, t.cancha_id, v_inicio, v_fin, 'bloqueo', 'confirmada', 'otro', 'Bloqueado', t.id);
        continue;
      end if;

      select r.id, r.usuario_id, r.monto_sena_pagado, r.created_at into v_reserva
      from public.reservas r where r.turno_id = t.id
      order by r.created_at desc nulls last, r.id desc limit 1;

      v_precio := coalesce((
        select h.precio_total from public.horarios_semanales h
        where h.cancha_id = t.cancha_id and h.dia_semana = extract(dow from t.fecha)::int
          and h.hora_inicio = t.hora_inicio and h.hora_fin = t.hora_fin limit 1), t.precio_total, 0);
      -- Una pre-reserva nunca fue confirmada por el club: si es futura queda
      -- pendiente de respuesta; si ya pasó, se registra como vencida.
      v_estado := case
        when t.estado = 'pre_reservado' and v_inicio > pg_catalog.now() then 'pendiente'
        when t.estado = 'pre_reservado' then 'vencida'
        else 'confirmada' end;
      v_cliente := case when v_reserva.usuario_id is not null
        then private.cliente_de_usuario(t.club_id, v_reserva.usuario_id) end;

      insert into public.ocupaciones (club_id, cancha_id, inicio, fin, tipo, estado, origen, usuario_id,
        cliente_id, titulo, precio, vence_at, cancelada_por, cancelada_at, motivo_cancelacion,
        legado_turno_id, legado_reserva_id)
      values (t.club_id, t.cancha_id, v_inicio, v_fin, 'reserva', v_estado, 'app', v_reserva.usuario_id,
        v_cliente, case when v_reserva.usuario_id is null then 'Reserva anterior' end, v_precio,
        case when v_estado = 'pendiente' then least(pg_catalog.now() + interval '48 hours', v_inicio) end,
        case when v_estado = 'vencida' then 'sistema' end,
        case when v_estado = 'vencida' then pg_catalog.now() end,
        case when v_estado = 'vencida' then 'Pre-reserva del sistema anterior que no se confirmó' end,
        t.id, v_reserva.id)
      returning id into v_id;

      if coalesce(v_reserva.monto_sena_pagado, 0) > 0 then
        insert into public.pagos (club_id, ocupacion_id, cliente_id, monto, medio, fecha, nota)
        values (t.club_id, v_id, v_cliente, v_reserva.monto_sena_pagado, 'otro',
          coalesce((v_reserva.created_at at time zone 'America/Argentina/Buenos_Aires')::date, private.hoy_ar()),
          'Registrado en el sistema anterior');
      end if;
    exception when exclusion_violation or check_violation then
      insert into private.migracion_omitidos (turno_id, motivo) values (t.id, sqlerrm)
      on conflict (turno_id) do update set motivo = excluded.motivo;
      raise notice 'El turno % no se migró: %', t.id, sqlerrm;
    end;
  end loop;
end $$;

-- Partidos: se vinculan a la ocupación de su reserva y se normaliza su estado.
update public.partidos pa
set ocupacion_id = o.id
from public.ocupaciones o
where pa.ocupacion_id is null and pa.reserva_id is not null and o.legado_reserva_id = pa.reserva_id;

-- Los ya jugados quedan cerrados sin volver a sumar puntos (el sistema
-- anterior ya los contaba al inscribirse).
update public.partidos pa
set estado_partido = case
      when o.estado = 'pendiente' then 'borrador'
      when o.estado = 'confirmada' and o.fin <= pg_catalog.now() then 'finalizado'
      when o.estado = 'confirmada' then 'abierto'
      else 'cancelado' end,
    finalizado_at = case when o.estado = 'confirmada' and o.fin <= pg_catalog.now() then o.fin end,
    cancelado_at = case when o.estado not in ('pendiente', 'confirmada') then pg_catalog.now() end
from public.ocupaciones o
where o.id = pa.ocupacion_id and pa.estado_partido in ('borrador', 'pre_reservado', 'abierto', 'confirmado');

update public.partidos
set estado_partido = 'cancelado', cancelado_at = pg_catalog.now()
where ocupacion_id is null and estado_partido not in ('cancelado', 'finalizado');

update public.partidos
set token_invitacion = encode(extensions.gen_random_bytes(16), 'hex')
where token_invitacion is null;

-- La inscripción "pendiente de pago" ya no existe: quienes la tenían juegan.
update public.participantes_partido set estado_inscripcion = 'confirmado'
where estado_inscripcion = 'pendiente_pago';

-- Partidos que ya tenían el mínimo: no se vuelve a avisar.
update public.partidos pa set minimo_avisado_at = pg_catalog.now()
where pa.minimo_avisado_at is null and private.ocupados_partido(pa.id) >= pa.cupo_minimo;
