import { useState } from 'react';
import { Pencil, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { adminActualizarClub } from '@/lib/admin';
import type { ClubAdmin } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type ClubesTableProps = {
  clubes: ClubAdmin[];
  loading: boolean;
  onRefresh: () => void;
};

export function ClubesTable({ clubes, loading, onRefresh }: ClubesTableProps) {
  const [editando, setEditando] = useState<ClubAdmin | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit form state
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');

  function startEdit(club: ClubAdmin) {
    setEditando(club);
    setNombre(club.nombre);
    setDireccion(club.direccion ?? '');
    setTelefono(club.telefono ?? '');
    setLatitud(String(club.latitud));
    setLongitud(String(club.longitud));
  }

  async function handleSave() {
    if (!editando) return;
    setSubmitting(true);
    try {
      await adminActualizarClub({
        clubId: editando.id,
        nombre,
        direccion,
        telefono,
        latitud: parseFloat(latitud),
        longitud: parseFloat(longitud),
      });
      toast.success('Club actualizado');
      setEditando(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-ink/50">Cargando clubes...</div>;
  }

  return (
    <>
      <div className="text-sm text-ink/50 mb-3">{clubes.length} clubes</div>

      <div className="grid gap-3">
        {clubes.map((club) => (
          <Card key={club.id} padding="md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-ink">{club.nombre}</h3>
                {club.direccion && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/60">
                    <MapPin size={14} />
                    {club.direccion}
                  </p>
                )}
                {club.telefono && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/60">
                    <Phone size={14} />
                    {club.telefono}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink/40">
                  {club.canchas_count} cancha{club.canchas_count !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(club)}>
                  <Pencil size={14} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit modal */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card padding="lg" className="w-full max-w-md">
            <h2 className="text-lg font-bold text-ink mb-4">Editar club</h2>
            <div className="flex flex-col gap-3">
              <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Input label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              <Input label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Latitud" type="number" step="any" value={latitud} onChange={(e) => setLatitud(e.target.value)} />
                <Input label="Longitud" type="number" step="any" value={longitud} onChange={(e) => setLongitud(e.target.value)} />
              </div>
              <div className="flex gap-3 justify-end mt-2">
                <Button variant="ghost" onClick={() => setEditando(null)} disabled={submitting}>Cancelar</Button>
                <Button onClick={handleSave} loading={submitting}>Guardar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

    </>
  );
}
