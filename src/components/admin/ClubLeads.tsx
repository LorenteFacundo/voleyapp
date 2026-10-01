import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';

type Lead = {
  id: number;
  club_nombre: string;
  localidad: string;
  contacto_nombre: string;
  contacto: string;
  cantidad_canchas: number;
  estado: string;
  created_at: string;
};

const estados = [
  ['nuevo', 'Nuevo'], ['contactado', 'Contactado'],
  ['en_preparacion', 'En preparación'], ['incorporado', 'Incorporado'],
];

export function ClubLeads() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('solicitudes_club').select('*').order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast.error('No se pudieron cargar las consultas'); return; }
    setItems((data ?? []) as Lead[]);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function updateStatus(id: number, estado: string) {
    const { error } = await supabase.from('solicitudes_club').update({ estado }).eq('id', id);
    if (error) { toast.error('No se pudo actualizar'); return; }
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, estado } : item));
  }

  if (loading) return <p className="py-8 text-center text-ink/50">Cargando consultas...</p>;
  if (!items.length) return <Card padding="lg"><p className="text-center text-ink/60">Todavía no llegaron consultas de canchas.</p></Card>;
  return <div className="grid gap-3">{items.map((item) => <Card key={item.id} padding="md">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h3 className="font-bold text-vb-blue">{item.club_nombre}</h3>
        <p className="text-sm text-ink/60">{item.localidad} · {item.cantidad_canchas} {item.cantidad_canchas === 1 ? 'cancha' : 'canchas'}</p>
        <p className="mt-2 text-sm">{item.contacto_nombre} · <span className="font-semibold">{item.contacto}</span></p>
        <p className="mt-1 text-xs text-ink/45">{new Date(item.created_at).toLocaleString('es-AR')}</p></div>
      <label className="text-xs font-semibold text-ink/60">Seguimiento<select aria-label={`Estado de ${item.club_nombre}`} value={item.estado} onChange={(event) => void updateStatus(item.id, event.target.value)} className="mt-1 block rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink">{estados.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
  </Card>)}</div>;
}
