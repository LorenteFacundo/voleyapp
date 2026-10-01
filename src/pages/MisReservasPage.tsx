import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { pilotBookingsEnabled } from '@/lib/pilot';

type Reserva = {
  id: number;
  estado_pago: string;
  disponibilidad_turnos: {
    fecha: string; hora_inicio: string; hora_fin: string;
    canchas: { titulo: string; clubes: { nombre: string } | null } | null;
  } | null;
};
type Solicitud = { id: number; reserva_id: number | null; fecha: string; hora_inicio: string; hora_fin: string; estado: string; estado_pago: string; expira_at: string | null; cancha_id: number; partido_config: Record<string, unknown> | null; canchas: { titulo: string }[] | null };

export function MisReservasPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Reserva[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    let cancelled = false;
    const loadLegacy = supabase.from('reservas')
      .select('id, estado_pago, disponibilidad_turnos:turno_id(fecha, hora_inicio, hora_fin, canchas:cancha_id(titulo, clubes:club_id(nombre)))')
      .eq('usuario_id', session.user.id).order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError('No pudimos cargar tus reservas.');
        else setItems((data ?? []) as unknown as Reserva[]);
      });
    const loadRequests = pilotBookingsEnabled
      ? supabase.from('solicitudes_reserva').select('id,reserva_id,fecha,hora_inicio,hora_fin,estado,estado_pago,expira_at,cancha_id,partido_config,canchas:cancha_id(titulo)').eq('usuario_id', session.user.id).order('created_at', { ascending: false }).then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) setError('No pudimos cargar tus solicitudes.');
        else setSolicitudes((data ?? []) as Solicitud[]);
      })
      : Promise.resolve();
    Promise.all([loadLegacy, loadRequests]).then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session]);

  return <div className="app-shell pb-20 md:pb-0">
    <header className="border-b border-vb-gray/10 bg-white"><div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4"><Button variant="ghost" size="sm" onClick={() => navigate('/app')}><ArrowLeft size={18} /></Button><h1 className="text-xl font-black text-vb-blue">Mis reservas</h1></div></header>
    <main className="mx-auto max-w-5xl px-4 py-8">
      {!session ? <Card padding="lg"><p className="mb-4">Iniciá sesión para ver tus reservas.</p><Button onClick={() => navigate('/perfil')}>Ir a mi perfil</Button></Card>
        : loading ? <p>Cargando reservas...</p>
          : error ? <p role="alert" className="text-vb-red">{error}</p>
            : items.length === 0 && solicitudes.length === 0 ? <Card padding="lg"><div className="flex flex-col items-center gap-3 py-8 text-center"><CalendarDays size={36} className="text-vb-orange" /><h2 className="text-xl font-bold">Todavía no tenés reservas</h2><p className="text-sm text-vb-gray/60">Explorá las canchas y elegí cuándo jugar.</p><Button onClick={() => navigate('/canchas')}>Ver canchas</Button></div></Card>
              : <div className="grid gap-3 sm:grid-cols-2">{solicitudes.map((item) => { const expired = item.estado === 'pendiente' && item.expira_at && new Date(item.expira_at) < new Date(); return <Card key={`s-${item.id}`} padding="md"><h2 className="font-bold text-vb-blue">{item.partido_config ? 'Solicitud para organizar partido' : item.canchas?.[0]?.titulo ?? 'Solicitud de cancha'}</h2><p className="mt-2 text-sm">{formatDate(item.fecha)} · {item.hora_inicio.slice(0, 5)}–{item.hora_fin.slice(0, 5)}</p><p className="mt-2 text-sm font-semibold text-vb-orange">{expired ? 'Vencida' : item.estado}</p>{!expired && item.estado === 'pendiente' && item.expira_at && <p className="mt-1 text-xs text-vb-gray/60">El club debe responder antes de {new Date(item.expira_at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</p>}{item.estado === 'confirmada' && <p className="mt-1 text-xs text-vb-gray/60">Pago externo: {item.estado_pago}</p>}</Card>; })}{items.filter((item) => !solicitudes.some((s) => s.reserva_id === item.id)).map((item) => <Card key={item.id} padding="md"><h2 className="font-bold text-vb-blue">{item.disponibilidad_turnos?.canchas?.titulo ?? 'Cancha'}</h2><p className="text-sm text-vb-gray/60">{item.disponibilidad_turnos?.canchas?.clubes?.nombre}</p><p className="mt-3 text-sm font-semibold">{item.disponibilidad_turnos && formatDate(item.disponibilidad_turnos.fecha)} · {item.disponibilidad_turnos?.hora_inicio?.slice(0, 5)}–{item.disponibilidad_turnos?.hora_fin?.slice(0, 5)}</p><p className="mt-2 text-xs text-vb-gray/55">Pago externo: {item.estado_pago}</p></Card>)}</div>}
    </main><BottomNav />
  </div>;
}
