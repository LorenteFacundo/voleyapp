-- These endpoints have no direct client use; internal SECURITY DEFINER callers
-- continue working as the function owner.
revoke execute on function public.crear_notificacion(uuid, character varying, text, bigint)
  from public, anon, authenticated;
revoke execute on function public.verificar_badges(uuid)
  from public, anon, authenticated;
revoke execute on function public.is_admin()
  from public, anon, authenticated;

-- Mutating booking and group endpoints must never be callable as anonymous users.
revoke execute on function public.crear_partido(bigint, integer, integer, integer, text, text, boolean)
  from public, anon;
revoke execute on function public.crear_partido(bigint, integer, integer, integer, character varying, boolean, character varying)
  from public, anon;
revoke execute on function public.reservar_turno_rango(bigint, date, time, time, text)
  from public, anon;
revoke execute on function public.reservar_turno_virtual(integer, text, text, text, numeric, numeric)
  from public, anon;
revoke execute on function public.crear_partido_virtual(integer, text, text, text, numeric, numeric, integer, integer, integer, text, boolean, text)
  from public, anon;
revoke execute on function public.unirse_a_partido(bigint)
  from public, anon;
revoke execute on function public.salirse_de_partido(bigint)
  from public, anon;
revoke execute on function public.enviar_mensaje(bigint, text)
  from public, anon;
grant execute on function public.crear_partido(bigint, integer, integer, integer, text, text, boolean)
  to authenticated;
grant execute on function public.crear_partido(bigint, integer, integer, integer, character varying, boolean, character varying)
  to authenticated;
grant execute on function public.reservar_turno_rango(bigint, date, time, time, text)
  to authenticated;
grant execute on function public.reservar_turno_virtual(integer, text, text, text, numeric, numeric)
  to authenticated;
grant execute on function public.crear_partido_virtual(integer, text, text, text, numeric, numeric, integer, integer, integer, text, boolean, text)
  to authenticated;
grant execute on function public.unirse_a_partido(bigint)
  to authenticated;
grant execute on function public.salirse_de_partido(bigint)
  to authenticated;
grant execute on function public.enviar_mensaje(bigint, text)
  to authenticated;

