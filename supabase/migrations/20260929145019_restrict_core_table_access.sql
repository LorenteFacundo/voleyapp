-- Application writes to booking/match records go through permission-checked RPCs.
revoke insert, update, delete, truncate, references, trigger
  on table public.disponibilidad_turnos from anon, authenticated;
revoke select, insert, update, delete, truncate, references, trigger
  on table public.reservas from anon, authenticated;
grant select (id, turno_id, usuario_id, estado_pago, created_at)
  on table public.reservas to authenticated;
revoke select, insert, update, delete, truncate, references, trigger
  on table public.partidos, public.participantes_partido from anon, authenticated;

drop policy if exists "Reservas visibles para participantes" on public.reservas;
create policy "Reservas propias o admin global"
  on public.reservas for select to authenticated
  using (usuario_id=(select auth.uid()) or (select private.is_admin_global()));

-- Legacy row policies allowed participants to enumerate direct IDs and payment state.
-- Public discovery remains available through the curated public views.

