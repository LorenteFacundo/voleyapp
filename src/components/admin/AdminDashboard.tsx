import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Building2, Volleyball, CalendarClock, CreditCard, Trophy, Users, Mail, UserRoundCog, ShieldCheck } from 'lucide-react';
import { ClubLeads } from './ClubLeads';
import { ClubManagers } from './ClubManagers';
import { PilotAccess } from './PilotAccess';
import { pilotBookingsEnabled } from '@/lib/pilot';
import {
  adminListarClubes,
  adminListarCanchas,
  adminListarTurnos,
  adminListarReservas,
  adminListarPartidos,
  adminListarUsuarios,
} from '@/lib/admin';
import type { ClubAdmin, CanchaAdmin, TurnoAdmin, ReservaAdmin, PartidoAdmin, UsuarioAdmin } from '@/types';
import { Button } from '@/components/ui/Button';
import { ClubesTable } from './ClubesTable';
import { CanchasTable } from './CanchasTable';
import { TurnosTable } from './TurnosTable';
import { ReservasTable } from './ReservasTable';
import { PartidosTable } from './PartidosTable';
import { UsuariosTable } from './UsuariosTable';

type Tab = 'clubes' | 'canchas' | 'turnos' | 'reservas' | 'partidos' | 'usuarios' | 'interesados' | 'administradores' | 'accesos';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'clubes', label: 'Clubes', icon: <Building2 size={16} /> },
  { id: 'canchas', label: 'Canchas', icon: <Volleyball size={16} /> },
  { id: 'turnos', label: 'Turnos', icon: <CalendarClock size={16} /> },
  { id: 'reservas', label: 'Reservas', icon: <CreditCard size={16} /> },
  { id: 'partidos', label: 'Partidos', icon: <Trophy size={16} /> },
  { id: 'usuarios', label: 'Usuarios', icon: <Users size={16} /> },
  ...(pilotBookingsEnabled ? [{ id: 'administradores' as const, label: 'Acceso a clubes', icon: <UserRoundCog size={16} /> }] : []),
  ...(pilotBookingsEnabled ? [{ id: 'accesos' as const, label: 'Acceso al piloto', icon: <ShieldCheck size={16} /> }] : []),
  ...(import.meta.env.VITE_CLUB_LEADS_ENABLED === 'true' ? [{ id: 'interesados' as const, label: 'Interesados', icon: <Mail size={16} /> }] : []),
];

type AdminDashboardProps = {
  onBack: () => void;
};

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('clubes');

  const [clubes, setClubes] = useState<ClubAdmin[]>([]);
  const [canchas, setCanchas] = useState<CanchaAdmin[]>([]);
  const [turnos, setTurnos] = useState<TurnoAdmin[]>([]);
  const [reservas, setReservas] = useState<ReservaAdmin[]>([]);
  const [partidos, setPartidos] = useState<PartidoAdmin[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);

  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      switch (tab) {
        case 'clubes':
          setClubes(await adminListarClubes());
          break;
        case 'canchas':
          setCanchas(await adminListarCanchas());
          break;
        case 'turnos':
          setTurnos(await adminListarTurnos());
          break;
        case 'reservas':
          setReservas(await adminListarReservas());
          break;
        case 'partidos':
          setPartidos(await adminListarPartidos());
          break;
        case 'usuarios':
          setUsuarios(await adminListarUsuarios());
          break;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={16} />
          Volver
        </Button>
        <h1 className="text-xl font-bold text-ink">Panel de administración</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-ink/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 shrink-0 px-4 py-2.5 text-sm font-semibold transition border-b-2 ${
              tab === t.id
                ? 'border-vb-blue text-vb-blue'
                : 'border-transparent text-ink/50 hover:text-ink/80'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === 'clubes' && <ClubesTable clubes={clubes} loading={loading} onRefresh={fetchData} />}
        {tab === 'canchas' && <CanchasTable canchas={canchas} loading={loading} onRefresh={fetchData} />}
        {tab === 'turnos' && <TurnosTable turnos={turnos} loading={loading} />}
        {tab === 'reservas' && <ReservasTable reservas={reservas} loading={loading} />}
        {tab === 'partidos' && <PartidosTable partidos={partidos} loading={loading} onRefresh={fetchData} />}
        {tab === 'usuarios' && <UsuariosTable usuarios={usuarios} loading={loading} onRefresh={fetchData} />}
        {tab === 'interesados' && <ClubLeads />}
        {tab === 'administradores' && <ClubManagers />}
        {tab === 'accesos' && <PilotAccess />}
      </div>
    </div>
  );
}
