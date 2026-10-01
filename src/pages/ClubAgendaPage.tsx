import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, Clock3, LockKeyhole, Plus, Repeat2, UnlockKeyhole, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { addDaysToISODate, todayArgentinaISO } from '@/lib/date';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type Club = { id: number; nombre: string };
type Cancha = { id: number; titulo: string; club_id: number };
type AgendaItem = {
  id: number | string; fija_id?: number; turno_id?: number; cancha_id: number; cancha: string;
  fecha: string; hora_inicio: string; hora_fin: string;
  estado: string; estado_pago: string; origen: string; dia_semana?: number;
  contacto: string | null; responsable: string | null; expira_at?: string | null;
};
type FixedEdit = { id: number; fecha: string; dia: number; inicio: string; fin: string };

const dateFromIso = (value: string) => new Date(`${value}T12:00:00Z`);
const weekdayFromIso = (value: string) => dateFromIso(value).getUTCDay();
const argentinaDateLabel = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-AR', { ...options, timeZone: 'America/Argentina/Buenos_Aires' })
    .format(dateFromIso(value));
const mondayStart = (value: string) => addDaysToISODate(value, -((weekdayFromIso(value) + 6) % 7));

export function ClubAgendaPage() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState<number | null>(null);
  const [courts, setCourts] = useState<Cancha[]>([]);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [start, setStart] = useState(() => mondayStart(todayArgentinaISO()));
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'manual' | 'fija' | 'bloqueo' | null>(null);
  const [working, setWorking] = useState(false);
  const [fixedEdit, setFixedEdit] = useState<FixedEdit | null>(null);
  const end = useMemo(() => addDaysToISODate(start, 6), [start]);

  useEffect(() => {
    supabase.rpc('pilot_mis_clubes').then(({ data, error }) => {
      if (error) { toast.error('No se pudieron cargar tus clubes'); setLoading(false); return; }
      const rows = (data ?? []) as Club[];
      setClubs(rows);
      setClubId(rows[0]?.id ?? null);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!clubId) { setLoading(false); return; }
    setLoading(true);
    const [agenda, canchas] = await Promise.all([
      supabase.rpc('pilot_agenda', { p_club_id: clubId, p_desde: start, p_hasta: end }),
      supabase.from('canchas').select('id,titulo,club_id').eq('club_id', clubId).order('titulo'),
    ]);
    setLoading(false);
    if (agenda.error || canchas.error) { toast.error(agenda.error?.message ?? canchas.error?.message ?? 'No se pudo cargar la agenda'); return; }
    setItems((agenda.data ?? []) as AgendaItem[]);
    setCourts((canchas.data ?? []) as Cancha[]);
  }, [clubId, start, end]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function resolve(id: number, confirm: boolean) {
    setWorking(true);
    const { error } = await supabase.rpc('pilot_resolver_solicitud', { p_id: id, p_confirmar: confirm });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success(confirm ? 'Reserva confirmada' : 'Solicitud rechazada');
    void refresh();
  }

  async function changePayment(id: number, estado: string) {
    const { error } = await supabase.rpc('pilot_actualizar_pago', { p_id: id, p_estado: estado });
    if (error) toast.error(error.message);
    else void refresh();
  }

  async function cancel(id: number) {
    if (!window.confirm('¿Cancelar esta reserva confirmada?')) return;
    const { error } = await supabase.rpc('pilot_cancelar_confirmada', { p_id: id });
    if (error) toast.error(error.message);
    else { toast.success('Reserva cancelada'); void refresh(); }
  }

  async function reopenBlock(turnoId: number) {
    if (!window.confirm('¿Reabrir este horario para recibir solicitudes?')) return;
    setWorking(true);
    const { error } = await supabase.rpc('pilot_reabrir_bloqueo', { p_turno_id: turnoId });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Horario reabierto');
    void refresh();
  }

  async function exclude(fijaId: number, fecha: string) {
    if (!window.confirm(`¿Liberar solo el ${fecha} de este alquiler fijo?`)) return;
    const { error } = await supabase.rpc('pilot_excluir_fecha_fija', { p_id: fijaId, p_fecha: fecha });
    if (error) toast.error(error.message);
    else { toast.success('Fecha liberada'); void refresh(); }
  }

  async function reprogram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fixedEdit) return;
    const data = new FormData(event.currentTarget);
    setWorking(true);
    const { error } = await supabase.rpc('pilot_reprogramar_fija', {
      p_id: fixedEdit.id, p_desde_cambio: String(data.get('desde')),
      p_dia: Number(data.get('dia')), p_inicio: String(data.get('inicio')),
      p_fin: String(data.get('fin')),
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Se actualizaron las fechas futuras');
    setFixedEdit(null);
    void refresh();
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const canchaId = Number(data.get('cancha'));
    setWorking(true);
    const result = mode === 'fija'
      ? await supabase.rpc('pilot_crear_fija', {
        p_cancha_id: canchaId, p_responsable: String(data.get('responsable')),
        p_contacto: String(data.get('contacto') ?? ''), p_dia: Number(data.get('dia')),
        p_inicio: String(data.get('inicio')), p_fin: String(data.get('fin')),
        p_desde: String(data.get('desde')), p_hasta: String(data.get('hasta')),
      })
      : mode === 'bloqueo'
        ? await supabase.rpc('pilot_bloquear_horario', {
          p_cancha_id: canchaId, p_fecha: String(data.get('fecha')),
          p_inicio: String(data.get('inicio')), p_fin: String(data.get('fin')),
        })
        : await supabase.rpc('pilot_crear_manual', {
        p_cancha_id: canchaId, p_fecha: String(data.get('fecha')),
        p_inicio: String(data.get('inicio')), p_fin: String(data.get('fin')),
        p_contacto: String(data.get('responsable')),
      });
    setWorking(false);
    if (result.error) { toast.error(result.error.message); return; }
    toast.success(mode === 'fija' ? 'Alquiler fijo guardado' : mode === 'bloqueo' ? 'Horario bloqueado' : 'Reserva agregada');
    setMode(null);
    void refresh();
  }

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysToISODate(start, index)), [start]);
  const statusLabel: Record<string, string> = { pendiente: 'Pendiente de respuesta', confirmada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada', vencida: 'Vencida', fija: 'Alquiler fijo', bloqueado: 'Bloqueado por el club' };

  function renderAgendaItem(item: AgendaItem, day: string) {
    const requestId = typeof item.id === 'number' ? item.id : null;
    const background = item.estado === 'pendiente' ? 'bg-amber-50'
      : item.estado === 'fija' ? 'bg-blue-50'
        : item.estado === 'confirmada' ? 'bg-green-50'
          : item.estado === 'bloqueado' ? 'bg-slate-100' : 'bg-gray-50';

    return (
      <div key={item.id} className={`rounded-xl p-3 text-xs ${background}`}>
        <div className="flex items-center gap-1 font-black">
          <Clock3 size={13} />{item.hora_inicio.slice(0, 5)}–{item.hora_fin.slice(0, 5)}
        </div>
        <p className="mt-1 font-bold">{item.cancha}</p>
        {(item.responsable ?? item.contacto) && <p className="mt-1">{item.responsable ?? item.contacto}</p>}
        <p className="mt-1 text-ink/55">{statusLabel[item.estado] ?? item.estado}</p>
        {item.estado_pago === 'devolucion_pendiente' && <p className="mt-1 font-semibold text-amber-800">Devolución externa pendiente</p>}
        {item.estado === 'pendiente' && item.expira_at && <p className="mt-1 text-amber-800">Vence {new Date(item.expira_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}</p>}
        {item.estado === 'pendiente' && requestId !== null && <div className="mt-2 flex gap-2">
          <button disabled={working} onClick={() => void resolve(requestId, true)} className="rounded bg-green-700 px-2 py-1 font-bold text-white" aria-label="Confirmar solicitud"><Check size={13} /></button>
          <button disabled={working} onClick={() => void resolve(requestId, false)} className="rounded bg-red-700 px-2 py-1 font-bold text-white" aria-label="Rechazar solicitud"><X size={13} /></button>
        </div>}
        {item.estado === 'confirmada' && requestId !== null && <div className="mt-2">
          <select aria-label="Pago" value={item.estado_pago} onChange={(event) => void changePayment(requestId, event.target.value)} className="max-w-full rounded border border-ink/15 p-1">
            <option value="pendiente">Pago pendiente</option><option value="sena">Seña</option><option value="pagado">Pagado</option>
          </select>
          <button onClick={() => void cancel(requestId)} className="mt-2 block text-red-700 underline">Cancelar</button>
        </div>}
        {item.estado === 'bloqueado' && item.turno_id && <button disabled={working} onClick={() => void reopenBlock(item.turno_id!)} className="mt-2 flex items-center gap-1 text-vb-blue underline disabled:opacity-50"><UnlockKeyhole size={13} /> Reabrir horario</button>}
        {item.estado === 'fija' && item.fija_id && <div className="mt-2 space-y-1">
          <button onClick={() => void exclude(item.fija_id!, day)} className="block text-vb-blue underline">Liberar esta fecha</button>
          <button disabled={day < todayArgentinaISO()} onClick={() => setFixedEdit({ id: item.fija_id!, fecha: day, dia: weekdayFromIso(day), inicio: item.hora_inicio.slice(0, 5), fin: item.hora_fin.slice(0, 5) })} className="block text-vb-blue underline disabled:opacity-40">Cambiar fechas futuras</button>
        </div>}
      </div>
    );
  }

  return <div className="app-shell min-h-screen pb-20">
    <header className="border-b border-vb-gray/10 bg-white"><div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4"><Button variant="ghost" size="sm" onClick={() => navigate('/app')}><ArrowLeft size={18} /></Button><div><h1 className="text-xl font-black text-vb-blue">Agenda del club</h1><p className="text-xs text-vb-gray/60">Solicitudes, reservas propias y alquileres fijos</p></div></div></header>
    <main className="mx-auto max-w-7xl px-4 py-6">
      {clubs.length === 0 && !loading ? <Card padding="lg"><p>Todavía no tenés clubes asignados. Un administrador global debe asignarte uno.</p></Card> : <>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <select aria-label="Club" value={clubId ?? ''} onChange={(e) => setClubId(Number(e.target.value))} className="rounded-xl border border-vb-gray/20 bg-white px-4 py-3 font-bold text-vb-blue">{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select>
          <div className="flex items-center gap-2"><Button variant="secondary" size="sm" onClick={() => setStart((value) => addDaysToISODate(value, -7))}>Anterior</Button><span className="text-sm font-semibold">{argentinaDateLabel(start, { day: 'numeric', month: 'short' })} – {argentinaDateLabel(end, { day: 'numeric', month: 'short' })}</span><Button variant="secondary" size="sm" onClick={() => setStart((value) => addDaysToISODate(value, 7))}>Siguiente</Button></div>
          <div className="flex flex-wrap gap-2 sm:ml-auto"><Button size="sm" onClick={() => setMode('manual')}><Plus size={16} /> Reserva externa</Button><Button variant="secondary" size="sm" onClick={() => setMode('fija')}><Repeat2 size={16} /> Alquiler fijo</Button><Button variant="secondary" size="sm" onClick={() => setMode('bloqueo')}><LockKeyhole size={16} /> Bloquear horario</Button></div>
        </div>
        {mode && <Card padding="lg" className="mb-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-vb-blue">{mode === 'fija' ? 'Nuevo alquiler fijo' : mode === 'bloqueo' ? 'Bloquear horario' : 'Cargar reserva externa'}</h2><button aria-label="Cerrar" onClick={() => setMode(null)}><X size={20} /></button></div><form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">Cancha<select name="cancha" required className="mt-1 block w-full rounded-lg border border-ink/20 p-2">{courts.map((court) => <option key={court.id} value={court.id}>{court.titulo}</option>)}</select></label>
          {mode !== 'bloqueo' && <label className="text-sm font-semibold">Responsable<input name="responsable" required minLength={2} maxLength={120} className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label>}
          {mode === 'fija' && <><label className="text-sm font-semibold">Contacto<input name="contacto" className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label><label className="text-sm font-semibold">Día semanal<select name="dia" defaultValue={0} className="mt-1 block w-full rounded-lg border border-ink/20 p-2">{['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label className="text-sm font-semibold">Desde<input name="desde" type="date" required className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label><label className="text-sm font-semibold">Hasta (máximo un año)<input name="hasta" type="date" required className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label></>}
          {mode === 'manual' && <label className="text-sm font-semibold">Fecha<input name="fecha" type="date" required className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label>}
          {mode === 'bloqueo' && <label className="text-sm font-semibold">Fecha<input name="fecha" type="date" min={todayArgentinaISO()} defaultValue={start} required className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label>}
          <label className="text-sm font-semibold">Inicio<input name="inicio" type="time" required className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label><label className="text-sm font-semibold">Fin<input name="fin" type="time" required className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label><div className="flex items-end"><Button type="submit" loading={working} fullWidth>{mode === 'bloqueo' ? 'Guardar bloqueo' : 'Guardar'}</Button></div>
        </form></Card>}
        {fixedEdit && <Card padding="lg" className="mb-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-vb-blue">Cambiar fechas futuras</h2><p className="text-sm text-vb-gray/60">La serie actual queda intacta hasta la fecha elegida.</p></div><button aria-label="Cerrar" onClick={() => setFixedEdit(null)}><X size={20} /></button></div><form onSubmit={reprogram} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">Desde<input name="desde" type="date" min={todayArgentinaISO()} defaultValue={fixedEdit.fecha} required className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label>
          <label className="text-sm font-semibold">Nuevo día<select name="dia" defaultValue={fixedEdit.dia} className="mt-1 block w-full rounded-lg border border-ink/20 p-2">{['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
          <label className="text-sm font-semibold">Inicio<input name="inicio" type="time" defaultValue={fixedEdit.inicio} required className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label>
          <label className="text-sm font-semibold">Fin<input name="fin" type="time" defaultValue={fixedEdit.fin} required className="mt-1 block w-full rounded-lg border border-ink/20 p-2" /></label>
          <div className="flex items-end"><Button type="submit" loading={working} fullWidth>Guardar cambio</Button></div>
        </form></Card>}
        {loading ? (
          <p className="py-12 text-center text-vb-gray/60">Cargando agenda...</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-7">
            {days.map((day) => {
              const dayItems = items
                .filter((item) => item.fecha.slice(0, 10) === day)
                .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

              return (
                <section key={day} className="rounded-2xl border border-ink/10 bg-white p-3">
                  <h2 className="mb-3 flex items-center gap-2 border-b border-ink/10 pb-2 text-sm font-black text-vb-blue">
                    <CalendarDays size={16} />{argentinaDateLabel(day, { weekday: 'short', day: 'numeric' })}
                  </h2>
                  {dayItems.length === 0
                    ? <p className="text-xs text-ink/40">Sin movimientos</p>
                    : <div className="space-y-2">{dayItems.map((item) => renderAgendaItem(item, day))}</div>}
                </section>
              );
            })}
          </div>
        )}
      </>}
    </main>
  </div>;
}
