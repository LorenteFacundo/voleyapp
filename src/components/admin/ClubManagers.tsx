import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminListarClubes, adminListarUsuarios } from '@/lib/admin';
import type { ClubAdmin, UsuarioAdmin } from '@/types';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type Assignment = { club_id: number; usuario_id: string };

export function ClubManagers() {
  const [clubs, setClubs] = useState<ClubAdmin[]>([]);
  const [users, setUsers] = useState<UsuarioAdmin[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clubId, setClubId] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [clubRows, userRows, assignmentRows] = await Promise.all([
        adminListarClubes(), adminListarUsuarios(),
        supabase.from('administradores_club').select('club_id,usuario_id'),
      ]);
      if (assignmentRows.error) throw new Error(assignmentRows.error.message);
      setClubs(clubRows);
      setUsers(userRows);
      setAssignments((assignmentRows.data ?? []) as Assignment[]);
      setClubId((value) => value || String(clubRows[0]?.id ?? ''));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los administradores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clubId || !userId) return;
    setWorking(true);
    const { error } = await supabase.rpc('pilot_asignar_admin_club', {
      p_club_id: Number(clubId), p_usuario_id: userId, p_asignar: true,
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Administrador asignado al club');
    setUserId('');
    void refresh();
  }

  async function remove(assignment: Assignment) {
    const { error } = await supabase.rpc('pilot_asignar_admin_club', {
      p_club_id: assignment.club_id, p_usuario_id: assignment.usuario_id, p_asignar: false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Asignación quitada');
    void refresh();
  }

  const nameFor = (id: string) => {
    const user = users.find((candidate) => candidate.id === id);
    return user ? `${user.nombre_completo || 'Sin nombre'} · ${user.email}` : 'Usuario';
  };
  const clubFor = (id: number) => clubs.find((club) => club.id === id)?.nombre ?? 'Club';

  return <div className="space-y-5">
    <Card padding="lg">
      <h2 className="text-lg font-bold text-vb-blue">Asignar acceso a la agenda</h2>
      <p className="mt-1 text-sm text-vb-gray/60">Cada administrador solo verá los clubes que le asignes.</p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <label className="text-sm font-semibold">Club<select required value={clubId} onChange={(event) => setClubId(event.target.value)} className="mt-1 block w-full rounded-lg border border-ink/20 p-2">{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label>
        <label className="text-sm font-semibold">Usuario<select required value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1 block w-full rounded-lg border border-ink/20 p-2"><option value="">Elegir usuario</option>{users.map((user) => <option key={user.id} value={user.id}>{user.nombre_completo || 'Sin nombre'} · {user.email}</option>)}</select></label>
        <Button type="submit" loading={working} disabled={!clubs.length || !userId}>Asignar</Button>
      </form>
    </Card>
    <Card padding="lg">
      <h2 className="mb-3 text-lg font-bold text-vb-blue">Administradores asignados</h2>
      {loading ? <p className="text-sm text-vb-gray/60">Cargando…</p> : assignments.length === 0 ? <p className="text-sm text-vb-gray/60">Todavía no hay asignaciones.</p> : <div className="divide-y divide-ink/10">{assignments.map((assignment) => <div key={`${assignment.club_id}:${assignment.usuario_id}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{nameFor(assignment.usuario_id)}</p><p className="text-sm text-vb-gray/60">{clubFor(assignment.club_id)}</p></div><button onClick={() => void remove(assignment)} className="text-sm font-semibold text-red-700 underline">Quitar acceso</button></div>)}</div>}
    </Card>
  </div>;
}
