import { useId, useMemo, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { ClubPanel, Ocupacion } from '@/api/tipos';
import {
  addDaysToISODate, diferenciaEnDias, esFechaISO, fechaArgentina, formatFechaCorta, formatFechaHora, formatRangoHorario,
  instanteArgentina, minutosEntre,
} from '@/lib/date';
import { pluralizar } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input, Switch } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { GrupoCasillas } from './Chips';
import { AvisoCancelacionWhatsApp } from './MensajesWhatsApp';
import { errorDeHora } from './formulario';
import { useInvalidarAgenda } from './hooks';
import { nombreDeOcupacion, requiereAvisoManual, usaLaApp } from './presentacion';

type Props = {
  clubId: number;
  panel: ClubPanel;
  /** Valores iniciales (día visible y su franja de horarios). */
  inicial: { fecha: string; desde: string; hasta: string };
  hoy: string;
  onClose: () => void;
};

type Paso = 'datos' | 'revision' | 'listo';

const MOTIVOS = ['Lluvia', 'Feriado', 'Torneo', 'Mantenimiento', 'Evento privado'];
const MAXIMO_DIAS = 7;

function unirCanchas(titulos: string[]): string {
  return titulos.length > 1 ? `${titulos.slice(0, -1).join(', ')} y ${titulos[titulos.length - 1]}` : titulos[0] ?? '';
}

