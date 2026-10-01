import { useState } from 'react';
import { User, ArrowLeft, LogOut, Award } from 'lucide-react';
import { BadgesGrid } from '@/components/features/BadgesGrid';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BottomNav } from '@/components/layout/BottomNav';
import { AuthForm } from '@/components/features/AuthForm';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { etiquetaNivelVoley, nivelesVoley } from '@/lib/nivel';

export function PerfilPage() {
  const navigate = useNavigate();
  const { session, perfil, signOut, refreshPerfil } = useAuth();
  const [params, setParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState(perfil?.nombre_completo ?? '');
  const [level, setLevel] = useState(String(perfil?.nivel_voley ?? 5));
  const [editing, setEditing] = useState(false);

  async function saveProfile() {
    const nivel = Number(level);
    if (!name.trim() || !nivelesVoley.some((option) => option.value === nivel)) { toast.error('Revisá el nombre y elegí un nivel de vóley.'); return; }
    const { error } = await supabase.from('usuarios').update({ nombre_completo: name.trim(), nivel_voley: nivel }).eq('id', session?.user.id);
    if (error) { toast.error(error.message); return; }
    await refreshPerfil();
    setEditing(false);
    toast.success('Perfil actualizado');
  }

  async function changePassword() {
    if (newPassword.length < 8) { toast.error('Usá una contraseña de al menos 8 caracteres.'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); return; }
    setNewPassword('');
    setParams({});
    toast.success('Contraseña actualizada');
  }

  if (!session) {
    return (
      <div className="app-shell pb-20 md:pb-0">
        <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/app')}>
              <ArrowLeft size={18} />
            </Button>
            <h1 className="text-lg font-bold text-vb-blue">Perfil</h1>
          </div>
        </header>

        <main className="mx-auto max-w-sm px-4 py-6">
          <Card padding="lg">
            <div className="flex flex-col items-center gap-4 mb-4 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-vb-orange-light text-vb-orange">
                <User size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-vb-blue">Bienvenido</h2>
                <p className="text-sm text-vb-gray/65">
                  Iniciá sesión o creá una cuenta para continuar.
                </p>
              </div>
            </div>
            <AuthForm onMessage={(msg) => toast(msg)} />
          </Card>
        </main>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app-shell pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-vb-gray/10 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/app')}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-lg font-bold text-vb-blue">Perfil</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {params.get('recuperar') === '1' && <Card padding="lg" className="mb-5"><h2 className="mb-3 font-bold text-vb-blue">Nueva contraseña</h2><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Al menos 8 caracteres" className="mb-3 w-full rounded-xl border border-ink/20 px-4 py-3" /><Button onClick={changePassword} fullWidth>Guardar contraseña</Button></Card>}
        <Card padding="lg">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-vb-orange text-white text-3xl font-black">
              {(perfil?.nombre_completo ?? session.user.email ?? 'U')[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-vb-blue">
                {perfil?.nombre_completo ?? 'Usuario'}
              </h2>
              <p className="text-sm text-vb-gray/65">{session.user.email}</p>
            </div>
            {editing ? <div className="w-full space-y-3 text-left"><label className="block text-sm font-semibold">Nombre<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-lg border border-ink/20 px-3 py-2" /></label><label className="block text-sm font-semibold">Nivel de vóley<select value={level} onChange={(event) => setLevel(event.target.value)} className="mt-1 block w-full rounded-lg border border-ink/20 px-3 py-2">{nivelesVoley.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><Button fullWidth onClick={saveProfile}>Guardar perfil</Button></div> : <Button variant="secondary" size="sm" onClick={() => { setName(perfil?.nombre_completo ?? ''); setLevel(String(perfil?.nivel_voley ?? 5)); setEditing(true); }}>Editar perfil</Button>}

            <div className="grid w-full grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-vb-light p-3">
                <p className="text-lg font-bold text-vb-orange">{etiquetaNivelVoley(perfil?.nivel_voley)}</p>
                <p className="text-xs text-vb-gray/60">Nivel</p>
              </div>
              <div className="rounded-xl bg-vb-light p-3">
                <p className="text-2xl font-bold text-vb-blue capitalize">{perfil?.rol ?? 'jugador'}</p>
                <p className="text-xs text-vb-gray/60">Rol</p>
              </div>
              <div className="rounded-xl bg-vb-light p-3">
                <p className="text-2xl font-bold text-vb-green">{perfil?.partidos_jugados ?? 0}</p>
                <p className="text-xs text-vb-gray/60">Jugados</p>
              </div>
            </div>

            {/* Puntos de actividad */}
            <Button variant="secondary" fullWidth onClick={() => navigate('/mis-reservas')}>Ver mis reservas</Button>
            <div className="w-full rounded-xl bg-vb-light p-4 text-center">
              <p className="text-3xl font-black text-vb-orange">{perfil?.puntos_total ?? 0}</p>
              <p className="text-xs text-vb-gray/60">Puntos de actividad</p>
            </div>

            {/* Badges */}
            <div className="w-full">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-vb-blue">
                <Award size={18} />
                Mis badges
              </h3>
              <BadgesGrid usuarioId={session.user.id} />
            </div>

            <Button variant="danger" fullWidth onClick={signOut}>
              <LogOut size={17} />
              Cerrar sesión
            </Button>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
