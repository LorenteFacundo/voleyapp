import { useId, useMemo, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi, type NuevaReserva } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { ClubPanel, Ocupacion } from '@/api/tipos';
import {
  diaSemana, esFechaISO, formatFechaCorta, formatRangoHorario, horaAMinutos, instanteArgentina, sumarMinutos,
} from '@/lib/date';
import { enlaceWhatsApp, normalizarTelefono } from '@/lib/telefono';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { BuscadorCliente, type SeleccionCliente } from './BuscadorCliente';
import { CamposHorario } from './CamposHorario';
import { GrupoChips } from './Chips';
import { errorDeDuracion, errorDeHora, esHoraValida, horaDeFin } from './formulario';
import { useInvalidarAgenda } from './hooks';
import { duracionHabitual } from './layout';
import { mensajeConfirmacion } from './mensajes';
import { parsearMonto, sugerirPrecio } from './precios';
import {
  ORIGENES_MANUALES, montoCorto, requiereAvisoManual, telefonoDeOcupacion, type OrigenManual,
} from './presentacion';

export type PrefillReserva = {
  canchaId: number | null;
  fecha: string;
  hora: string;
  duracion: number | null;
};

type Props = {
  clubId: number;
  panel: ClubPanel;
  prefill: PrefillReserva;
  hoy: string;
  onClose: () => void;
  onCreada: (ocupacion: Ocupacion) => void;
};

const TITULOS_RAPIDOS = ['Clase', 'Escuelita', 'Entrenamiento', 'Torneo'];

type Errores = Partial<Record<'cancha' | 'fecha' | 'hora' | 'duracion' | 'cliente' | 'nombre' | 'telefono' | 'titulo' | 'precio', string>>;

