-- Public club interest form; only global admins may read or update submissions.
create table if not exists public.solicitudes_club (
  id bigint generated always as identity primary key,
  club_nombre text not null check (length(btrim(club_nombre)) between 2 and 120),
  localidad text not null check (length(btrim(localidad)) between 2 and 100),
  contacto_nombre text not null check (length(btrim(contacto_nombre)) between 2 and 100),
  contacto text not null check (length(btrim(contacto)) between 6 and 160),
  cantidad_canchas int not null check (cantidad_canchas between 1 and 100),
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'contactado', 'en_preparacion', 'incorporado')),
  created_at timestamptz not null default now()
);
alter table public.solicitudes_club enable row level security;
revoke all on public.solicitudes_club from public, anon, authenticated;
grant insert on public.solicitudes_club to anon, authenticated;
grant select, update on public.solicitudes_club to authenticated;
grant usage on sequence public.solicitudes_club_id_seq to anon, authenticated;
create policy "Canchas pueden enviar su interés" on public.solicitudes_club
  for insert to anon, authenticated with check (estado = 'nuevo');
create policy "Admins ven interesados" on public.solicitudes_club
  for select to authenticated using ((select private.is_admin_global()));
create policy "Admins actualizan interesados" on public.solicitudes_club
  for update to authenticated using ((select private.is_admin_global()))
  with check ((select private.is_admin_global()));
revoke update on public.solicitudes_club from authenticated;
grant update (estado) on public.solicitudes_club to authenticated;

