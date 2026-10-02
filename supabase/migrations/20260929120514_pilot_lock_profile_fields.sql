-- Minimal production hotfix: direct profile writes may only change editable fields.
-- The existing self-update RLS policy still limits rows to auth.uid().
revoke update on public.usuarios from public, anon, authenticated;
grant update (nombre_completo, nivel_voley) on public.usuarios to authenticated;

-- Awarding arbitrary points from the browser must not be an exposed RPC.
revoke all on function public.otorgar_puntos(uuid, integer, character varying, bigint)
  from public, anon, authenticated;