export function NuevaReservaModal({ clubId, panel, prefill, hoy, onClose, onCreada }: Props) {
  const formId = useId();
  const invalidar = useInvalidarAgenda(clubId);
  const canchas = useMemo(() => panel.canchas.filter((cancha) => cancha.activa), [panel.canchas]);

  const [canchaId, setCanchaId] = useState<number | null>(() => prefill.canchaId ?? canchas[0]?.id ?? null);
  const [fecha, setFecha] = useState(prefill.fecha);
  const [hora, setHora] = useState(prefill.hora);
  const [duracion, setDuracion] = useState(() => prefill.duracion
    ?? duracionHabitual(panel.horarios, prefill.canchaId ?? canchas[0]?.id ?? 0));
  const [cliente, setCliente] = useState<SeleccionCliente>({ modo: 'buscar', termino: '' });
  const [titulo, setTitulo] = useState('');
  const [origen, setOrigen] = useState<OrigenManual>('whatsapp');
  const [precioManual, setPrecioManual] = useState<string | null>(null);
  const [notas, setNotas] = useState('');
  const [intento, setIntento] = useState(false);

  const cancha = canchas.find((item) => item.id === canchaId) ?? null;
  const horaValida = esHoraValida(hora);
  const sugerencia = esFechaISO(fecha) && horaValida
    ? sugerirPrecio({
      horarios: panel.horarios,
      cancha,
      dia: diaSemana(fecha),
      rango: { inicio: horaAMinutos(hora), fin: horaAMinutos(hora) + duracion },
    })
    : null;
  const precioTexto = precioManual ?? (sugerencia ? String(sugerencia.precio) : '');

  const errores: Errores = {};
  if (!cancha) errores.cancha = 'Elegí una cancha.';
  if (!esFechaISO(fecha)) errores.fecha = 'Elegí una fecha.';
  const errorHora = errorDeHora(hora);
  if (errorHora) errores.hora = errorHora;
  const errorDuracion = errorDeDuracion(duracion);
  if (errorDuracion) errores.duracion = errorDuracion;
  if (cliente.modo === 'buscar' && !titulo.trim()) {
    errores.cliente = cliente.termino.trim()
      ? 'Elegí un cliente de la lista o cargalo como nuevo.'
      : 'Elegí un cliente, cargá uno nuevo o elegí "Sin cliente".';
  }
  if (cliente.modo === 'nuevo') {
    if (cliente.nombre.trim().length < 2) errores.nombre = 'Escribí el nombre (al menos 2 letras).';
    if (cliente.telefono.trim() && !normalizarTelefono(cliente.telefono)) errores.telefono = 'Revisá el teléfono: no parece válido.';
  }
  if (cliente.modo === 'ninguno' && !titulo.trim()) errores.titulo = 'Poné un título (por ejemplo, Clase o Torneo).';
  if (precioTexto.trim() && parsearMonto(precioTexto) === null) errores.precio = 'Revisá el precio.';
  const mostrar = (campo: keyof Errores) => (intento ? errores[campo] ?? null : null);

  const crear = useMutation({
    mutationFn: (datos: NuevaReserva) => clubApi.crearReserva(datos),
    onSuccess: (ocupacion) => {
      const nombreCancha = cancha?.titulo ?? 'Cancha';
      const telefono = telefonoDeOcupacion(ocupacion);
      const avisarA = telefono && requiereAvisoManual(ocupacion) ? telefono : null;
      toast.success(
        `Reserva guardada: ${nombreCancha}, ${formatRangoHorario(ocupacion.inicio, ocupacion.fin)}.`,
        avisarA ? {
          action: {
            label: 'Avisar por WhatsApp',
            onClick: () => {
              const mensaje = mensajeConfirmacion({
                club: panel.club.nombre,
                nombre: ocupacion.cliente?.nombre ?? null,
                cancha: nombreCancha,
                inicio: ocupacion.inicio,
                fin: ocupacion.fin,
                hoy,
              });
              window.open(enlaceWhatsApp(avisarA, mensaje), '_blank', 'noopener,noreferrer');
            },
          },
          duration: 10_000,
        } : undefined,
      );
      onCreada(ocupacion);
    },
    onSettled: () => {
      void invalidar();
    },
  });

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setIntento(true);
    if (Object.keys(errores).length || !cancha) return;
    const inicio = instanteArgentina(fecha, hora);
    crear.mutate({
      clubId,
      canchaId: cancha.id,
      inicio,
      fin: sumarMinutos(inicio, duracion),
      clienteId: cliente.modo === 'existente' ? cliente.cliente.id : null,
      clienteNombre: cliente.modo === 'nuevo' ? cliente.nombre.trim() : null,
      clienteTelefono: cliente.modo === 'nuevo' ? normalizarTelefono(cliente.telefono) : null,
      origen,
      precio: precioTexto.trim() ? parsearMonto(precioTexto) : null,
      titulo: titulo.trim() || null,
      notas: notas.trim() || null,
    });
  };

  const resumen = cancha && esFechaISO(fecha) && horaValida
    ? `${cancha.titulo} · ${formatFechaCorta(fecha)} · ${hora}–${horaDeFin(hora, duracion)}`
    : 'Completá cancha, día y horario.';

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva reserva"
      descripcion={resumen}
      size="md"
      bloqueado={crear.isPending}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={crear.isPending}>Cancelar</Button>
          <Button type="submit" form={formId} loading={crear.isPending}>Guardar reserva</Button>
        </>
      )}
    >
      <form id={formId} onSubmit={enviar} className="space-y-5" noValidate>
        {canchas.length > 6 ? (
          <Select
            label="Cancha"
            value={canchaId ?? ''}
            error={mostrar('cancha')}
            onChange={(evento) => setCanchaId(Number(evento.target.value) || null)}
          >
            {canchas.map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}
          </Select>
        ) : (
          <GrupoChips
            legend="Cancha"
            opciones={canchas.map((item) => ({ value: item.id, label: item.titulo }))}
            value={canchaId}
            error={mostrar('cancha')}
            onChange={setCanchaId}
          />
        )}

        <Input
          type="date"
          label="Fecha"
          value={fecha}
          error={mostrar('fecha')}
          onChange={(evento) => setFecha(evento.target.value)}
        />

        <CamposHorario
          hora={hora}
          duracion={duracion}
          onHora={setHora}
          onDuracion={setDuracion}
          errorHora={mostrar('hora')}
          errorDuracion={mostrar('duracion')}
        />

        <BuscadorCliente
          clubId={clubId}
          valor={cliente}
          onCambio={setCliente}
          error={mostrar('cliente')}
          errorNombre={mostrar('nombre')}
          errorTelefono={mostrar('telefono')}
        />

        <div>
          <Input
            label={cliente.modo === 'ninguno' ? 'Título' : 'Título (opcional)'}
            placeholder="Ej.: Clase, Torneo, Cumpleaños"
            maxLength={120}
            value={titulo}
            error={mostrar('titulo')}
            onChange={(evento) => setTitulo(evento.target.value)}
          />
          {cliente.modo === 'ninguno' && (
            <div className="mt-2 flex flex-wrap gap-2">
              {TITULOS_RAPIDOS.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => setTitulo(opcion)}
                  className="min-h-9 rounded-full border border-ink/15 px-3 text-sm font-semibold text-ink/70 hover:border-vb-orange-ink hover:text-ink"
                >
                  {opcion}
                </button>
              ))}
            </div>
          )}
        </div>

        <GrupoChips legend="¿Cómo reservó?" opciones={[...ORIGENES_MANUALES]} value={origen} onChange={setOrigen} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Input
              label="Precio"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Ej.: 30000"
              value={precioTexto}
              error={mostrar('precio')}
              hint={precioManual === null && sugerencia
                ? `${montoCorto(sugerencia.precio)} · ${sugerencia.detalle}`
                : 'Se puede cambiar después.'}
              onChange={(evento) => setPrecioManual(evento.target.value)}
            />
            {precioManual !== null && sugerencia && (
              <button
                type="button"
                onClick={() => setPrecioManual(null)}
                className="mt-1 min-h-9 text-sm font-semibold text-vb-blue hover:underline"
              >
                Usar el sugerido ({montoCorto(sugerencia.precio)})
              </button>
            )}
          </div>
          <Textarea label="Notas (opcional)" rows={2} maxLength={500} value={notas} onChange={(evento) => setNotas(evento.target.value)} />
        </div>

        {crear.isError && <Aviso tono="error" titulo="No se pudo guardar">{mensajeDeError(crear.error)}</Aviso>}
        {intento && Object.keys(errores).length > 0 && (
          <p role="alert" className="text-sm font-semibold text-red-700">Revisá los datos marcados.</p>
        )}
      </form>
    </Modal>
  );
}
