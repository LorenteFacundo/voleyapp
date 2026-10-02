import { useId, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trophy } from 'lucide-react';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { ClubPanel } from '@/api/tipos';
import {
  diaSemana, esFechaISO, formatFechaCorta, horaAMinutos, instanteArgentina, sumarMinutos,
} from '@/lib/date';
import { etiquetaNivelPartido, NIVELES_PARTIDO, type NivelPartido } from '@/lib/nivel';
import { enlaceCompartirWhatsApp } from '@/lib/telefono';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { CamposHorario } from './CamposHorario';
import { GrupoChips } from './Chips';
import { EnlaceWhatsApp } from '@/components/ui/EnlaceWhatsApp';
import { errorDeDuracion, errorDeHora, esHoraValida, horaDeFin } from './formulario';
import { useAhora, useInvalidarAgenda } from './hooks';
import { mensajePartido } from './mensajes';
import { parsearMonto, sugerirPrecio } from './precios';
import { montoCorto } from './presentacion';

type Props = {
  clubId: number;
  panel: ClubPanel;
  hoy: string;
  inicial: { canchaId: number | null; fecha: string; hora: string; duracion: number };
  onClose: () => void;
};

type Publicado = { partidoId: number; canchaId: number; inicio: string; fin: string; nivel: NivelPartido; precio: number; cupoMaximo: number };

function entero(texto: string): number | null {
  return /^\d{1,2}$/.test(texto.trim()) ? Number(texto) : null;
}

