-- Anonymous visitors may submit only the public form fields, never workflow state.
revoke insert on table public.solicitudes_club from anon, authenticated;
grant insert (club_nombre, localidad, contacto_nombre, contacto, cantidad_canchas)
  on table public.solicitudes_club to anon, authenticated;

