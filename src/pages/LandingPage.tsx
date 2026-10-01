import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, MapPin, MessageCircle, ShieldCheck, Volleyball } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const whatsapp = (import.meta.env.VITE_CONTACT_WHATSAPP as string | undefined)?.replace(/\D/g, '');
const leadsEnabled = import.meta.env.VITE_CLUB_LEADS_ENABLED === 'true';

export function LandingPage() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loadedAt] = useState(Date.now);

  async function sendLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leadsEnabled) { setError('El formulario estará disponible pronto.'); return; }
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get('website') || Date.now() - loadedAt < 2500) return;
    setSending(true);
    setError('');
    try {
      const { error: submitError } = await supabase.functions.invoke('submit-club-lead', {
        body: {
          club_nombre: String(data.get('club') ?? '').trim(),
          localidad: String(data.get('localidad') ?? '').trim(),
          contacto_nombre: String(data.get('nombre') ?? '').trim(),
          contacto: String(data.get('contacto') ?? '').trim(),
          cantidad_canchas: Number(data.get('canchas') || 1),
          website: String(data.get('website') ?? ''),
        },
      });
      if (submitError) throw submitError;
      form.reset();
      setSent(true);
    } catch {
      setError('No pudimos enviar tu consulta. Intentá de nuevo en un momento.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f9f7f0] text-[#142153]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-black tracking-tight">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-vb-orange text-white"><Volleyball size={23} /></span>
          VoleyApp
        </Link>
        <div className="flex items-center gap-3">
          <a href="#clubes" className="hidden text-sm font-semibold hover:text-vb-orange sm:inline">Para canchas</a>
          <Link to="/app" className="rounded-full bg-[#142153] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-vb-orange">Entrar a la app</Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-y border-[#142153]/10 bg-[#142153] text-white">
          <div className="pointer-events-none absolute -right-20 -top-32 h-[28rem] w-[28rem] rounded-full border-[5rem] border-vb-orange/90 sm:right-[5%]" />
          <div className="pointer-events-none absolute -bottom-24 right-[28%] h-64 w-64 rounded-full border-[3rem] border-white/10" />
          <div className="relative mx-auto grid min-h-[570px] max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="max-w-3xl">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-[#ffdc84]"><MapPin size={14} /> Zona Sur + CABA</p>
              <h1 className="font-display text-5xl font-black leading-[1.02] tracking-tight text-white sm:text-7xl">Más voley.<br /><span className="text-[#ffcf64]">Menos vueltas.</span></h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/75">Encontrá una cancha, armá un partido y sumá jugadores. Todo en un mismo lugar.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/app" className="inline-flex items-center gap-2 rounded-full bg-vb-orange px-7 py-3.5 font-bold text-white shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ff865b]">Quiero jugar <ArrowRight size={18} /></Link>
                <a href="#clubes" className="inline-flex items-center gap-2 rounded-full border border-white/35 px-7 py-3.5 font-bold transition hover:bg-white/10">Tengo una cancha</a>
              </div>
            </div>
            <div className="relative hidden lg:block" aria-hidden="true">
              <div className="absolute -left-10 -top-12 rotate-[-8deg] rounded-2xl bg-[#ffcf64] px-6 py-4 font-display text-2xl font-black text-[#142153] shadow-2xl">¿Sale partido?</div>
              <div className="rounded-[2.5rem] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur">
                <div className="rounded-[2rem] bg-[#f9f7f0] p-7 text-[#142153]">
                  <div className="mb-7 flex items-center justify-between"><span className="font-display text-xl font-black">Próximo partido</span><Volleyball className="text-vb-orange" /></div>
                  <div className="space-y-4 text-sm font-semibold"><div className="rounded-2xl bg-white p-4">📍 Elegí tu cancha</div><div className="rounded-2xl bg-white p-4">🗓️ Encontrá un horario</div><div className="rounded-2xl bg-white p-4">🙌 Invitá jugadores</div></div>
                  <div className="mt-7 rounded-2xl bg-[#142153] px-5 py-4 text-center font-bold text-white">Todo listo para jugar</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <p className="text-xs font-black uppercase tracking-[.2em] text-vb-orange">Para quienes quieren jugar</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-black tracking-tight sm:text-5xl">Del “¿quién se prende?” al partido armado.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: MapPin, title: 'Explorá canchas', text: 'Mirá opciones y horarios en Zona Sur y Capital.' },
              { icon: CalendarDays, title: 'Pedí tu horario', text: 'Solicitá una reserva y seguí su confirmación con el club.' },
              { icon: Volleyball, title: 'Completá el equipo', text: 'Organizá un partido y compartilo con tu grupo.' },
            ].map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="rounded-[1.7rem] border border-[#142153]/10 bg-white p-7 shadow-[0_20px_50px_-35px_rgba(20,33,83,.35)]">
                <div className="mb-6 flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-xl bg-vb-orange-light text-vb-orange"><Icon /></span><span className="font-display text-4xl font-black text-[#142153]/10">0{index + 1}</span></div>
                <h3 className="font-display text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[#142153]/65">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="clubes" className="bg-[#f0e9da] px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-vb-orange">Para clubes y canchas</p>
              <h2 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">Tu agenda ordenada. Más espacio para jugar.</h2>
              <p className="mt-6 max-w-lg leading-relaxed text-[#142153]/70">Reuní en una sola agenda tus reservas por WhatsApp, teléfono y VoleyApp. Mantené tus alquileres fijos y recibí nuevas solicitudes sin perder el control de tus horarios.</p>
              <div className="mt-8 space-y-3">
                {['Agenda semanal para todas tus canchas', 'Alquileres fijos y excepciones por fecha', 'Confirmación de cada solicitud desde el club'].map((item) => <div key={item} className="flex items-center gap-3 font-semibold"><CheckCircle2 className="text-vb-orange" size={20} />{item}</div>)}
              </div>
              {whatsapp && <a className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-[#142153] px-6 py-3 font-bold transition hover:bg-[#142153] hover:text-white" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola, quiero sumar mi cancha a VoleyApp')}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} /> Hablemos por WhatsApp</a>}
            </div>
            <div className="rounded-[2rem] bg-white p-6 shadow-[0_25px_80px_-45px_rgba(20,33,83,.4)] sm:p-9">
              <h3 className="font-display text-2xl font-black">Sumá tu cancha</h3>
              <p className="mt-2 text-sm text-[#142153]/60">Dejanos tus datos y te contactamos para conocer tu espacio.</p>
              {sent ? <div role="status" className="mt-8 rounded-2xl bg-green-50 p-5 text-green-800"><CheckCircle2 className="mb-2" /> Recibimos tu consulta. Pronto nos comunicaremos.</div> : (
                <form onSubmit={sendLead} className="mt-6 grid gap-4">
                  <label className="text-sm font-bold">Nombre del club<input name="club" required minLength={2} maxLength={120} className="mt-1 block w-full rounded-xl border border-[#142153]/20 px-4 py-3 font-normal outline-none focus:border-vb-orange" /></label>
                  <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Localidad<input name="localidad" required minLength={2} maxLength={100} className="mt-1 block w-full rounded-xl border border-[#142153]/20 px-4 py-3 font-normal outline-none focus:border-vb-orange" /></label><label className="text-sm font-bold">Cantidad de canchas<input name="canchas" type="number" min={1} max={100} defaultValue={1} required className="mt-1 block w-full rounded-xl border border-[#142153]/20 px-4 py-3 font-normal outline-none focus:border-vb-orange" /></label></div>
                  <label className="text-sm font-bold">Tu nombre<input name="nombre" required minLength={2} maxLength={100} className="mt-1 block w-full rounded-xl border border-[#142153]/20 px-4 py-3 font-normal outline-none focus:border-vb-orange" /></label>
                  <label className="text-sm font-bold">Email o WhatsApp<input name="contacto" required minLength={6} maxLength={160} className="mt-1 block w-full rounded-xl border border-[#142153]/20 px-4 py-3 font-normal outline-none focus:border-vb-orange" /></label>
                  <label className="absolute -left-[9999px]" aria-hidden="true">Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label>
                  {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                  <button disabled={sending || !leadsEnabled} className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-vb-orange px-6 py-3.5 font-bold text-white transition hover:bg-[#ef5c28] disabled:opacity-60">{sending ? 'Enviando...' : leadsEnabled ? 'Quiero sumar mi cancha' : 'Formulario próximamente'} <ArrowRight size={18} /></button>
                  <p className="text-xs text-[#142153]/50">Usaremos estos datos solo para responder tu consulta.</p>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col items-center justify-between gap-4 bg-[#142153] px-5 py-7 text-sm text-white/65 sm:flex-row sm:px-8"><span className="flex items-center gap-2 font-display font-bold text-white"><Volleyball size={18} /> VoleyApp</span><span>Zona Sur · Capital Federal</span><span className="flex items-center gap-2"><ShieldCheck size={16} /> Hecho para jugar más</span></footer>
    </div>
  );
}