/** Partido abierto organizado por el club para llenar horas libres. */
export function PartidoAbiertoModal({ clubId, panel, hoy, inicial, onClose }: Props) {
  const formId = useId();
  const ahora = useAhora();
  const invalidar = useInvalidarAgenda(clubId);
  const canchas = useMemo(() => panel.canchas.filter((cancha) => cancha.activa), [panel.canchas]);

  const [canchaId, setCanchaId] = useState<number | null>(() => inicial.canchaId ?? canchas[0]?.id ?? null);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [hora, setHora] = useState(inicial.hora);
  const [duracion, setDuracion] = useState(inicial.duracion);
  const [cupoMinimo, setCupoMinimo] = useState('12');
  const [cupoMaximo, setCupoMaximo] = useState('18');
  const [nivel, setNivel] = useState<NivelPartido>('recreativo');
  const [precioManual, setPrecioManual] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [intento, setIntento] = useState(false);
  const [publicado, setPublicado] = useState<Publicado | null>(null);

  const cancha = canchas.find((item) => item.id === canchaId) ?? null;
  const minimo = entero(cupoMinimo);
  const maximo = entero(cupoMaximo);
  const horaValida = esHoraValida(hora);
  const sugerenciaTurno = cancha && esFechaISO(fecha) && horaValida
    ? sugerirPrecio({ horarios: panel.horarios, cancha, dia: diaSemana(fecha), rango: { inicio: horaAMinutos(hora), fin: horaAMinutos(hora) + duracion } })
    : null;
  const sugerido = sugerenciaTurno && sugerenciaTurno.precio > 0 && minimo && minimo >= 2
    ? Math.ceil(sugerenciaTurno.precio / minimo / 100) * 100
    : null;
  const precioTexto = precioManual ?? (sugerido !== null ? String(sugerido) : '');

  const errores: Partial<Record<'cancha' | 'fecha' | 'hora' | 'duracion' | 'minimo' | 'maximo' | 'precio', string>> = {};
  if (!cancha) errores.cancha = 'Elegí una cancha.';
  if (!esFechaISO(fecha)) errores.fecha = 'Elegí una fecha.';
  const errorHora = errorDeHora(hora);
  if (errorHora) errores.hora = errorHora;
  else if (esFechaISO(fecha) && Date.parse(instanteArgentina(fecha, hora)) <= ahora) errores.hora = 'El partido tiene que ser en el futuro.';
  const errorDuracion = errorDeDuracion(duracion);
  if (errorDuracion) errores.duracion = errorDuracion;
  if (minimo === null || minimo < 2 || minimo > 22) errores.minimo = 'Entre 2 y 22 jugadores.';
  if (maximo === null || maximo > 22) errores.maximo = 'Hasta 22 jugadores.';
  else if (minimo !== null && maximo < minimo) errores.maximo = 'No puede ser menor que el mínimo.';
  const precio = precioTexto.trim() ? parsearMonto(precioTexto) : null;
  if (precio === null) errores.precio = 'Indicá cuánto paga cada jugador (0 si es gratis).';
  const mostrar = (campo: keyof typeof errores) => (intento ? errores[campo] ?? null : null);

  const publicar = useMutation({
    mutationFn: (datos: Omit<Publicado, 'partidoId'> & { cupoMinimo: number; descripcion: string | null }) =>
      clubApi.publicarPartido({
        clubId,
        canchaId: datos.canchaId,
        inicio: datos.inicio,
        fin: datos.fin,
        cupoMinimo: datos.cupoMinimo,
        cupoMaximo: datos.cupoMaximo,
        nivel: datos.nivel,
        precioPorJugador: datos.precio,
        descripcion: datos.descripcion,
      }),
    onSuccess: (respuesta, datos) => {
      toast.success('Publicaste el partido abierto.');
      setPublicado({
        partidoId: respuesta.partido_id,
        canchaId: datos.canchaId,
        inicio: datos.inicio,
        fin: datos.fin,
        nivel: datos.nivel,
        precio: datos.precio,
        cupoMaximo: datos.cupoMaximo,
      });
    },
    onSettled: () => {
      void invalidar({ partidos: true });
    },
  });

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setIntento(true);
    if (Object.keys(errores).length || !cancha || minimo === null || maximo === null || precio === null) return;
    const inicio = instanteArgentina(fecha, hora);
    publicar.mutate({
      canchaId: cancha.id,
      inicio,
      fin: sumarMinutos(inicio, duracion),
      nivel,
      precio,
      cupoMinimo: minimo,
      cupoMaximo: maximo,
      descripcion: descripcion.trim() || null,
    });
  };

  if (publicado) {
    const nombreCancha = panel.canchas.find((item) => item.id === publicado.canchaId)?.titulo ?? 'Cancha';
    const mensaje = mensajePartido({
      club: panel.club.nombre,
      cancha: nombreCancha,
      inicio: publicado.inicio,
      fin: publicado.fin,
      hoy,
      nivel: etiquetaNivelPartido(publicado.nivel),
      precioPorJugador: publicado.precio,
      cupoMaximo: publicado.cupoMaximo,
      enlace: `${window.location.origin}/partido/${publicado.partidoId}`,
    });
    return (
      <Modal open onClose={onClose} title="¡Partido publicado!" size="md" footer={<Button onClick={onClose}>Listo</Button>}>
        <div className="space-y-4 text-center">
          <Trophy size={40} className="mx-auto text-vb-orange-ink" aria-hidden="true" />
          <p className="text-sm text-ink/70">
            {panel.club.publicado
              ? 'Ya aparece en Partidos para que los jugadores se anoten. Compartilo para que se llene más rápido.'
              : 'Como el club no está publicado, no aparece en la lista de Partidos: compartí el enlace para que se anoten.'}
          </p>
          <pre className="whitespace-pre-wrap rounded-xl bg-ink/[0.04] p-3 text-left font-body text-sm text-ink/80">{mensaje}</pre>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <EnlaceWhatsApp href={enlaceCompartirWhatsApp(mensaje)} variante="destacado">Compartir por WhatsApp</EnlaceWhatsApp>
            <Link
              to={`/partido/${publicado.partidoId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-vb-gray/15 px-4 text-sm font-semibold text-vb-gray hover:border-vb-orange-ink hover:text-vb-orange-ink"
            >
              Ver el partido
            </Link>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Publicar partido abierto"
      descripcion="Para llenar horas libres: los jugadores se anotan solos y pagan por persona."
      size="md"
      bloqueado={publicar.isPending}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={publicar.isPending}>Cancelar</Button>
          <Button type="submit" form={formId} loading={publicar.isPending}>Publicar partido</Button>
        </>
      )}
    >
      <form id={formId} onSubmit={enviar} className="space-y-5" noValidate>
        {canchas.length > 6 ? (
          <Select label="Cancha" value={canchaId ?? ''} error={mostrar('cancha')} onChange={(evento) => setCanchaId(Number(evento.target.value) || null)}>
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
        <Input type="date" label="Fecha" value={fecha} min={hoy} error={mostrar('fecha')} onChange={(evento) => setFecha(evento.target.value)} />
        <CamposHorario
          hora={hora}
          duracion={duracion}
          onHora={setHora}
          onDuracion={setDuracion}
          errorHora={mostrar('hora')}
          errorDuracion={mostrar('duracion')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            inputMode="numeric"
            min={2}
            max={22}
            label="Cupo mínimo"
            value={cupoMinimo}
            error={mostrar('minimo')}
            hint="Para que se juegue."
            onChange={(evento) => setCupoMinimo(evento.target.value)}
          />
          <Input
            type="number"
            inputMode="numeric"
            min={2}
            max={22}
            label="Cupo máximo"
            value={cupoMaximo}
            error={mostrar('maximo')}
            onChange={(evento) => setCupoMaximo(evento.target.value)}
          />
        </div>
        <GrupoChips legend="Nivel" opciones={NIVELES_PARTIDO.map((opcion) => ({ value: opcion.value, label: opcion.label }))} value={nivel} onChange={setNivel} />
        <div>
          <Input
            label="Precio por jugador"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ej.: 2500"
            value={precioTexto}
            error={mostrar('precio')}
            hint={precioManual === null && sugerido !== null && sugerenciaTurno
              ? `Sugerido: ${montoCorto(sugerenciaTurno.precio)} del turno dividido ${minimo} jugadores.`
              : 'Escribí 0 si es sin cargo.'}
            onChange={(evento) => setPrecioManual(evento.target.value)}
          />
          {precioManual !== null && sugerido !== null && (
            <button type="button" onClick={() => setPrecioManual(null)} className="mt-1 min-h-9 text-sm font-semibold text-vb-blue hover:underline">
              Usar el sugerido ({montoCorto(sugerido)})
            </button>
          )}
        </div>
        <Textarea
          label="Descripción (opcional)"
          rows={2}
          maxLength={500}
          placeholder="Ej.: Mixto, traer remera clara y oscura."
          value={descripcion}
          onChange={(evento) => setDescripcion(evento.target.value)}
        />
        {!panel.club.publicado && (
          <Aviso tono="alerta">
            Tu club no está publicado: el partido no va a aparecer en la lista de Partidos, pero vas a poder compartir el enlace.
          </Aviso>
        )}
        {cancha && esFechaISO(fecha) && horaValida && (
          <p className="rounded-xl bg-ink/[0.04] px-3 py-2 text-sm text-ink/75">
            {cancha.titulo} · {formatFechaCorta(fecha)} · {hora}–{horaDeFin(hora, duracion)} · {etiquetaNivelPartido(nivel)}
          </p>
        )}
        {publicar.isError && <Aviso tono="error" titulo="No se pudo publicar">{mensajeDeError(publicar.error)}</Aviso>}
      </form>
    </Modal>
  );
}
