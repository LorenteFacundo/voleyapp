import { useState } from 'react';
import { UserCog, Mail, Volleyball } from 'lucide-react';
import { toast } from 'sonner';
import { adminActualizarRol } from '@/lib/admin';
import type { UsuarioAdmin } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type UsuariosTableProps = {
  usuarios: UsuarioAdmin[];
  loading: boolean;
  onRefresh: () => void;
};

const ROLES = ['jugador', 'admin_cancha', 'admin_global', 'superadmin'];

const rolColors: Record<string, string> = {
  jugador: 'default',
  admin_cancha: 'court',
  admin_global: 'warning',
  superadmin: 'danger',
};

const nivelLabels: Record<number, string> = {
  1: 'Principiante',
  2: 'Básico',
  3: 'Básico+',
  4: 'Intermedio-',
  5: 'Intermedio',
  6: 'Intermedio+',
  7: 'Avanzado',
  8: 'Avanzado+',
  9: 'Competitivo',
  10: 'Élite',
};

export function UsuariosTable({ usuarios, loading, onRefresh }: UsuariosTableProps) {
  const [cambiandoRol, setCambiandoRol] = useState<UsuarioAdmin | null>(null);
  const [nuevoRol, setNuevoRol] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function startChangeRole(usuario: UsuarioAdmin) {
    setCambiandoRol(usuario);
    setNuevoRol(usuario.rol);
  }

  async function handleSaveRol() {
    if (!cambiandoRol) return;
    setSubmitting(true);
    try {
      await adminActualizarRol(cambiandoRol.id, nuevoRol);
      toast.success(`Rol de ${cambiandoRol.nombre_completo} actualizado a ${nuevoRol}`);
      setCambiandoRol(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar rol');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-ink/50">Cargando usuarios...</div>;
  }

  return (
    <>
      <div className="text-sm text-ink/50 mb-3">{usuarios.length} usuarios</div>

      <div className="grid gap-2">
        {usuarios.map((usuario) => (
          <Card key={usuario.id} padding="md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-court/10 text-court">
                <Volleyball size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-ink">{usuario.nombre_completo ?? 'Sin nombre'}</h3>
                <p className="flex items-center gap-1 text-xs text-ink/50">
                  <Mail size={12} />
                  {usuario.email}
                </p>
                <div className="mt-1 flex gap-2">
                  <Badge variant={(rolColors[usuario.rol] as 'default' | 'court' | 'warning' | 'danger') ?? 'default'}>
                    {usuario.rol}
                  </Badge>
                  {usuario.nivel_voley && (
                    <span className="text-xs text-ink/40">
                      Nivel: {nivelLabels[usuario.nivel_voley] ?? usuario.nivel_voley}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => startChangeRole(usuario)}>
                <UserCog size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {cambiandoRol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card padding="lg" className="w-full max-w-sm">
            <h2 className="text-lg font-bold text-ink mb-4">
              Cambiar rol de {cambiandoRol.nombre_completo}
            </h2>
            <div className="flex flex-col gap-3">
              <label className="block text-sm font-semibold text-ink">
                Rol
                <select
                  className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-court/40 focus:outline-none"
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
              <div className="flex gap-3 justify-end mt-2">
                <Button variant="ghost" onClick={() => setCambiandoRol(null)} disabled={submitting}>Cancelar</Button>
                <Button onClick={handleSaveRol} loading={submitting}>Guardar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
