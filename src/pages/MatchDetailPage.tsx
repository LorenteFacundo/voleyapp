import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Users,
  MapPin,
  Shield,
  UserCheck,
  UserPlus,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePartidoDetalle } from '@/hooks/usePartidoDetalle';
import { unirseAPartido, salirseDePartido } from '@/lib/booking';
import { formatDate, formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const partidoId = id && !isNaN(Number(id)) ? Number(id) : null;
  const { partido, loading, error, refresh } = usePartidoDetalle(partidoId);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function handleJoin() {
    if (!session) {
      toast.error('Inicia sesión para unirte al partido');
      return;
    }

    if (!partido) return;

    setJoining(true);
    try {
      await unirseAPartido(partido.id);
      toast.success(
        partido.requiere_aprobacion
          ? 'Solicitud enviada. El organizador debe aprobarla.'
          : 'Te uniste al partido'
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al unirse');
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!session || !partido) return;

    setLeaving(true);
    try {
      await salirseDePartido(partido.id);
      toast.success('Saliste del partido');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al salir');
    } finally {
      setLeaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton height={400} rounded />
      </div>
    );
  }

  if (error || !partido) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          Volver
        </Button>
        <Card padding="lg" className="mt-4">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle size={24} />
            <p>{error || 'Partido no encontrado'}</p>
          </div>
        </Card>
      </div>
    );
  }

  const cupoDisponible = partido.jugadores_confirmados < partido.cupo_maximo;
  const yaInscripto = partido.mi_estado_inscripcion != null;
  const esOrganizador = session?.user?.id === partido.organizador_id;
  const partidoAbierto = partido.estado_partido === 'abierto' || partido.estado_partido === 'confirmado';
  const puedeUnirse = session && cupoDisponible && !yaInscripto && partidoAbierto;
  const puedeSalirse = session && yaInscripto && !esOrganizador;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate('/')}>
        <ArrowLeft size={16} />
        Volver
      </Button>

      <div className="mt-4 grid gap-6">
        <Card padding="lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-ink">{partido.club_nombre}</h1>
              <p className="mt-1 text-ink/60">{partido.cancha_nombre}</p>
              {partido.direccion && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/60">
                  <MapPin size={14} />
                  {partido.direccion}
                </p>
              )}
            </div>
            <Badge variant="court">{partido.nivel_requerido}</Badge>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 text-ink/70">
              <CalendarDays size={20} />
              <div>
                <p className="text-sm text-ink/50">Fecha</p>
                <p className="font-semibold">{formatDate(partido.fecha)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-ink/70">
              <Clock3 size={20} />
              <div>
                <p className="text-sm text-ink/50">Horario</p>
                <p className="font-semibold">
                  {partido.hora_inicio.slice(0, 5)} - {partido.hora_fin.slice(0, 5)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-ink/70">
              <Users size={20} />
              <div>
                <p className="text-sm text-ink/50">Jugadores</p>
                <p className="font-semibold">
                  {partido.jugadores_confirmados}/{partido.cupo_maximo}
                  {partido.cupo_minimo > 0 && (
                    <span className="ml-1 text-sm text-ink/50">
                      (mín. {partido.cupo_minimo})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-ink/70">
              <Shield size={20} />
              <div>
                <p className="text-sm text-ink/50">Precio</p>
                <p className="font-semibold">{formatMoney(partido.precio_total)}</p>
              </div>
            </div>
          </div>

          {partido.requiere_aprobacion && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-sand/10 px-3 py-2 text-sm text-ink/70">
              <AlertCircle size={16} />
              <span>Este partido requiere aprobación del organizador</span>
            </div>
          )}

          <div className="mt-6 grid gap-3">
            {yaInscripto ? (
              <Button variant="secondary" disabled fullWidth>
                <UserCheck size={16} />
                {partido.mi_estado_inscripcion === 'pendiente_aprobacion'
                  ? 'Solicitud pendiente'
                  : 'Ya estás inscrito'}
              </Button>
            ) : puedeUnirse ? (
              <Button onClick={handleJoin} loading={joining} fullWidth>
                <UserPlus size={16} />
                Unirse al partido
              </Button>
            ) : !session ? (
              <Button variant="secondary" disabled fullWidth>
                Inicia sesión para unirte
              </Button>
            ) : (
              <Button variant="secondary" disabled fullWidth>
                {partidoAbierto ? 'Partido lleno' : 'Partido cerrado'}
              </Button>
            )}

            {puedeSalirse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLeave}
                loading={leaving}
                fullWidth
              >
                <LogOut size={16} />
                Salir del partido
              </Button>
            )}
          </div>
        </Card>

        {partido.participantes && partido.participantes.length > 0 && (
          <Card padding="lg">
            <h2 className="mb-4 text-lg font-bold text-ink">
              Jugadores inscritos ({partido.jugadores_confirmados})
            </h2>
            <div className="grid gap-2">
              {partido.participantes.map((p) => (
                <div
                  key={p.usuario_id}
                  className="flex items-center justify-between rounded-md border border-ink/10 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="grid size-8 place-items-center rounded-full bg-court/10 text-court">
                      <Users size={14} />
                    </div>
                    <span className="font-medium text-ink">
                      {p.nombre || 'Jugador'}
                    </span>
                  </div>
                  <Badge
                    variant={
                      p.estado_inscripcion === 'confirmado' ? 'success' : 'warning'
                    }
                  >
                    {p.estado_inscripcion === 'confirmado'
                      ? 'Confirmado'
                      : 'Pendiente'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {partido.latitud && partido.longitud && (
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-ink/10 px-4 py-3">
              <h2 className="font-bold text-ink">Ubicación</h2>
            </div>
            <div className="h-64">
              <MapContainer
                center={[partido.latitud, partido.longitud]}
                zoom={15}
                scrollWheelZoom={false}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[partido.latitud, partido.longitud]}>
                  <Popup>{partido.club_nombre}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
