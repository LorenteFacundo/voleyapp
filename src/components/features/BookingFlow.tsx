import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  Search,
  Volleyball,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useClubes } from '@/hooks/useClubes';
import { useCanchas } from '@/hooks/useCanchas';
import { useTurnos } from '@/hooks/useTurnos';
import { reservarTurnoRango, reservarTurnoVirtual, crearPartidoVirtual } from '@/lib/admin';
import { turnoKey } from '@/lib/booking';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { CanchaDetalle, ClubPublico, TurnoVirtual } from '@/types';
import { ScheduleBoard } from '@/components/features/ScheduleBoard';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

type BookingFlowProps = {
  open: boolean;
  initialClubId?: number | null;
  onClose: () => void;
  onRefresh: () => void;
};

export function BookingFlow({ open, initialClubId, onClose, onRefresh }: BookingFlowProps) {
  const { session } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState<ClubPublico | null>(null);
  const [selectedCancha, setSelectedCancha] = useState<CanchaDetalle | null>(null);
  const [selectedTurno, setSelectedTurno] = useState<TurnoVirtual | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [cupoMaximo, setCupoMaximo] = useState('18');
  const [invitados, setInvitados] = useState('0');
  const [nivelPartido, setNivelPartido] = useState('recreativo');
  const [requiereAprobacion, setRequiereAprobacion] = useState(false);

  const [horaInicioCustom, setHoraInicioCustom] = useState('');
  const [horaFinCustom, setHoraFinCustom] = useState('');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const selectedClubId = selectedClub?.id ?? null;
  const selectedCanchaId = selectedCancha?.id ?? null;

  const { clubes, loading: loadingClubes } = useClubes(open ? search : undefined);
  const { canchas, loading: loadingCanchas } = useCanchas(open ? selectedClubId : null);
  const { turnos, loading: loadingTurnos, refresh: refreshTurnos } = useTurnos(open ? selectedCanchaId : null, today);

  const initialClubLoadedRef = useRef(false);

  // Efecto para cargar club inicial desde el mapa
  useEffect(() => {
    if (open && initialClubId && !selectedClub && !initialClubLoadedRef.current) {
      initialClubLoadedRef.current = true;
      supabase
        .from('clubes_publicos')
        .select('*')
        .eq('id', initialClubId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) return;
          setSelectedClub(data as ClubPublico);
          setSelectedCancha(null);
          setSelectedTurno(null);
        });
    }
  }, [open, initialClubId, selectedClub]);

  // Efecto para limpiar estado cuando se cierra el modal
  useEffect(() => {
    if (!open && selectedClub) {
      setSearch('');
      setSelectedClub(null);
      setSelectedCancha(null);
      setSelectedTurno(null);
      setHoraInicioCustom('');
      setHoraFinCustom('');
      initialClubLoadedRef.current = false;
    }
  }, [open, selectedClub]);

  const horaInicio = useMemo(() => {
    if (selectedTurno && horaInicioCustom) {
      return horaInicioCustom;
    }
    return selectedTurno?.hora_inicio.slice(0, 5) ?? '';
  }, [selectedTurno, horaInicioCustom]);

  const horaFin = useMemo(() => {
    if (selectedTurno && horaFinCustom) {
      return horaFinCustom;
    }
    return selectedTurno?.hora_fin.slice(0, 5) ?? '';
  }, [selectedTurno, horaFinCustom]);

  const handleHoraInicioChange = useCallback((value: string) => {
    setHoraInicioCustom(value);
  }, []);

  const handleHoraFinChange = useCallback((value: string) => {
    setHoraFinCustom(value);
  }, []);

  const selectClub = useCallback((club: ClubPublico) => {
    setSelectedClub(club);
    setSelectedCancha(null);
    setSelectedTurno(null);
  }, []);

  const selectCancha = useCallback((cancha: CanchaDetalle) => {
    setSelectedCancha(cancha);
    setSelectedTurno(null);
  }, []);

  const goBack = useCallback(() => {
    if (selectedCancha) {
      setSelectedCancha(null);
      setSelectedTurno(null);
      return;
    }
    if (selectedClub) {
      setSelectedClub(null);
      return;
    }
    onClose();
  }, [selectedCancha, selectedClub, onClose]);

  const modalTitle = selectedCancha
    ? selectedCancha.titulo
    : selectedClub
      ? selectedClub.nombre
      : 'Alquilar cancha';

  const handleReservar = useCallback(async () => {
    if (!session) {
      toast.error('Inicia sesion para reservar una cancha.');
      return;
    }
    if (!selectedCancha || !selectedTurno) {
      toast.error('Elegi un horario disponible.');
      return;
    }
    if (horaFin <= horaInicio) {
      toast.error('La hora de fin debe ser mayor a la de inicio.');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedTurno.id === null) {
        await reservarTurnoVirtual({
          canchaId: selectedCancha.id,
          fecha: selectedTurno.fecha,
          horaInicio: horaInicio,
          horaFin: horaFin,
          precioTotal: selectedTurno.precio_total,
          precioSena: selectedTurno.precio_sena,
        });
      } else {
        await reservarTurnoRango({
          canchaId: selectedCancha.id,
          fecha: selectedTurno.fecha,
          horaInicio: horaInicio,
          horaFin: horaFin,
        });
      }
      toast.success(`Cancha reservada: ${formatDate(selectedTurno.fecha)} ${horaInicio}–${horaFin}`);
      await refreshTurnos();
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo reservar.');
    } finally {
      setSubmitting(false);
    }
  }, [session, selectedCancha, selectedTurno, horaFin, horaInicio, refreshTurnos, onRefresh]);

  const handleOrganizarPartido = useCallback(async (event: FormEvent) => {
    event.preventDefault();

    if (!session) {
      toast.error('Inicia sesion para organizar un partido.');
      return;
    }
    if (!selectedCancha || !selectedTurno) {
      toast.error('Elegi un horario disponible.');
      return;
    }
    if (horaFin <= horaInicio) {
      toast.error('La hora de fin debe ser mayor a la de inicio.');
      return;
    }

    const max = Number(cupoMaximo);
    const min = Math.min(12, max); // evitar error si cupoMaximo < 12

    setSubmitting(true);
    try {
      if (selectedTurno.id === null) {
        const partidoId = await crearPartidoVirtual({
          canchaId: selectedCancha.id,
          fecha: selectedTurno.fecha,
          horaInicio: horaInicio,
          horaFin: horaFin,
          precioTotal: selectedTurno.precio_total,
          precioSena: selectedTurno.precio_sena,
          cupoMinimo: min,
          cupoMaximo: max,
          invitados: Number(invitados),
          nivel: nivelPartido,
          requiereAprobacion: requiereAprobacion,
          visibilidad: 'publico',
        });
        toast.success(`Partido creado y publicado. ID: ${partidoId}`);
      } else {
        const turnoIdReservado = await reservarTurnoRango({
          canchaId: selectedCancha.id,
          fecha: selectedTurno.fecha,
          horaInicio: horaInicio,
          horaFin: horaFin,
          estadoFinal: 'disponible',
        });

        const { data, error } = await supabase.rpc('crear_partido', {
          p_turno_id: turnoIdReservado,
          p_cupo_minimo: min,
          p_cupo_maximo: max,
          p_invitados: Number(invitados),
          p_nivel: nivelPartido,
          p_requiere_aprobacion: requiereAprobacion,
          p_visibilidad: 'publico',
        });

        if (error) {
          throw new Error(error.message);
        }

        toast.success(`Partido creado y publicado. ID: ${data}`);
      }
      await refreshTurnos();
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el partido.');
    } finally {
      setSubmitting(false);
    }
  }, [session, selectedCancha, selectedTurno, horaFin, horaInicio, cupoMaximo, invitados, nivelPartido, requiereAprobacion, refreshTurnos, onRefresh]);

  return (
    <Modal open={open} onClose={onClose} title={modalTitle}>
      <div className="flex items-center gap-2 mb-4">
        {(selectedClub || selectedCancha) && (
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft size={16} />
            Volver
          </Button>
        )}
      </div>

      {!selectedClub ? (
        <StepSelectClub
          search={search}
          onSearchChange={setSearch}
          clubes={clubes}
          loading={loadingClubes}
          onSelect={selectClub}
        />
      ) : !selectedCancha ? (
        <StepSelectCancha
          club={selectedClub}
          canchas={canchas}
          loading={loadingCanchas}
          onSelect={selectCancha}
        />
      ) : (
        <StepSelectTurno
          cancha={selectedCancha}
          turnos={turnos}
          loadingTurnos={loadingTurnos}
          selectedTurno={selectedTurno}
          onSelectTurno={setSelectedTurno}
          horaInicio={horaInicio}
          horaFin={horaFin}
          onHoraInicioChange={handleHoraInicioChange}
          onHoraFinChange={handleHoraFinChange}
          submitting={submitting}
          onReservar={handleReservar}
          onOrganizarPartido={handleOrganizarPartido}
          cupoMaximo={cupoMaximo}
          onCupoMaximoChange={setCupoMaximo}
          invitados={invitados}
          onInvitadosChange={setInvitados}
          nivelPartido={nivelPartido}
          onNivelPartidoChange={setNivelPartido}
          requiereAprobacion={requiereAprobacion}
          onRequiereAprobacionChange={setRequiereAprobacion}
        />
      )}
    </Modal>
  );
}

