-- The old SECURITY DEFINER list function returned every user to any caller.
create or replace function public.admin_listar_usuarios() returns setof json
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not private.is_admin_global() then raise exception 'No autorizado'; end if;
  return query select json_build_object(
    'id',u.id,'nombre_completo',u.nombre_completo,'email',u.email,
    'nivel_voley',u.nivel_voley,'rol',u.rol,'created_at',u.created_at)
  from public.usuarios u order by u.created_at desc;
end $$;
revoke execute on function public.admin_listar_usuarios() from public, anon;
grant execute on function public.admin_listar_usuarios() to authenticated;

