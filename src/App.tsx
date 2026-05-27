import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Volleyball,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AdminPanel } from './components/AdminPanel';
import { BookingFlow } from './components/BookingFlow';
import { MapClubMarkers } from './components/MapClubMarkers';
import { formatDate, formatMoney } from './lib/format';
import { isAdminGlobal } from './lib/roles';
import { supabase } from './lib/supabase';
import type { ClubPublico, PartidoPublico, Perfil } from './types';

const buenosAires: [number, number] = [-34.6037, -58.3816];

function MapFocus({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [partidos, setPartidos] = useState<PartidoPublico[]>([]);
  const [clubes, setClubes] = useState<ClubPublico[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingClubId, setBookingClubId] = useState<number | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [nivel, setNivel] = useState('5');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [userCenter, setUserCenter] = useState<[number, number]>(buenosAires);
  const [view, setView] = useState<'home' | 'admin'>('home');

  const canManageCatalog = isAdminGlobal(perfil?.rol);

  const clubesConUbicacion = useMemo(
    () => clubes.filter((club) => club.latitud != null && club.longitud != null),
    [clubes],
  );
  const mapCenter = clubesConUbicacion[0]?.latitud && clubesConUbicacion[0]?.longitud
    ? [clubesConUbicacion[0].latitud, clubesConUbicacion[0].longitud] as [number, number]
    : userCenter;

  function openBooking(clubId?: number) {
    setBookingClubId(clubId ?? null);
    setBookingOpen(true);
  }

  function closeBooking() {
    setBookingOpen(false);
    setBookingClubId(null);
  }

  async function loadData(currentSession = session) {
    setLoading(true);
    setMessage(null);

    const [partidosResult, clubesResult] = await Promise.all([
      currentSession
        ? supabase
            .from('partidos_publicos')
            .select('*')
            .order('fecha', { ascending: true })
            .order('hora_inicio', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('clubes_publicos').select('*').order('nombre', { ascending: true }),
    ]);

    if (partidosResult.error) {
      setMessage(partidosResult.error.message);
    } else {
      setPartidos((partidosResult.data ?? []) as PartidoPublico[]);
    }

    if (clubesResult.error) {
      setMessage(clubesResult.error.message);
    } else {
      setClubes((clubesResult.data ?? []) as ClubPublico[]);
    }

    if (currentSession?.user.id) {
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', currentSession.user.id)
        .maybeSingle();
      setPerfil(data as Perfil | null);
    } else {
      setPerfil(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadData(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadData(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (position) => setUserCenter([position.coords.latitude, position.coords.longitude]),
      () => setUserCenter(buenosAires),
      { enableHighAccuracy: true, timeout: 6000 },
    );
  }, []);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const result =
      authMode === 'registro'
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                nombre_completo: nombre,
                nivel_voley: Number(nivel),
              },
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setPassword('');
    setMessage(authMode === 'registro' ? 'Cuenta creada. Revisa tu email si Supabase pide confirmacion.' : 'Sesion iniciada.');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (view === 'admin' && canManageCatalog) {
    return (
      <main className="app-shell">
        <AdminPanel onBack={() => setView('home')} onCreated={() => void loadData()} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="border-b border-ink/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-md bg-court text-white">
              <Volleyball size={24} />
            </span>
            <div>
              <h1 className="text-xl font-black tracking-normal text-ink">VoleyApp</h1>
              <p className="text-sm text-ink/65">Canchas, turnos y partidos cerca tuyo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn-primary" onClick={() => openBooking()} type="button">
              <Search size={17} />
              Alquilar cancha
            </button>
            {canManageCatalog ? (
              <button className="btn-secondary" onClick={() => setView('admin')} type="button">
                <Settings2 size={17} />
                Admin
              </button>
            ) : null}
            <button className="btn-secondary" onClick={() => loadData()} type="button">
              <RefreshCw size={17} />
              Actualizar
            </button>
            {session ? (
              <button className="btn-primary" onClick={handleSignOut} type="button">
                <LogOut size={17} />
                Salir
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="grid gap-5">
          <div className="panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-ink/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Mapa de clubes</h2>
                <p className="text-sm text-ink/60">Los puntos aparecen cuando hay sedes con ubicacion cargada.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-md bg-sand/20 px-3 py-2 text-sm font-semibold text-ink">
                <MapPin size={16} />
                {clubesConUbicacion.length} sedes activas
              </span>
            </div>

            <div className="h-[430px]">
              <MapContainer center={mapCenter} zoom={12} scrollWheelZoom className="h-full">
                <MapFocus center={mapCenter} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClubMarkers clubes={clubesConUbicacion} onSelectClub={(id) => openBooking(id)} />
              </MapContainer>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Partidos abiertos</h2>
              <span className="text-sm text-ink/60">{loading ? 'Cargando...' : `${partidos.length} publicados`}</span>
            </div>

            {!session ? (
              <div className="panel p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 text-court" size={22} />
                  <div>
                    <h3 className="font-bold text-ink">Inicia sesion para ver y crear partidos</h3>
                    <p className="mt-1 text-sm text-ink/65">
                      Las canchas y turnos se pueden explorar, pero los partidos usan tu usuario para cuidar reservas e inscripciones.
                    </p>
                  </div>
                </div>
              </div>
            ) : partidos.length === 0 ? (
              <div className="panel p-5 text-sm text-ink/65">
                Todavia no hay partidos publicados. Cuando cargues turnos disponibles, podes crear el primero desde el panel lateral.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {partidos.map((partido) => (
                  <article className="panel p-4" key={partido.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-ink">{partido.club_nombre}</h3>
                        <p className="text-sm text-ink/60">{partido.cancha_nombre}</p>
                      </div>
                      <span className="rounded-md bg-court/10 px-2.5 py-1 text-xs font-bold uppercase text-court">
                        {partido.nivel_requerido}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <span className="flex items-center gap-2 text-ink/70">
                        <CalendarDays size={16} />
                        {formatDate(partido.fecha)}
                      </span>
                      <span className="flex items-center gap-2 text-ink/70">
                        <Clock3 size={16} />
                        {partido.hora_inicio.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-2 text-ink/70">
                        <Users size={16} />
                        {partido.jugadores_confirmados}/{partido.cupo_maximo}
                      </span>
                      <span className="font-semibold text-ink">{formatMoney(partido.precio_total)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <section className="panel p-4">
            {session ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-md bg-court/10 text-court">
                    <CheckCircle2 size={21} />
                  </span>
                  <div>
                    <h2 className="font-bold text-ink">{perfil?.nombre_completo ?? session.user.email}</h2>
                    <p className="text-sm text-ink/60">
                      Nivel {perfil?.nivel_voley ?? '-'} · {perfil?.rol ?? 'jugador'}
                    </p>
                    {canManageCatalog ? (
                      <button className="btn-secondary mt-2 w-full" onClick={() => setView('admin')} type="button">
                        <Settings2 size={16} />
                        Gestionar canchas
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={handleAuth}>
                <div className="flex rounded-md bg-ink/5 p-1">
                  <button
                    className={`flex-1 rounded px-3 py-2 text-sm font-semibold ${authMode === 'login' ? 'bg-white text-ink shadow-sm' : 'text-ink/60'}`}
                    onClick={() => setAuthMode('login')}
                    type="button"
                  >
                    Entrar
                  </button>
                  <button
                    className={`flex-1 rounded px-3 py-2 text-sm font-semibold ${authMode === 'registro' ? 'bg-white text-ink shadow-sm' : 'text-ink/60'}`}
                    onClick={() => setAuthMode('registro')}
                    type="button"
                  >
                    Registro
                  </button>
                </div>

                {authMode === 'registro' ? (
                  <>
                    <label className="block text-sm font-semibold text-ink">
                      Nombre
                      <input className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2" value={nombre} onChange={(event) => setNombre(event.target.value)} />
                    </label>
                    <label className="block text-sm font-semibold text-ink">
                      Nivel de voley
                      <input className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2" max="10" min="1" type="number" value={nivel} onChange={(event) => setNivel(event.target.value)} />
                    </label>
                  </>
                ) : null}

                <label className="block text-sm font-semibold text-ink">
                  Email
                  <input className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label className="block text-sm font-semibold text-ink">
                  Contraseña
                  <input className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2" minLength={6} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
                <button className="btn-primary w-full" type="submit">
                  <LogIn size={17} />
                  {authMode === 'registro' ? 'Crear cuenta' : 'Iniciar sesion'}
                </button>
              </form>
            )}
          </section>

          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-ink">Reservar cancha</h2>
              <Plus size={20} className="text-court" />
            </div>
            <p className="text-sm text-ink/65">
              Busca un club, elegi la cancha y mira todos los horarios disponibles u ocupados antes de reservar.
            </p>
            <button className="btn-primary mt-4 w-full" onClick={() => openBooking()} type="button">
              <Search size={17} />
              Buscar y alquilar
            </button>
          </section>

          {message ? (
            <div className="rounded-md border border-sand/40 bg-sand/15 p-3 text-sm font-medium text-ink">
              {message}
            </div>
          ) : null}
        </aside>
      </div>

      <BookingFlow
        initialClubId={bookingClubId}
        open={bookingOpen}
        session={session}
        onClose={closeBooking}
        onMessage={setMessage}
        onRefresh={() => void loadData()}
      />
    </main>
  );
}
