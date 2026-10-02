create or replace function private.is_admin_global()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and u.rol in ('admin_global', 'superadmin')
  );
$$;

grant usage on schema private to authenticated;
revoke all on function private.is_admin_global() from public;
grant execute on function private.is_admin_global() to authenticated;

drop policy if exists "Reservas visibles para participantes" on public.reservas;
create policy "Reservas visibles para participantes"
on public.reservas
for select
to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (
    select 1 from public.partidos p
    where p.reserva_id = reservas.id
      and p.visibilidad in ('publico', 'enlace')
  )
  or (select private.is_admin_global())
);

drop policy if exists "Organizador edita su partido" on public.partidos;
create policy "Organizador edita su partido"
on public.partidos
for update
to authenticated
using (organizador_id = (select auth.uid()) or (select private.is_admin_global()))
with check (organizador_id = (select auth.uid()) or (select private.is_admin_global()));

drop function if exists public.is_admin_global();

drop policy if exists "Usuario se inscribe" on public.participantes_partido;
create policy "Usuario se inscribe"
on public.participantes_partido
for insert
to authenticated
with check ((select auth.uid()) = usuario_id);

create index if not exists idx_administradores_club_user_id on public.administradores_club (user_id);
create index if not exists idx_administradores_club_club_id on public.administradores_club (club_id);

create policy "Admins globales gestionan administradores de club"
on public.administradores_club
for all
to authenticated
using ((select private.is_admin_global()))
with check ((select private.is_admin_global()));

create policy "Admin de club ve su asignacion"
on public.administradores_club
for select
to authenticated
using (user_id = (select auth.uid()));
