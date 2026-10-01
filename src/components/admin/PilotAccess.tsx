import { useCallback, useEffect, useState } from 'react';
import { CircleCheck, CircleOff, Pause, Play, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type PilotUser = {
  id: string;
  nombre_completo: string | null;
  email: string;
  rol: string;
  habilitado: boolean;
};

export function PilotAccess() {
  const [users, setUsers] = useState<PilotUser[]>([]);
  const [paused, setPaused] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingPause, setSavingPause] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [usersResult, stateResult] = await Promise.all([
      supabase.rpc('pilot_admin_listar_accesos'),
      supabase.rpc('pilot_estado_acceso'),
    ]);
    setLoading(false);
    if (usersResult.error || stateResult.error) {
      toast.error('No se pudo cargar la configuración del piloto.');
      return;
    }
    setUsers((usersResult.data ?? []) as PilotUser[]);
    setPaused(Boolean((stateResult.data as { reservas_pausadas?: boolean } | null)?.reservas_pausadas ?? true));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function setAccess(user: PilotUser) {
    setSavingId(user.id);
    const { error } = await supabase.rpc('pilot_admin_definir_acceso', {
      p_usuario_id: user.id,
      p_habilitado: !user.habilitado,
    });
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    setUsers((current) => current.map((entry) => entry.id === user.id
      ? { ...entry, habilitado: !entry.habilitado }
      : entry));
    toast.success(user.habilitado ? 'Acceso al piloto retirado' : 'Cuenta habilitada para el piloto');
  }

  async function togglePause() {
    setSavingPause(true);
    const nextPaused = !paused;
    const { error } = await supabase.rpc('pilot_admin_pausar_reservas', {
      p_pausadas: nextPaused,
      p_motivo: nextPaused ? 'Pausa activada por administración' : null,
    });
    setSavingPause(false);
    if (error) { toast.error(error.message); return; }
    setPaused(nextPaused);
    toast.success(nextPaused ? 'Nuevas operaciones pausadas' : 'Nuevas operaciones habilitadas');
  }

  const filteredUsers = users.filter((user) => {
    const needle = query.trim().toLocaleLowerCase('es-AR');
    return !needle || `${user.nombre_completo ?? ''} ${user.email}`.toLocaleLowerCase('es-AR').includes(needle);
  });

  return (
    <div className="grid gap-5">
      <Card padding="lg" className="border-vb-orange/20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${paused ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
              {paused ? <Pause size={19} /> : <Play size={19} />}
            </span>
            <div>
              <h2 className="font-bold text-ink">{paused ? 'Nuevas operaciones pausadas' : 'Nuevas operaciones habilitadas'}</h2>
              <p className="mt-1 max-w-2xl text-sm text-ink/60">La pausa bloquea nuevas solicitudes desde el servidor; no cancela reservas ni impide que el club gestione las que ya recibió.</p>
            </div>
          </div>
          <Button variant={paused ? 'primary' : 'secondary'} loading={savingPause} onClick={() => void togglePause()}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
            {paused ? 'Habilitar nuevas operaciones' : 'Pausar nuevas operaciones'}
          </Button>
        </div>
      </Card>

      <Card padding="lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-ink"><ShieldCheck size={18} className="text-vb-orange" /> Acceso por invitación</h2>
            <p className="mt-1 text-sm text-ink/60">El registro sigue abierto, pero solo las cuentas habilitadas pueden solicitar reservas u organizar partidos.</p>
          </div>
          <input aria-label="Buscar usuario" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o email" className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm sm:max-w-xs" />
        </div>
        {loading ? <p className="py-8 text-center text-sm text-ink/50">Cargando cuentas…</p> : (
          <div className="mt-5 grid gap-2">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 rounded-xl border border-ink/10 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{user.nombre_completo || 'Sin nombre'}</p>
                  <p className="truncate text-xs text-ink/55">{user.email} · {user.rol}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold ${user.habilitado ? 'text-green-700' : 'text-ink/45'}`}>
                  {user.habilitado ? 'Habilitado' : 'Solo consulta'}
                </span>
                <Button size="sm" variant={user.habilitado ? 'ghost' : 'secondary'} loading={savingId === user.id} onClick={() => void setAccess(user)} aria-label={user.habilitado ? 'Retirar acceso' : 'Habilitar acceso'}>
                  {user.habilitado ? <CircleOff size={15} /> : <CircleCheck size={15} />}
                  {user.habilitado ? 'Retirar' : 'Habilitar'}
                </Button>
              </div>
            ))}
            {filteredUsers.length === 0 && <p className="py-6 text-center text-sm text-ink/50">No hay cuentas que coincidan con la búsqueda.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