export function BloquearModal({ clubId, panel, inicial, hoy, onClose }: Props) {
  const formId = useId();
  const invalidar = useInvalidarAgenda(clubId);
  const activas = useMemo(() => panel.canchas.filter((cancha) => cancha.activa), [panel.canchas]);
  const titulos = useMemo(() => new Map(panel.canchas.map((cancha) => [cancha.id, cancha.titulo])), [panel.canchas]);

  const [paso, setPaso] = useState<Paso>('datos');
  const [canchas, setCanchas] = useState<Set<number>>(() => new Set(activas.map((cancha) => cancha.id)));
  const [fecha, setFecha] = useState(inicial.fecha);
  const [todoElDia, setTodoElDia] = useState(false);
  const [fechaFin, setFechaFin] = useState(inicial.fecha);
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);
  const [conflictos, setConflictos] = useState<Ocupacion[]>([]);
  const [aceptaCancelar, setAceptaCancelar] = useState(false);
  const [resultado, setResultado] = useState<{ bloqueos: number; canceladas: Ocupacion[] } | null>(null);
  const [errorPrevio, setErrorPrevio] = useState<string | null>(null);

  // Período y validaciones (los mismos límites que aplica el servidor).
  const errores: Partial<Record<'canchas' | 'fecha' | 'fechaFin' | 'desde' | 'hasta' | 'motivo', string>> = {};
  if (!canchas.size) errores.canchas = 'Elegí al menos una cancha.';
  if (!esFechaISO(fecha)) errores.fecha = 'Elegí una fecha.';
  if (motivo.trim().length < 2) errores.motivo = 'Escribí el motivo (lo ven los jugadores).';
  let periodo: { inicio: string; fin: string } | null = null;
  if (todoElDia) {
    if (!esFechaISO(fechaFin) || (esFechaISO(fecha) && fechaFin < fecha)) {
      errores.fechaFin = 'Tiene que ser el mismo día o uno posterior.';
    } else if (esFechaISO(fecha) && diferenciaEnDias(fecha, fechaFin) >= MAXIMO_DIAS) {
      errores.fechaFin = `Un bloqueo puede durar hasta ${MAXIMO_DIAS} días.`;
    } else if (esFechaISO(fecha)) {
      periodo = { inicio: instanteArgentina(fecha, '00:00'), fin: instanteArgentina(addDaysToISODate(fechaFin, 1), '00:00') };
    }
  } else {
    const errorDesde = errorDeHora(desde);
    const errorHasta = errorDeHora(hasta);
    if (errorDesde) errores.desde = errorDesde;
    if (errorHasta) errores.hasta = errorHasta;
    if (!errorDesde && !errorHasta && esFechaISO(fecha)) {
      if (desde === hasta) errores.hasta = 'Elegí un horario de fin distinto al de inicio.';
      else {
        const diaFin = hasta < desde ? addDaysToISODate(fecha, 1) : fecha;
        periodo = { inicio: instanteArgentina(fecha, desde), fin: instanteArgentina(diaFin, hasta) };
        if (minutosEntre(periodo.inicio, periodo.fin) < 15) errores.hasta = 'El bloqueo debe durar al menos 15 minutos.';
      }
    }
  }
  const hayErrores = Object.keys(errores).length > 0 || !periodo;
  const mostrar = (campo: keyof typeof errores) => (intento ? errores[campo] ?? null : null);
  const titulosElegidos = activas.filter((cancha) => canchas.has(cancha.id)).map((cancha) => cancha.titulo);
  const textoPeriodo = periodo
    ? todoElDia
      ? fecha === fechaFin ? `todo el ${formatFechaCorta(fecha)}` : `del ${formatFechaCorta(fecha)} al ${formatFechaCorta(fechaFin)}`
      : `${formatFechaCorta(fecha)} de ${desde} a ${hasta}${hasta < desde ? ' (del día siguiente)' : ''}`
    : '';

  const bloquear = useMutation({
    mutationFn: (cancelarReservas: boolean) => clubApi.bloquear({
      clubId,
      canchas: [...canchas],
      inicio: periodo!.inicio,
      fin: periodo!.fin,
      motivo: motivo.trim(),
      cancelarReservas,
    }),
    onSuccess: (respuesta) => {
      setResultado(respuesta);
      setPaso('listo');
      toast.success(respuesta.canceladas.length
        ? `Bloqueo guardado. Se cancelaron ${pluralizar(respuesta.canceladas.length, 'reserva')}.`
        : 'Bloqueo guardado.');
    },
    onSettled: () => {
      void invalidar({ partidos: true });
    },
  });

  const revisar = useMutation({
    mutationFn: () => clubApi.conflictos(clubId, [...canchas], periodo!.inicio, periodo!.fin),
    onSuccess: (lista) => {
      const bloqueos = lista.filter((ocupacion) => ocupacion.tipo === 'bloqueo');
      if (bloqueos.length) {
        const donde = unirCanchas([...new Set(bloqueos.map((ocupacion) => titulos.get(ocupacion.cancha_id) ?? 'Cancha'))]);
        setErrorPrevio(`Ya hay un bloqueo en ese horario (${donde}). Quitalo desde la agenda o elegí otro horario.`);
        return;
      }
      const reservas = lista.filter((ocupacion) => ocupacion.tipo === 'reserva');
      if (!reservas.length) {
        bloquear.mutate(false);
        return;
      }
      setConflictos(reservas);
      setAceptaCancelar(false);
      setPaso('revision');
    },
  });

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setIntento(true);
    setErrorPrevio(null);
    if (hayErrores) return;
    revisar.mutate();
  };

  const ocupado = revisar.isPending || bloquear.isPending;
  const errorServidor = revisar.error ?? bloquear.error;

  const pie = paso === 'datos' ? (
    <>
      <Button variant="secondary" onClick={onClose} disabled={ocupado}>Cancelar</Button>
      <Button type="submit" form={formId} loading={ocupado}>Revisar y bloquear</Button>
    </>
  ) : paso === 'revision' ? (
    <>
      <Button variant="secondary" onClick={() => setPaso('datos')} disabled={bloquear.isPending}>Volver</Button>
      <Button variant="danger" disabled={!aceptaCancelar} loading={bloquear.isPending} onClick={() => bloquear.mutate(true)}>
        Bloquear y cancelar {pluralizar(conflictos.length, 'reserva')}
      </Button>
    </>
  ) : (
    <Button onClick={onClose}>Listo</Button>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={paso === 'listo' ? 'Horario bloqueado' : 'Bloquear canchas'}
      descripcion={paso === 'datos' ? 'Para lluvia, feriados, torneos o mantenimiento. Nadie puede reservar en ese horario.' : textoPeriodo}
      size="md"
      bloqueado={ocupado}
      footer={pie}
    >
      {paso === 'datos' && (
        <form id={formId} onSubmit={enviar} className="space-y-5" noValidate>
          <GrupoCasillas
            legend="Canchas"
            opciones={activas.map((cancha) => ({ value: cancha.id, label: cancha.titulo }))}
            valores={canchas}
            onChange={setCanchas}
            error={mostrar('canchas')}
            extra={(
              <button
                type="button"
                onClick={() => setCanchas(canchas.size === activas.length ? new Set() : new Set(activas.map((cancha) => cancha.id)))}
                className="min-h-9 rounded-lg px-2 text-sm font-semibold text-vb-blue hover:underline"
              >
                {canchas.size === activas.length ? 'Ninguna' : 'Todas'}
              </button>
            )}
          />

          <Switch checked={todoElDia} onChange={setTodoElDia} label="Todo el día" descripcion="Bloquea desde las 00:00 hasta las 24:00." />

          {todoElDia ? (
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" label="Desde el día" value={fecha} min={hoy} error={mostrar('fecha')} onChange={(evento) => {
                setFecha(evento.target.value);
                if (evento.target.value > fechaFin) setFechaFin(evento.target.value);
              }} />
              <Input type="date" label="Hasta el día" value={fechaFin} min={fecha} error={mostrar('fechaFin')} onChange={(evento) => setFechaFin(evento.target.value)} />
            </div>
          ) : (
            <div className="space-y-3">
              <Input type="date" label="Día" value={fecha} min={hoy} error={mostrar('fecha')} onChange={(evento) => setFecha(evento.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="time" step={300} label="Desde" value={desde} error={mostrar('desde')} onChange={(evento) => setDesde(evento.target.value)} />
                <Input
                  type="time"
                  step={300}
                  label="Hasta"
                  value={hasta}
                  error={mostrar('hasta')}
                  hint={hasta && desde && hasta < desde ? 'Termina al día siguiente.' : undefined}
                  onChange={(evento) => setHasta(evento.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <Input
              label="Motivo"
              placeholder="Ej.: Lluvia"
              maxLength={120}
              value={motivo}
              error={mostrar('motivo')}
              hint="Lo ven los jugadores cuyas reservas se cancelen."
              onChange={(evento) => setMotivo(evento.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {MOTIVOS.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => setMotivo(opcion)}
                  className="min-h-9 rounded-full border border-ink/15 px-3 text-sm font-semibold text-ink/70 hover:border-vb-orange-ink hover:text-ink"
                >
                  {opcion}
                </button>
              ))}
            </div>
          </div>

          {periodo && canchas.size > 0 && (
            <p className="rounded-xl bg-ink/[0.04] px-3 py-2 text-sm text-ink/75">
              Vas a bloquear <strong>{unirCanchas(titulosElegidos)}</strong> {textoPeriodo}.
            </p>
          )}
          {errorPrevio && <Aviso tono="error">{errorPrevio}</Aviso>}
          {errorServidor && <Aviso tono="error">{mensajeDeError(errorServidor)}</Aviso>}
        </form>
      )}

      {paso === 'revision' && (
        <div className="space-y-4">
          <Aviso tono="alerta" titulo={`Hay ${pluralizar(conflictos.length, 'reserva')} en ese horario`}>
            Si seguís, se cancelan. A quienes usan la app les avisamos solos; al resto te dejamos el mensaje de WhatsApp listo.
          </Aviso>
          <ul className="divide-y divide-ink/10 rounded-2xl border border-ink/10">
            {conflictos.map((ocupacion) => (
              <li key={ocupacion.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{nombreDeOcupacion(ocupacion)}</p>
                  <p className="text-xs text-ink/65">
                    {titulos.get(ocupacion.cancha_id) ?? 'Cancha'} · {formatFechaCorta(fechaArgentina(ocupacion.inicio))}
                    {' · '}{formatRangoHorario(ocupacion.inicio, ocupacion.fin)}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-ink/65">
                  {usaLaApp(ocupacion) ? 'Usa la app' : 'Sin app'}{Number(ocupacion.pagado) > 0 ? ' · pagó' : ''}
                </span>
              </li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-red-700"
              checked={aceptaCancelar}
              onChange={(evento) => setAceptaCancelar(evento.target.checked)}
            />
            Sí, cancelar {conflictos.length === 1 ? 'esta reserva' : `estas ${conflictos.length} reservas`} y bloquear el horario.
          </label>
          {bloquear.isError && <Aviso tono="error">{mensajeDeError(bloquear.error)}</Aviso>}
        </div>
      )}

      {paso === 'listo' && resultado && (
        <div className="space-y-4">
          <Aviso tono="exito" titulo="Listo">
            Bloqueaste {unirCanchas(titulosElegidos)} {textoPeriodo}.
          </Aviso>
          {resultado.canceladas.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />
                Reservas canceladas
              </h3>
              <ul className="divide-y divide-ink/10 rounded-2xl border border-ink/10">
                {resultado.canceladas.map((ocupacion) => {
                  const cancha = titulos.get(ocupacion.cancha_id) ?? 'Cancha';
                  return (
                    <li key={ocupacion.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{nombreDeOcupacion(ocupacion)}</p>
                        <p className="text-xs text-ink/65">{cancha} · {formatFechaHora(ocupacion.inicio)}</p>
                      </div>
                      {requiereAvisoManual(ocupacion) ? (
                        <AvisoCancelacionWhatsApp ocupacion={ocupacion} club={panel.club} cancha={cancha} hoy={hoy} destacado={false} />
                      ) : usaLaApp(ocupacion) ? (
                        <span className="text-xs font-semibold text-green-800">Le avisamos por la app</span>
                      ) : (
                        <span className="text-xs font-semibold text-ink/65">Sin teléfono: avisale por otro medio</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
