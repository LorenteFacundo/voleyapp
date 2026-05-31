import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, CalendarClock, ImagePlus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { crearCanchaConTurnos, uploadCanchaPhotos } from '@/lib/admin';
import type { TurnoInput } from '@/lib/admin';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { ClubPublico } from '@/types';

type AdminPanelProps = {
  onBack: () => void;
  onCreated: () => void;
};

type SlotDraft = TurnoInput & { key: string };

type ClubMode = 'new' | 'existing';

const CLUB_TABS = [
  { id: 'new', label: 'Crear club' },
  { id: 'existing', label: 'Usar club existente' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptySlot(): SlotDraft {
  return { key: crypto.randomUUID(), fecha: todayISO(), hora_inicio: '18:00', hora_fin: '20:00' };
}

function buildWeekSlots(startDate: string, horaInicio: string, horaFin: string, days: number): SlotDraft[] {
  const slots: SlotDraft[] = [];
  const base = new Date(`${startDate}T12:00:00`);
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    slots.push({
      key: crypto.randomUUID(),
      fecha: d.toISOString().slice(0, 10),
      hora_inicio: horaInicio,
      hora_fin: horaFin,
    });
  }
  return slots;
}

export function AdminPanel({ onBack, onCreated }: AdminPanelProps) {
  const [clubMode, setClubMode] = useState<ClubMode>('new');
  const [clubes, setClubes] = useState<ClubPublico[]>([]);
  const [clubId, setClubId] = useState<number | null>(null);
  const [clubNombre, setClubNombre] = useState('');
  const [clubDireccion, setClubDireccion] = useState('');
  const [clubTelefono, setClubTelefono] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');

  const [titulo, setTitulo] = useState('');
  const [nombreIdentificador, setNombreIdentificador] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioTotal, setPrecioTotal] = useState('');
  const [precioSena, setPrecioSena] = useState('');

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot()]);

  const [bulkDays, setBulkDays] = useState('7');
  const [bulkStart, setBulkStart] = useState(todayISO());
  const [bulkInicio, setBulkInicio] = useState('18:00');
  const [bulkFin, setBulkFin] = useState('20:00');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('clubes_publicos')
      .select('id, nombre, direccion, telefono, latitud, longitud')
      .order('nombre')
      .then(({ data }) => {
        if (data) setClubes(data as ClubPublico[]);
      });
  }, []);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  function handleClubSelect(id: number) {
    const club = clubes.find((c) => c.id === id);
    if (!club) return;
    setClubId(club.id);
    setClubNombre(club.nombre);
    setClubDireccion(club.direccion ?? '');
    setClubTelefono(club.telefono ?? '');
    setLatitud(club.latitud != null ? String(club.latitud) : '');
    setLongitud(club.longitud != null ? String(club.longitud) : '');
  }

  function handleClubModeChange(mode: string) {
    setClubMode(mode as ClubMode);
    setClubId(null);
    setClubNombre('');
    setClubDireccion('');
    setClubTelefono('');
    setLatitud('');
    setLongitud('');
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPhotoFiles((prev) => [...prev, ...files]);
    setPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSlot(key: string, field: keyof TurnoInput, value: string) {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  }

  function removeSlot(key: string) {
    setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  }

  function appendBulkWeek() {
    const days = parseInt(bulkDays, 10);
    if (!days || days < 1) return;
    const newSlots = buildWeekSlots(bulkStart, bulkInicio, bulkFin, days);
    setSlots((prev) => [...prev, ...newSlots]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const lat = parseFloat(latitud);
    const lng = parseFloat(longitud);
    const precio = parseFloat(precioTotal);
    const sena = parseFloat(precioSena);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error('Latitud y longitud deben ser números válidos');
      return;
    }
    if (Number.isNaN(precio) || precio <= 0) {
      toast.error('El precio total debe ser un número mayor a 0');
      return;
    }
    if (Number.isNaN(sena) || sena < 0) {
      toast.error('El precio de la seña debe ser un número válido');
      return;
    }

    setSubmitting(true);
    try {
      const fotos = photoFiles.length > 0 ? await uploadCanchaPhotos(photoFiles) : [];
      const result = await crearCanchaConTurnos({
        clubId,
        clubNombre,
        clubDireccion,
        clubTelefono,
        latitud: lat,
        longitud: lng,
        titulo,
        nombreIdentificador,
        descripcion,
        precioTotal: precio,
        precioSena: sena,
        fotos,
        turnos: slots.map(({ key, ...rest }) => rest),
      });
      toast.success(`Cancha creada con ${result.turnos_creados} turnos`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la cancha');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <h1 className="text-xl font-bold text-ink">Publicar cancha</h1>
      </div>

      <Card padding="lg">
        <h2 className="mb-4 text-lg font-bold text-ink">Club / Sede</h2>
        <Tabs tabs={CLUB_TABS} activeTab={clubMode} onChange={handleClubModeChange} />

        <div className="mt-4 flex flex-col gap-4">
          {clubMode === 'existing' && (
            <div className="flex flex-col">
              <label htmlFor="club-select" className="block text-sm font-semibold text-ink mb-1">
                Seleccionar club
              </label>
              <select
                id="club-select"
                value={clubId ?? ''}
                onChange={(e) => handleClubSelect(Number(e.target.value))}
                className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm focus:ring-2 focus:ring-court/40 focus:outline-none transition"
              >
                <option value="">-- Elegir --</option>
                {clubes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {clubMode === 'new' && (
            <>
              <Input
                label="Nombre del club"
                value={clubNombre}
                onChange={(e) => setClubNombre(e.target.value)}
                required
              />
              <Input
                label="Dirección"
                value={clubDireccion}
                onChange={(e) => setClubDireccion(e.target.value)}
                required
              />
            </>
          )}

          <Input
            label="Teléfono"
            value={clubTelefono}
            onChange={(e) => setClubTelefono(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitud"
              type="number"
              step="any"
              value={latitud}
              onChange={(e) => setLatitud(e.target.value)}
              required
            />
            <Input
              label="Longitud"
              type="number"
              step="any"
              value={longitud}
              onChange={(e) => setLongitud(e.target.value)}
              required
            />
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <h2 className="mb-4 text-lg font-bold text-ink">Cancha</h2>
        <div className="flex flex-col gap-4">
          <Input
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
          <Input
            label="Identificador interno"
            value={nombreIdentificador}
            onChange={(e) => setNombreIdentificador(e.target.value)}
            helperText="Opcional - para uso interno"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio total"
              type="number"
              step="0.01"
              value={precioTotal}
              onChange={(e) => setPrecioTotal(e.target.value)}
              required
            />
            <Input
              label="Precio seña"
              type="number"
              step="0.01"
              value={precioSena}
              onChange={(e) => setPrecioSena(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="descripcion" className="block text-sm font-semibold text-ink mb-1">
              Descripción
            </label>
            <textarea
              id="descripcion"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm focus:ring-2 focus:ring-court/40 focus:outline-none transition resize-y"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="block text-sm font-semibold text-ink">Fotos</label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink/20 px-4 py-3 text-sm text-ink/60 transition hover:border-court hover:text-court">
              <ImagePlus className="h-5 w-5" />
              Agregar fotos
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
            {photoPreviews.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {photoPreviews.map((url, i) => (
                  <div key={url} className="relative group aspect-square overflow-hidden rounded-md border border-ink/10">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 className="h-5 w-5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink">Horarios disponibles</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSlots((prev) => [...prev, emptySlot()])}
          >
            <Plus className="h-4 w-4" />
            Agregar turno
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {slots.map((slot) => (
            <div
              key={slot.key}
              className="flex items-end gap-3 rounded-md border border-ink/10 bg-ink/[0.02] p-3"
            >
              <div className="flex-1">
                <Input
                  label="Fecha"
                  type="date"
                  value={slot.fecha}
                  onChange={(e) => updateSlot(slot.key, 'fecha', e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Inicio"
                  type="time"
                  value={slot.hora_inicio}
                  onChange={(e) => updateSlot(slot.key, 'hora_inicio', e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Fin"
                  type="time"
                  value={slot.hora_fin}
                  onChange={(e) => updateSlot(slot.key, 'hora_fin', e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <CalendarClock className="h-4 w-4 text-ink/40" />
                <span className="text-xs text-ink/50 whitespace-nowrap">
                  {formatDate(slot.fecha)} {slot.hora_inicio}–{slot.hora_fin}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSlot(slot.key)}
                disabled={slots.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-md border border-ink/10 bg-ink/[0.02] p-4">
          <h3 className="mb-3 text-sm font-bold text-ink">Generación masiva</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input
              label="Fecha inicio"
              type="date"
              value={bulkStart}
              onChange={(e) => setBulkStart(e.target.value)}
            />
            <Input
              label="Cantidad de días"
              type="number"
              min={1}
              value={bulkDays}
              onChange={(e) => setBulkDays(e.target.value)}
            />
            <Input
              label="Hora inicio"
              type="time"
              value={bulkInicio}
              onChange={(e) => setBulkInicio(e.target.value)}
            />
            <Input
              label="Hora fin"
              type="time"
              value={bulkFin}
              onChange={(e) => setBulkFin(e.target.value)}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={appendBulkWeek}>
            <CalendarClock className="h-4 w-4" />
            Generar turnos
          </Button>
        </div>
      </Card>

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Publicar cancha
      </Button>
    </form>
  );
}