function StepSelectClub({
  search,
  onSearchChange,
  clubes,
  loading,
  onSelect,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  clubes: ClubPublico[];
  loading: boolean;
  onSelect: (club: ClubPublico) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" size={18} />
        <Input
          autoFocus
          className="pl-10"
          placeholder="Buscar por nombre o direccion..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={64} rounded />
          ))}
        </div>
      ) : clubes.length === 0 ? (
        <p className="text-sm text-ink/60">No se encontraron clubes.</p>
      ) : (
        <ul className="grid gap-2">
          {clubes.map((club) => (
            <li key={club.id}>
              <Card hover padding="md" className="cursor-pointer" onClick={() => onSelect(club)}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-court/10 text-court">
                    <Building2 size={18} />
                  </span>
                  <div>
                    <h3 className="font-bold text-ink">{club.nombre}</h3>
                    {club.direccion && (
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-ink/60">
                        <MapPin size={14} />
                        {club.direccion}
                      </p>
                    )}
                    {club.telefono && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-ink/55">
                        <Phone size={14} />
                        {club.telefono}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepSelectCancha({
  club,
  canchas,
  loading,
  onSelect,
}: {
  club: ClubPublico;
  canchas: CanchaDetalle[];
  loading: boolean;
  onSelect: (cancha: CanchaDetalle) => void;
}) {
  return (
    <div className="grid gap-4">
      <Card padding="md">
        <h3 className="font-bold text-ink">{club.nombre}</h3>
        {club.direccion && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/65">
            <MapPin size={15} />
            {club.direccion}
          </p>
        )}
        {club.telefono && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/65">
            <Phone size={15} />
            {club.telefono}
          </p>
        )}
      </Card>

      <h3 className="text-sm font-bold uppercase tracking-wide text-ink/55">Canchas del club</h3>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={180} rounded />
          ))}
        </div>
      ) : canchas.length === 0 ? (
        <p className="text-sm text-ink/60">Este club todavia no tiene canchas publicadas.</p>
      ) : (
        <ul className="grid gap-3">
          {canchas.map((cancha) => (
            <li key={cancha.id}>
              <Card hover padding="none" className="cursor-pointer overflow-hidden" onClick={() => onSelect(cancha)}>
                {cancha.fotos[0] ? (
                  <img alt={cancha.titulo} className="h-36 w-full object-cover" src={cancha.fotos[0]} />
                ) : (
                  <div className="grid h-28 place-items-center bg-court/5 text-court">
                    <Volleyball size={32} />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-ink">{cancha.titulo}</h4>
                      {cancha.descripcion && (
                        <p className="mt-1 line-clamp-2 text-sm text-ink/60">{cancha.descripcion}</p>
                      )}
                    </div>
                    <Badge variant="court">{formatMoney(cancha.precio_total)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-ink/50">Sena {formatMoney(cancha.precio_sena)}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepSelectTurno({
  cancha,
  turnos,
  loadingTurnos,
  selectedTurno,
  onSelectTurno,
  horaInicio,
  horaFin,
  onHoraInicioChange,
  onHoraFinChange,
  submitting,
  onReservar,
  onOrganizarPartido,
  cupoMaximo,
  onCupoMaximoChange,
  invitados,
  onInvitadosChange,
  nivelPartido,
  onNivelPartidoChange,
  requiereAprobacion,
  onRequiereAprobacionChange,
}: {
  cancha: CanchaDetalle;
  turnos: TurnoVirtual[];
  loadingTurnos: boolean;
  selectedTurno: TurnoVirtual | null;
  onSelectTurno: (turno: TurnoVirtual) => void;
  horaInicio: string;
  horaFin: string;
  onHoraInicioChange: (v: string) => void;
  onHoraFinChange: (v: string) => void;
  submitting: boolean;
  onReservar: () => void;
  onOrganizarPartido: (e: FormEvent) => void;
  cupoMaximo: string;
  onCupoMaximoChange: (v: string) => void;
  invitados: string;
  onInvitadosChange: (v: string) => void;
  nivelPartido: string;
  onNivelPartidoChange: (v: string) => void;
  requiereAprobacion: boolean;
  onRequiereAprobacionChange: (v: boolean) => void;
}) {
  return (
    <div className="grid gap-5">
      {cancha.fotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cancha.fotos.map((foto) => (
            <img alt={cancha.titulo} className="h-40 w-56 shrink-0 rounded-md object-cover" key={foto} src={foto} />
          ))}
        </div>
      )}

      {cancha.descripcion && (
        <p className="text-sm text-ink/70">{cancha.descripcion}</p>
      )}

      {selectedTurno && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="font-bold text-ink">{formatMoney(selectedTurno.precio_total)} total</span>
          <span className="text-ink/60">Sena {formatMoney(selectedTurno.precio_sena)}</span>
        </div>
      )}

      <div>
        <h3 className="mb-3 flex items-center gap-2 font-bold text-ink">
          <CalendarDays size={18} />
          Horarios
        </h3>
        {loadingTurnos ? (
          <div className="grid gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={48} rounded />
            ))}
          </div>
        ) : (
          <ScheduleBoard
            selectedTurnoKey={selectedTurno ? turnoKey(selectedTurno) : null}
            turnos={turnos}
            onSelect={onSelectTurno}
          />
        )}
      </div>

      {selectedTurno && (
        <Card padding="md" className="border-court/20 bg-court/5">
          <p className="text-sm font-semibold text-ink">
            Seleccionado: {formatDate(selectedTurno.fecha)} (Bloque de {formatTime(selectedTurno.hora_inicio)} a {formatTime(selectedTurno.hora_fin)})
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-ink/70">
                Desde:
                <input
                  className="ml-2 rounded-md border border-ink/20 px-2 py-1 focus:border-court focus:outline-none"
                  max={selectedTurno.hora_fin.slice(0, 5)}
                  min={selectedTurno.hora_inicio.slice(0, 5)}
                  type="time"
                  value={horaInicio}
                  onChange={(e) => onHoraInicioChange(e.target.value)}
                />
              </label>
              <label className="text-sm text-ink/70">
                Hasta:
                <input
                  className="ml-2 rounded-md border border-ink/20 px-2 py-1 focus:border-court focus:outline-none"
                  max={selectedTurno.hora_fin.slice(0, 5)}
                  min={selectedTurno.hora_inicio.slice(0, 5)}
                  type="time"
                  value={horaFin}
                  onChange={(e) => onHoraFinChange(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={onReservar} loading={submitting} fullWidth>
              <Clock3 size={16} />
              Alquilar cancha
            </Button>
          </div>

          <form className="mt-4 grid gap-3 border-t border-court/15 pt-4" onSubmit={onOrganizarPartido}>
            <p className="text-sm font-bold text-ink">O organizar un partido en este horario</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Cupo max."
                type="number"
                min="12"
                max="22"
                value={cupoMaximo}
                onChange={(e) => onCupoMaximoChange(e.target.value)}
              />
              <Input
                label="Invitados"
                type="number"
                min="0"
                value={invitados}
                onChange={(e) => onInvitadosChange(e.target.value)}
              />
            </div>
            <label className="block text-xs font-semibold text-ink">
              Nivel
              <select
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 focus:ring-2 focus:ring-court/40 focus:outline-none transition"
                value={nivelPartido}
                onChange={(e) => onNivelPartidoChange(e.target.value)}
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
                onChange={(e) => onRequiereAprobacionChange(e.target.checked)}
              />
              Requiere aprobacion
            </label>
            <Button variant="secondary" type="submit" loading={submitting} fullWidth>
              Organizar partido
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
