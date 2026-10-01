import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  Volleyball,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCanchaDetalle } from '@/hooks/useCanchaDetalle';
import { useTurnos } from '@/hooks/useTurnos';
import { turnoKey } from '@/lib/booking';
import { solicitarReserva, solicitarPartido } from '@/lib/pilot';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { ScheduleBoard } from '@/components/features/ScheduleBoard';
import type { TurnoVirtual } from '@/types';
import { preservePostAuthRoute } from '@/lib/navigation';
import { pilotBookingsEnabled } from '@/lib/pilot';
import { todayArgentinaISO } from '@/lib/date';

export function CanchaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const canchaId = id && !isNaN(Number(id)) ? Number(id) : null;
  const { cancha, loading, error } = useCanchaDetalle(canchaId);

  const today = todayArgentinaISO();
  const { turnos, loading: loadingTurnos, refresh: refreshTurnos } = useTurnos(canchaId, today);

  const [selectedTurno, setSelectedTurno] = useState<TurnoVirtual | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Organizar partido form
  const [showForm, setShowForm] = useState(false);
  const [cupoMaximo, setCupoMaximo] = useState('18');
  const [invitados, setInvitados] = useState('0');
  const [nivelPartido, setNivelPartido] = useState('recreativo');
  const [requiereAprobacion, setRequiereAprobacion] = useState(false);
  const [resumeIntent, setResumeIntent] = useState<string | null>(null);
  const restoredAction = useRef(false);

  useEffect(() => {
    if (loadingTurnos || restoredAction.current) return;
    const intent = searchParams.get('continuar');
    if (!intent) return;
    restoredAction.current = true;
    const fecha = searchParams.get('fecha');
    const inicio = searchParams.get('inicio');
    const fin = searchParams.get('fin');
    const slot = turnos.find((turno) => turno.estado === 'disponible' && turno.fecha === fecha &&
      turno.hora_inicio.slice(0, 5) === inicio && turno.hora_fin.slice(0, 5) === fin);
    if (slot && inicio && fin && ['reservar', 'organizar'].includes(intent)) {
      setSelectedTurno(slot);
      setResumeIntent(intent);
      setShowForm(intent === 'organizar');
    } else {
      toast.error('Ese horario ya no está disponible. Elegí uno actualizado para continuar.');
    }
    const cleanParams = new URLSearchParams(searchParams);
    ['continuar', 'fecha', 'inicio', 'fin'].forEach((key) => cleanParams.delete(key));
    setSearchParams(cleanParams, { replace: true });
  }, [loadingTurnos, searchParams, setSearchParams, turnos]);

  const horaInicio = selectedTurno?.hora_inicio.slice(0, 5) ?? '';
  const horaFin = selectedTurno?.hora_fin.slice(0, 5) ?? '';

  function handleSelectTurno(turno: TurnoVirtual) {
    setSelectedTurno(turno);
    setShowForm(false);
  }

  async function handleReservar() {
    if (!session) {
      if (cancha && selectedTurno && pilotBookingsEnabled) {
        const params = new URLSearchParams({ continuar: 'reservar', fecha: selectedTurno.fecha, inicio: horaInicio, fin: horaFin });
        preservePostAuthRoute(`/cancha/${cancha.id}?${params.toString()}`);
        navigate('/perfil');
      }
      return;
    }
    if (!cancha || !selectedTurno) return;
    if (horaFin <= horaInicio) {
      toast.error('La hora de fin debe ser mayor a la de inicio.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await solicitarReserva(cancha.id, selectedTurno, horaInicio, horaFin);
      toast.success(result.pending ? `Solicitud enviada para ${formatDate(selectedTurno.fecha)} ${horaInicio}–${horaFin}. El club debe confirmarla.` : `Cancha reservada: ${formatDate(selectedTurno.fecha)} ${horaInicio}–${horaFin}`);
      await refreshTurnos();
      setSelectedTurno(null);
      setResumeIntent(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo reservar.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOrganizarPartido() {
    if (!session) {
      if (cancha && selectedTurno && pilotBookingsEnabled) {
        const params = new URLSearchParams({ continuar: 'organizar', fecha: selectedTurno.fecha, inicio: horaInicio, fin: horaFin });
        preservePostAuthRoute(`/cancha/${cancha.id}?${params.toString()}`);
        navigate('/perfil');
      }
      return;
    }
    if (!cancha || !selectedTurno) return;
    if (horaFin <= horaInicio) {
      toast.error('La hora de fin debe ser mayor a la de inicio.');
      return;
    }

    const max = Number(cupoMaximo);
    const min = Math.min(12, max);

    setSubmitting(true);
    try {
      const result = await solicitarPartido(cancha.id, selectedTurno, horaInicio, horaFin,
        min, max, Number(invitados), nivelPartido, requiereAprobacion);
      toast.success(result.pending ? 'Solicitud enviada. El partido se publicará cuando el club confirme la cancha.' : 'Partido creado.');
      await refreshTurnos();
      setSelectedTurno(null);
      setShowForm(false);
      setResumeIntent(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el partido.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton height={400} rounded />
      </div>
    );
  }

  if (error || !cancha) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/canchas')}>
          <ArrowLeft size={16} />
          Volver
        </Button>
        <Card padding="lg" className="mt-4">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle size={24} />
            <p>{error || 'Cancha no encontrada'}</p>
          </div>
        </Card>
      </div>
    );
  }

  const club = cancha.clubes;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Button variant="ghost" onClick={() => navigate('/canchas')}>
        <ArrowLeft size={16} />
        Volver
      </Button>

      <div className="mt-4 grid gap-6">
        {/* Photos */}
        {cancha.fotos.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cancha.fotos.map((foto) => (
              <img
                key={foto}
                alt={cancha.titulo}
                className="h-56 w-80 shrink-0 rounded-xl object-cover shadow-soft"
                src={foto}
              />
            ))}
          </div>
        )}

        {/* Court info */}
        <Card padding="lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-ink">{cancha.titulo}</h1>
              <p className="mt-1 text-ink/60">{cancha.nombre_identificador}</p>
            </div>
            <Badge variant="court">{formatMoney(cancha.precio_total)}</Badge>
          </div>

          {cancha.descripcion && (
            <p className="mt-4 text-ink/70">{cancha.descripcion}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink/60">
            <span className="font-bold text-ink">{formatMoney(cancha.precio_total)} total</span>
            <span>Seña {formatMoney(cancha.precio_sena)}</span>
          </div>
        </Card>

        {/* Club info */}
        {club && (
          <Card padding="lg">
            <h2 className="text-lg font-bold text-ink">{club.nombre}</h2>
            <div className="mt-3 grid gap-2 text-sm text-ink/70">
              {club.direccion && (
                <p className="flex items-center gap-2">
                  <MapPin size={16} className="text-court" />
                  {club.direccion}
                </p>
              )}
              {club.telefono && (
                <p className="flex items-center gap-2">
                  <Phone size={16} className="text-court" />
                  {club.telefono}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Map */}
        {club?.latitud && club?.longitud && (
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-ink/10 px-4 py-3">
              <h2 className="font-bold text-ink">Ubicación</h2>
            </div>
            <div className="h-64">
              <MapContainer
                center={[club.latitud, club.longitud]}
                zoom={15}
                scrollWheelZoom={false}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[club.latitud, club.longitud]}>
                  <Popup>{club.nombre}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </Card>
        )}

        {/* Turnos */}
        <Card padding="lg">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink">
            <CalendarDays size={20} />
            Horarios disponibles
          </h2>
          {!pilotBookingsEnabled && <p role="status" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Las nuevas solicitudes están pausadas durante la preparación del piloto.</p>}

          {loadingTurnos ? (
            <div className="grid gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height={48} rounded />
              ))}
            </div>
          ) : turnos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Clock3 size={32} className="text-ink/30" />
              <p className="text-ink/60">No hay horarios disponibles para esta cancha.</p>
            </div>
          ) : (
            <ScheduleBoard
              selectedTurnoKey={selectedTurno ? turnoKey(selectedTurno) : null}
              turnos={turnos}
              onSelect={handleSelectTurno}
            />
          )}
        </Card>

        {/* Selected turno actions */}
        {selectedTurno && (
          <Card padding="lg" className="border-court/20 bg-court/5">
            <p className="text-sm font-semibold text-ink">
              Seleccionado: {formatDate(selectedTurno.fecha)} ({formatTime(selectedTurno.hora_inicio)} – {formatTime(selectedTurno.hora_fin)})
            </p>

            <p className="mt-2 text-sm text-ink/70">
              Horario publicado: {horaInicio}–{horaFin}
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <Button onClick={handleReservar} loading={submitting} disabled={!pilotBookingsEnabled} fullWidth>
                <Clock3 size={16} />
                {resumeIntent === 'reservar' ? 'Confirmar solicitud' : 'Alquilar cancha'}
              </Button>

              <Button variant="secondary" disabled={!pilotBookingsEnabled} onClick={() => setShowForm(!showForm)} fullWidth>
                <Volleyball size={16} />
                {resumeIntent === 'organizar' ? 'Continuar organización' : 'Organizar partido'}
              </Button>
            </div>

            {showForm && (
              <form
                className="mt-4 grid gap-3 border-t border-court/15 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleOrganizarPartido();
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Cupo máx."
                    type="number"
                    min="12"
                    max="22"
                    value={cupoMaximo}
                    onChange={(e) => setCupoMaximo(e.target.value)}
                  />
                  <Input
                    label="Invitados"
                    type="number"
                    min="0"
                    value={invitados}
                    onChange={(e) => setInvitados(e.target.value)}
                  />
                </div>
                <label className="block text-xs font-semibold text-ink">
                  Nivel
                  <select
                    className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 focus:ring-2 focus:ring-court/40 focus:outline-none transition"
                    value={nivelPartido}
                    onChange={(e) => setNivelPartido(e.target.value)}
                  >
                    <option value="recreativo">Recreativo</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="competitivo">Competitivo</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={requiereAprobacion}
                    onChange={(e) => setRequiereAprobacion(e.target.checked)}
                  />
                  Requiere aprobación
                </label>
                <Button variant="blue" type="submit" loading={submitting} fullWidth>
                  Crear partido
                </Button>
              </form>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
