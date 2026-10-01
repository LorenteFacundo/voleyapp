create or replace function public.reservar_turno_rango(
  p_cancha_id bigint,
  p_fecha date,
  p_hora_inicio time,
  p_hora_fin time
)
returns bigint
language plpgsql
security definer
set search_path = public
as $function$
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

  -- Buscamos un bloque disponible que cubra el rango solicitado.
  -- For update para evitar carreras entre reservas.
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

  -- Caso exacto: el bloque coincide, lo marcamos como reservado.
  if v_row.hora_inicio = p_hora_inicio and v_row.hora_fin = p_hora_fin then
    update public.disponibilidad_turnos
    set estado = 'reservado'
    where id = v_row.id;

    return v_row.id;
  end if;

  -- Reutilizamos el registro existente como el tramo reservado.
  update public.disponibilidad_turnos
  set hora_inicio = p_hora_inicio,
      hora_fin = p_hora_fin,
      estado = 'reservado'
  where id = v_row.id
  returning id into v_reserved_id;

  -- Si hay tramo anterior (disponible), lo creamos.
  if v_row.hora_inicio < p_hora_inicio then
    insert into public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
    values (p_cancha_id, p_fecha, v_row.hora_inicio, p_hora_inicio, 'disponible');
  end if;

  -- Si hay tramo posterior (disponible), lo creamos.
  if p_hora_fin < v_row.hora_fin then
    insert into public.disponibilidad_turnos (cancha_id, fecha, hora_inicio, hora_fin, estado)
    values (p_cancha_id, p_fecha, p_hora_fin, v_row.hora_fin, 'disponible');
  end if;

  return v_reserved_id;
end;
$function$;

grant execute on function public.reservar_turno_rango(bigint, date, time, time) to authenticated;

-- RLS: permitir que un usuario marque como reservado via la funcion (security definer)
-- Nota: la funcion hace UPDATE directo, asi que necesitamos policy de UPDATE para authenticated.
-- La check actual solo permite pasar de disponible -> pre_reservado. Extendemos a reservado.
do $$
begin
  -- Ajustamos el with_check de la policy existente creando una nueva policy de update para authenticated.
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='disponibilidad_turnos' and policyname='Usuario reserva rango dentro de bloque'
  ) then
    create policy "Usuario reserva rango dentro de bloque"
      on public.disponibilidad_turnos for update
      to authenticated
      using (estado = 'disponible')
      with check (estado in ('reservado','pre_reservado'));
  end if;
end $$;
