-- Checked against the live project before applying: no invalid ranges or
-- overlapping occupied slots. The exclusion constraint is transactional.
create extension if not exists btree_gist with schema extensions;
do $$
begin
  if exists (select 1 from public.disponibilidad_turnos where hora_inicio>=hora_fin)
  then raise exception 'Hay turnos con rango horario inválido'; end if;
  if exists (select 1 from public.disponibilidad_turnos a
    join public.disponibilidad_turnos b on a.id<b.id and a.cancha_id=b.cancha_id
      and a.fecha=b.fecha and a.hora_inicio<b.hora_fin and b.hora_inicio<a.hora_fin
    where a.estado<>'disponible' and b.estado<>'disponible')
  then raise exception 'Hay turnos ocupados superpuestos'; end if;
end $$;
alter table public.disponibilidad_turnos add constraint turno_horas_validas
  check (hora_inicio<hora_fin);
alter table public.disponibilidad_turnos add constraint turno_ocupado_sin_solapamiento
  exclude using gist (cancha_id with =,
    tsrange(fecha+hora_inicio,fecha+hora_fin,'[)') with &&)
  where (estado<>'disponible');

