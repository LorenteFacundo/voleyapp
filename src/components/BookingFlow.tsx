import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  Phone,
  Search,
  Volleyball,
  X,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { fetchCanchasByClub, fetchClubes, fetchTurnosCancha } from '../lib/booking';
import { reservarTurnoRango } from '../lib/admin';
import { formatDate, formatMoney, formatTime } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { CanchaDetalle, ClubPublico, Turno } from '../types';
import { ScheduleBoard } from './ScheduleBoard';

type BookingFlowProps = {
  open: boolean;
  initialClubId?: number | null;
  session: Session | null;
  onClose: () => void;
  onRefresh: () => void;
  onMessage: (message: string) => void;
};

export function BookingFlow({ open, initialClubId, session, onClose, onRefresh, onMessage }: BookingFlowProps) {
  const [search, setSearch] = useState('');
  const [clubes, setClubes] = useState<ClubPublico[]>([]);
  const [loadingClubes, setLoadingClubes] = useState(false);
  const [selectedClub, setSelectedClub] = useState<ClubPublico | null>(null);
  const [canchas, setCanchas] = useState<CanchaDetalle[]>([]);
  const [selectedCancha, setSelectedCancha] = useState<CanchaDetalle | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cupoMaximo, setCupoMaximo] = useState('18');
  const [invitados, setInvitados] = useState('0');
  const [nivelPartido, setNivelPartido] = useState('recreativo');
  const [requiereAprobacion, setRequiereAprobacion] = useState(false);
  const [horaInicioPersonalizada, setHoraInicioPersonalizada] = useState('');
  const [horaFinPersonalizada, setHoraFinPersonalizada] = useState('');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (selectedTurno) {
      setHoraInicioPersonalizada(selectedTurno.hora_inicio.slice(0, 5));
      setHoraFinPersonalizada(selectedTurno.hora_fin.slice(0, 5));
    }
  }, [selectedTurno]);

  useEffect(() => {
    if (open) {
      return;
    }

    setSearch('');
    setClubes([]);
    setSelectedClub(null);
    setCanchas([]);
    setSelectedCancha(null);
    setTurnos([]);
    setSelectedTurno(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLoadingClubes(true);
    fetchClubes(search)
      .then(setClubes)
      .catch((error) => onMessage(error instanceof Error ? error.message : 'Error al buscar clubes'))
      .finally(() => setLoadingClubes(false));
  }, [open, search, onMessage]);

  useEffect(() => {
    if (!open || !initialClubId) {
      return;
    }

    supabase
      .from('clubes_publicos')
      .select('*')
      .eq('id', initialClubId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          onMessage(error.message);
          return;
        }
        if (data) {
          void selectClub(data as ClubPublico);
        }
      });
  }, [open, initialClubId]);

  async function selectClub(club: ClubPublico) {
    setSelectedClub(club);
    setSelectedCancha(null);
    setSelectedTurno(null);
    setTurnos([]);
    setLoadingDetail(true);

    try {
      const data = await fetchCanchasByClub(club.id);
      setCanchas(data);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'No se pudieron cargar las canchas');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function selectCancha(cancha: CanchaDetalle) {
    setSelectedCancha(cancha);
    setSelectedTurno(null);
    setLoadingDetail(true);

    try {
      const data = await fetchTurnosCancha(cancha.id, today);
      setTurnos(data);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'No se pudieron cargar los horarios');
    } finally {
      setLoadingDetail(false);
    }
  }

  function goBack() {
    if (selectedCancha) {
      setSelectedCancha(null);
      setSelectedTurno(null);
      setTurnos([]);
      return;
    }
    if (selectedClub) {
      setSelectedClub(null);
      setCanchas([]);
      return;
    }
    onClose();
  }

  async function handleReservar() {
    if (!session) {
      onMessage('Inicia sesion para reservar una cancha.');
      return;
    }
    if (!selectedCancha || !selectedTurno) {
      onMessage('Elegi un horario disponible.');
      return;
    }
    if (horaFinPersonalizada <= horaInicioPersonalizada) {
      onMessage('La hora de fin debe ser mayor a la de inicio.');
      return;
    }

    setSubmitting(true);
    try {
      await reservarTurnoRango({
        canchaId: selectedCancha.id,
        fecha: selectedTurno.fecha,
        horaInicio: horaInicioPersonalizada,
        horaFin: horaFinPersonalizada,
      });
      onMessage(`Cancha reservada: ${formatDate(selectedTurno.fecha)} ${horaInicioPersonalizada}–${horaFinPersonalizada}`);
      await selectCancha(selectedCancha);
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'No se pudo reservar.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOrganizarPartido(event: FormEvent) {
    event.preventDefault();

    if (!session) {
      onMessage('Inicia sesion para organizar un partido.');
      return;
    }
    if (!selectedCancha || !selectedTurno) {
      onMessage('Elegi un horario disponible.');
      return;
    }
    if (horaFinPersonalizada <= horaInicioPersonalizada) {
      onMessage('La hora de fin debe ser mayor a la de inicio.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Reserva y divide el bloque si es necesario (dejandolo disponible para que crear_partido pueda tomarlo)
      const turnoIdReservado = await reservarTurnoRango({
        canchaId: selectedCancha.id,
        fecha: selectedTurno.fecha,
        horaInicio: horaInicioPersonalizada,
        horaFin: horaFinPersonalizada,
        estadoFinal: 'disponible',
      });

      // 2. Crear partido con el ID especifico reservado
      const { data, error } = await supabase.rpc('crear_partido', {
        p_turno_id: turnoIdReservado,
        p_cupo_minimo: 12,
        p_cupo_maximo: Number(cupoMaximo),
        p_invitados: Number(invitados),
        p_nivel: nivelPartido,
        p_requiere_aprobacion: requiereAprobacion,
        p_visibilidad: 'publico',
      });

      if (error) {
        throw new Error(error.message);
      }

      onMessage(`Partido creado con pre-reserva activa. ID: ${data}`);
      if (selectedCancha) {
        await selectCancha(selectedCancha);
      }
      onRefresh();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'No se pudo crear el partido.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
      <div className="panel flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden sm:max-h-[88vh]">
        <header className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
          <div className="flex items-center gap-2">
            {(selectedClub || selectedCancha) && (
              <button aria-label="Volver" className="btn-secondary px-2.5 py-2" onClick={goBack} type="button">
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h2 className="font-bold text-ink">
                {selectedCancha ? selectedCancha.titulo : selectedClub ? selectedClub.nombre : 'Alquilar cancha'}
              </h2>
              <p className="text-xs text-ink/60">
                {selectedCancha
                  ? 'Horarios disponibles y ocupados'
                  : selectedClub
                    ? 'Elegi una cancha'
                    : 'Busca un club para reservar'}
              </p>
            </div>
          </div>
          <button aria-label="Cerrar" className="btn-secondary px-2.5 py-2" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {!selectedClub ? (
            <div className="grid gap-4">
              <label className="block">
                <span className="sr-only">Buscar club</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" size={18} />
                  <input
                    autoFocus
                    className="focus-ring w-full rounded-md border border-ink/15 py-2.5 pl-10 pr-3"
                    placeholder="Buscar por nombre o direccion..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </label>

              {loadingClubes ? (
                <p className="text-sm text-ink/60">Buscando clubes...</p>
              ) : clubes.length === 0 ? (
                <p className="text-sm text-ink/60">No se encontraron clubes.</p>
              ) : (
                <ul className="grid gap-2">
                  {clubes.map((club) => (
                    <li key={club.id}>
                      <button
                        className="panel w-full p-4 text-left transition hover:border-court/40"
                        onClick={() => void selectClub(club)}
                        type="button"
                      >
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-court/10 text-court">
                            <Building2 size={18} />
                          </span>
                          <div>
                            <h3 className="font-bold text-ink">{club.nombre}</h3>
                            {club.direccion ? (
                              <p className="mt-0.5 flex items-center gap-1 text-sm text-ink/60">
                                <MapPin size={14} />
                                {club.direccion}
                              </p>
                            ) : null}
                            {club.telefono ? (
                              <p className="mt-1 flex items-center gap-1 text-sm text-ink/55">
                                <Phone size={14} />
                                {club.telefono}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : !selectedCancha ? (
            <div className="grid gap-4">
              <article className="rounded-md border border-ink/10 bg-ink/5 p-4">
                <h3 className="font-bold text-ink">{selectedClub.nombre}</h3>
                {selectedClub.direccion ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/65">
                    <MapPin size={15} />
                    {selectedClub.direccion}
                  </p>
                ) : null}
                {selectedClub.telefono ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/65">
                    <Phone size={15} />
                    {selectedClub.telefono}
                  </p>
                ) : null}
              </article>

              <h3 className="text-sm font-bold uppercase tracking-wide text-ink/55">Canchas del club</h3>

              {loadingDetail ? (
                <p className="text-sm text-ink/60">Cargando canchas...</p>
              ) : canchas.length === 0 ? (
                <p className="text-sm text-ink/60">Este club todavia no tiene canchas publicadas.</p>
              ) : (
                <ul className="grid gap-3">
                  {canchas.map((cancha) => (
                    <li key={cancha.id}>
                      <button
                        className="panel w-full overflow-hidden text-left transition hover:border-court/40"
                        onClick={() => void selectCancha(cancha)}
                        type="button"
                      >
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
                              {cancha.descripcion ? (
                                <p className="mt-1 line-clamp-2 text-sm text-ink/60">{cancha.descripcion}</p>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-sm font-bold text-court">{formatMoney(cancha.precio_total)}</span>
                          </div>
                          <p className="mt-2 text-xs text-ink/50">Sena {formatMoney(cancha.precio_sena)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="grid gap-5">
              {selectedCancha.fotos.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedCancha.fotos.map((foto) => (
                    <img alt={selectedCancha.titulo} className="h-40 w-56 shrink-0 rounded-md object-cover" key={foto} src={foto} />
                  ))}
                </div>
              ) : null}

              {selectedCancha.descripcion ? (
                <p className="text-sm text-ink/70">{selectedCancha.descripcion}</p>
              ) : null}

              <div className="flex flex-wrap gap-4 text-sm">
                <span className="font-bold text-ink">{formatMoney(selectedCancha.precio_total)} total</span>
                <span className="text-ink/60">Sena {formatMoney(selectedCancha.precio_sena)}</span>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 font-bold text-ink">
                  <CalendarDays size={18} />
                  Horarios
                </h3>
                {loadingDetail ? (
                  <p className="text-sm text-ink/60">Cargando horarios...</p>
                ) : (
                  <ScheduleBoard
                    selectedTurnoId={selectedTurno?.id ?? null}
                    turnos={turnos}
                    onSelect={setSelectedTurno}
                  />
                )}
              </div>

              {selectedTurno ? (
                <div className="rounded-md border border-court/20 bg-court/5 p-4">
                  <p className="text-sm font-semibold text-ink">
                    Seleccionado: {formatDate(selectedTurno.fecha)} (Bloque de {formatTime(selectedTurno.hora_inicio)} a {formatTime(selectedTurno.hora_fin)})
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-sm text-ink/70">
                      Desde:
                      <input
                        className="ml-2 rounded-md border border-ink/20 px-2 py-1 focus:border-court focus:outline-none"
                        max={selectedTurno.hora_fin.slice(0, 5)}
                        min={selectedTurno.hora_inicio.slice(0, 5)}
                        type="time"
                        value={horaInicioPersonalizada}
                        onChange={(e) => setHoraInicioPersonalizada(e.target.value)}
                      />
                    </label>
                    <label className="ml-4 text-sm text-ink/70">
                      Hasta:
                      <input
                        className="ml-2 rounded-md border border-ink/20 px-2 py-1 focus:border-court focus:outline-none"
                        max={selectedTurno.hora_fin.slice(0, 5)}
                        min={selectedTurno.hora_inicio.slice(0, 5)}
                        type="time"
                        value={horaFinPersonalizada}
                        onChange={(e) => setHoraFinPersonalizada(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button className="btn-primary" disabled={submitting} onClick={() => void handleReservar()} type="button">
                      <Clock3 size={16} />
                      {submitting ? 'Reservando...' : 'Alquilar cancha'}
                    </button>
                  </div>

                  <form className="mt-4 grid gap-3 border-t border-court/15 pt-4" onSubmit={handleOrganizarPartido}>
                    <p className="text-sm font-bold text-ink">O organizar un partido en este horario</p>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold text-ink">
                        Cupo max.
                        <input className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2" max="22" min="12" type="number" value={cupoMaximo} onChange={(e) => setCupoMaximo(e.target.value)} />
                      </label>
                      <label className="block text-xs font-semibold text-ink">
                        Invitados
                        <input className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2" min="0" type="number" value={invitados} onChange={(e) => setInvitados(e.target.value)} />
                      </label>
                    </div>
                    <label className="block text-xs font-semibold text-ink">
                      Nivel
                      <select className="focus-ring mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2" value={nivelPartido} onChange={(e) => setNivelPartido(e.target.value)}>
                        <option value="recreativo">Recreativo</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="competitivo">Competitivo</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-ink">
                      <input checked={requiereAprobacion} onChange={(e) => setRequiereAprobacion(e.target.checked)} type="checkbox" />
                      Requiere aprobacion
                    </label>
                    <button className="btn-secondary" disabled={submitting} type="submit">
                      Organizar partido
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
