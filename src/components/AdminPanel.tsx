import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CalendarPlus,
  ImagePlus,
  MapPin,
  Plus,
  Trash2,
  Volleyball,
} from 'lucide-react';
import { crearCanchaConTurnos, uploadCanchaPhotos, type TurnoInput } from '../lib/admin';
import { formatDate } from '../lib/format';
import { supabase } from '../lib/supabase';

type SlotDraft = TurnoInput & { key: string };

type AdminPanelProps = {
  onBack: () => void;
  onCreated: () => void;
};

type ClubOption = {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
};

function emptySlot(): SlotDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    key: crypto.randomUUID(),
    fecha: today,
    hora_inicio: '18:00',
    hora_fin: '20:00',
  };
}

function buildWeekSlots(startDate: string, horaInicio: string, horaFin: string, days: number) {
  const slots: SlotDraft[] = [];
  const base = new Date(`${startDate}T12:00:00`);

  for (let index = 0; index < days; index += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    slots.push({
      key: crypto.randomUUID(),
      fecha: date.toISOString().slice(0, 10),
      hora_inicio: horaInicio,
      hora_fin: horaFin,
    });
  }

  return slots;
}

export function AdminPanel({ onBack, onCreated }: AdminPanelProps) {
  const [clubMode, setClubMode] = useState<'existing' | 'new'>('new');
  const [clubId, setClubId] = useState<number | null>(null);
  const [clubOptions, setClubOptions] = useState<ClubOption[]>([]);
  const [clubNombre, setClubNombre] = useState('');
  const [clubDireccion, setClubDireccion] = useState('');
  const [clubTelefono, setClubTelefono] = useState('');
  const [latitud, setLatitud] = useState('-34.6037');
  const [longitud, setLongitud] = useState('-58.3816');
  const [titulo, setTitulo] = useState('');
  const [nombreIdentificador, setNombreIdentificador] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioTotal, setPrecioTotal] = useState('45000');
  const [precioSena, setPrecioSena] = useState('15000');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot()]);
  const [bulkDays, setBulkDays] = useState('7');
  const [bulkStart, setBulkStart] = useState(new Date().toISOString().slice(0, 10));
  const [bulkInicio, setBulkInicio] = useState('18:00');
  const [bulkFin, setBulkFin] = useState('20:00');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('clubes_publicos')
      .select('id, nombre, direccion, telefono, latitud, longitud')
      .order('nombre', { ascending: true })
      .then(({ data }) => setClubOptions((data ?? []) as ClubOption[]));
  }, []);

  async function selectExistingClub(id: number | null) {
    setClubId(id);

    if (!id) {
      return;
    }

    const { data, error } = await supabase
      .from('clubes_publicos')
      .select('id, nombre, direccion, telefono, latitud, longitud')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      setMessage(error?.message ?? 'No se pudo cargar el club seleccionado.');
      return;
    }

    setClubNombre(data.nombre);
    setClubDireccion(data.direccion ?? '');
    setClubTelefono(data.telefono ?? '');
    setLatitud(data.latitud != null ? String(data.latitud) : '-34.6037');
    setLongitud(data.longitud != null ? String(data.longitud) : '-58.3816');
  }

  const photoPreviews = useMemo(
    () => photoFiles.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [photoFiles],
  );

  function updateSlot(key: string, field: keyof TurnoInput, value: string) {
    setSlots((current) =>
      current.map((slot) => (slot.key === key ? { ...slot, [field]: value } : slot)),
    );
  }

  function removeSlot(key: string) {
    setSlots((current) => (current.length === 1 ? current : current.filter((slot) => slot.key !== key)));
  }

  function appendBulkWeek() {
    const generated = buildWeekSlots(bulkStart, bulkInicio, bulkFin, Number(bulkDays) || 7);
    setSlots((current) => [...current, ...generated]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const fotos = photoFiles.length > 0 ? await uploadCanchaPhotos(photoFiles) : [];
      const turnos = slots.map(({ fecha, hora_inicio, hora_fin }) => ({
        fecha,
        hora_inicio,
        hora_fin,
      }));

      const result = await crearCanchaConTurnos({
        clubId: clubMode === 'existing' ? clubId : null,
        clubNombre,
        clubDireccion,
        clubTelefono,
        latitud: Number(latitud),
        longitud: Number(longitud),
        titulo,
        nombreIdentificador,
        descripcion,
        precioTotal: Number(precioTotal),
        precioSena: Number(precioSena),
        fotos,
        turnos,
      });

      setMessage(
        `Cancha creada (#${result.cancha_id}) con ${result.turnos_creados} turno(s) en el club #${result.club_id}.`,
      );
      onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la cancha.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button className="btn-secondary" onClick={onBack} type="button">
          <ArrowLeft size={17} />
          Volver al mapa
        </button>
        <span className="inline-flex items-center gap-2 rounded-md bg-court/10 px-3 py-2 text-sm font-semibold text-court">
          <Volleyball size={16} />
          Panel superadmin
        </span>
      </div>

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <section className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="text-court" size={20} />
            <h2 className="text-lg font-bold text-ink">Club / sede</h2>
          </div>

          <div className="mb-4 flex rounded-md bg-ink/5 p-1">
            <button
              className={`flex-1 rounded px-3 py-2 text-sm font-semibold ${clubMode === 'new' ? 'bg-white text-ink shadow-sm' : 'text-ink/60'}`}
              onClick={() => {
                setClubMode('new');
                setClubId(null);
              }}
              type="button"
            >
              Crear club
            </button>
            <button
              className={`flex-1 rounded px-3 py-2 text-sm font-semibold ${clubMode === 'existing' ? 'bg-white text-ink shadow-sm' : 'text-ink/60'}`}
              onClick={() => setClubMode('existing')}
              type="button"
            >
              Usar club existente
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {clubMode === 'existing' ? (
              <>
                <label className="block text-sm font-semibold text-ink md:col-span-2">
                  Club existente
                  <select
                    className="focus-ring mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2"
                    required
                    value={clubId ?? ''}
                    onChange={(event) => selectExistingClub(Number(event.target.value) || null)}
                  >
                    <option value="">Seleccionar club</option>
                    {clubOptions.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.nombre}
                        {club.direccion ? ` · ${club.direccion}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-ink md:col-span-2">
                  Direccion del club
                  <input
                    className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                    value={clubDireccion}
                    onChange={(event) => setClubDireccion(event.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block text-sm font-semibold text-ink md:col-span-2">
                  Nombre del club
                  <input
                    className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                    required
                    value={clubNombre}
                    onChange={(event) => setClubNombre(event.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-ink md:col-span-2">
                  Direccion
                  <input
                    className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                    required
                    value={clubDireccion}
                    onChange={(event) => setClubDireccion(event.target.value)}
                  />
                </label>
              </>
            )}
            <label className="block text-sm font-semibold text-ink">
              Telefono
              <input
                className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                value={clubTelefono}
                onChange={(event) => setClubTelefono(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-ink">
                Latitud
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                  required
                  step="any"
                  type="number"
                  value={latitud}
                  onChange={(event) => setLatitud(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-ink">
                Longitud
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                  required
                  step="any"
                  type="number"
                  value={longitud}
                  onChange={(event) => setLongitud(event.target.value)}
                />
              </label>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-ink/60">
            <MapPin size={14} />
            {clubMode === 'existing'
              ? 'Al publicar, se actualizan telefono y ubicacion del club seleccionado.'
              : 'La ubicacion define el pin en el mapa de partidos.'}
          </p>
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Volleyball className="text-court" size={20} />
            <h2 className="text-lg font-bold text-ink">Cancha</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold text-ink md:col-span-2">
              Titulo publico
              <input
                className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                placeholder="Cancha techada N°1"
                required
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold text-ink">
              Identificador interno
              <input
                className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                placeholder="Opcional, usa el titulo si queda vacio"
                value={nombreIdentificador}
                onChange={(event) => setNombreIdentificador(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-ink">
                Precio total
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                  min="1"
                  required
                  type="number"
                  value={precioTotal}
                  onChange={(event) => setPrecioTotal(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-ink">
                Sena
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2"
                  min="0"
                  required
                  type="number"
                  value={precioSena}
                  onChange={(event) => setPrecioSena(event.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm font-semibold text-ink md:col-span-2">
              Descripcion
              <textarea
                className="focus-ring mt-1 min-h-28 w-full rounded-md border border-ink/15 px-3 py-2"
                placeholder="Superficie, techado, vestuarios, estacionamiento..."
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold text-ink md:col-span-2">
              Fotos
              <input
                accept="image/jpeg,image/png,image/webp"
                className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-court/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-court"
                multiple
                type="file"
                onChange={(event) => setPhotoFiles([...(event.target.files ?? [])])}
              />
            </label>
          </div>

          {photoPreviews.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photoPreviews.map((preview) => (
                <figure className="overflow-hidden rounded-md border border-ink/10" key={preview.url}>
                  <img alt={preview.name} className="h-28 w-full object-cover" src={preview.url} />
                  <figcaption className="truncate px-2 py-1 text-xs text-ink/60">{preview.name}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink/60">
              <ImagePlus size={16} />
              Podes subir varias imagenes JPG, PNG o WebP.
            </p>
          )}
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarPlus className="text-court" size={20} />
              <h2 className="text-lg font-bold text-ink">Horarios disponibles</h2>
            </div>
            <button
              className="btn-secondary"
              onClick={() => setSlots((current) => [...current, emptySlot()])}
              type="button"
            >
              <Plus size={16} />
              Agregar turno
            </button>
          </div>

          <div className="mb-4 rounded-md border border-ink/10 bg-ink/5 p-4">
            <p className="text-sm font-semibold text-ink">Generar semana completa</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                Desde
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                  type="date"
                  value={bulkStart}
                  onChange={(event) => setBulkStart(event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                Dias
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                  max="31"
                  min="1"
                  type="number"
                  value={bulkDays}
                  onChange={(event) => setBulkDays(event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                Inicio
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                  type="time"
                  value={bulkInicio}
                  onChange={(event) => setBulkInicio(event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                Fin
                <input
                  className="focus-ring mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                  type="time"
                  value={bulkFin}
                  onChange={(event) => setBulkFin(event.target.value)}
                />
              </label>
            </div>
            <button className="btn-secondary mt-3" onClick={appendBulkWeek} type="button">
              Generar turnos
            </button>
          </div>

          <div className="grid gap-3">
            {slots.map((slot) => (
              <div className="grid gap-3 rounded-md border border-ink/10 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]" key={slot.key}>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  Fecha
                  <input
                    className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
                    required
                    type="date"
                    value={slot.fecha}
                    onChange={(event) => updateSlot(slot.key, 'fecha', event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  Inicio
                  <input
                    className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
                    required
                    type="time"
                    value={slot.hora_inicio}
                    onChange={(event) => updateSlot(slot.key, 'hora_inicio', event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink/60">
                  Fin
                  <input
                    className="focus-ring mt-1 w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
                    required
                    type="time"
                    value={slot.hora_fin}
                    onChange={(event) => updateSlot(slot.key, 'hora_fin', event.target.value)}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    aria-label="Eliminar turno"
                    className="btn-secondary w-full sm:w-auto"
                    onClick={() => removeSlot(slot.key)}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="text-xs text-ink/55 sm:col-span-4">
                  {formatDate(slot.fecha)} · {slot.hora_inicio.slice(0, 5)} a {slot.hora_fin.slice(0, 5)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/65">
            Se creara la cancha y {slots.length} bloque(s) de disponibilidad.
          </p>
          <button className="btn-primary" disabled={submitting} type="submit">
            <Plus size={17} />
            {submitting ? 'Guardando...' : 'Publicar cancha'}
          </button>
        </div>

        {message ? (
          <div className="rounded-md border border-sand/40 bg-sand/15 p-3 text-sm font-medium text-ink">
            {message}
          </div>
        ) : null}
      </form>
    </div>
  );
}
