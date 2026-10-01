import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { Serie } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { fechaArgentina, formatFechaLarga, todayArgentinaISO } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { useGestion } from '@/contexts/gestion';
import { montoParaCampo, parsearMonto } from '@/features/caja/montos';
import { useEnfocarAlCambiar } from '@/features/clientes/useEnfocarAlCambiar';
import { useInvalidarGestion } from '@/features/clientes/useInvalidarGestion';
import { limpiarTexto } from '@/features/clientes/validacion';
import { avisarFijoModificado } from './avisos';
import { CamposHorario } from './CamposHorario';
import { cambiaHorario, describirHorario, puedeConfirmarFechas, type Horario } from './fijos';
import { validarCambiosFijo, type CambiosFijoValidos, type Errores } from './formularios';
import { VistaPreviaFechas } from './VistaPreviaFechas';

/**
 * Cambia un fijo desde una fecha. Si cambia el horario, se revisan los
 * choques antes de guardar (como al crearlo).
 */
export function ModificarFijoModal({ serie, onClose }: { serie: Serie; onClose: () => void }) {
  const { clubId, panel } = useGestion();
  const invalidar = useInvalidarGestion();
  const formId = useId();
  const hoy = todayArgentinaISO();
  const original: Horario = {
    canchaId: serie.cancha.id, dia: serie.dia_semana, hora: serie.hora_inicio, duracion: serie.duracion_min,
  };
  // La cancha actual se ofrece aunque esté desactivada, para no cambiarla sin querer.
  const canchas = panel.canchas.filter((cancha) => cancha.activa || cancha.id === serie.cancha.id);

  const [desdeFecha, setDesdeFecha] = useState(serie.proxima ? fechaArgentina(serie.proxima) : hoy);
  const [horario, setHorario] = useState<Horario>(original);
  const [precio, setPrecio] = useState(montoParaCampo(Number(serie.precio)));
  const [titulo, setTitulo] = useState(serie.titulo);
  const [hasta, setHasta] = useState(serie.hasta ?? '');
  const [errores, setErrores] = useState<Errores>({});
  const [revision, setRevision] = useState<CambiosFijoValidos | null>(null);
  const [omitir, setOmitir] = useState(false);
  const contenidoRef = useEnfocarAlCambiar(revision !== null);

  const reprograma = cambiaHorario(original, horario);
  const sinCambios = !reprograma
    && parsearMonto(precio) === Number(serie.precio)
    && limpiarTexto(titulo) === serie.titulo
    && (hasta || null) === serie.hasta;

  const vistaPrevia = useMutation({
    mutationFn: (datos: Parameters<typeof clubApi.previsualizarSerie>[0]) => clubApi.previsualizarSerie(datos),
  });
  const modificar = useMutation({
    mutationFn: (datos: Parameters<typeof clubApi.modificarSerie>[0]) => clubApi.modificarSerie(datos),
    onSuccess: () => invalidar(serie.cliente?.id),
  });

  function guardar(cambios: CambiosFijoValidos, omitirConflictos: boolean) {
    modificar.mutate({
      serieId: serie.id,
      desdeFecha: cambios.desdeFecha,
      canchaId: cambios.canchaId,
      diaSemana: cambios.dia,
      horaInicio: cambios.hora,
      duracionMin: cambios.duracion,
      precio: cambios.precio,
      titulo: cambios.titulo,
      hasta: cambios.hasta,
      omitirConflictos,
    }, {
      onSuccess: (resultado) => {
        avisarFijoModificado(resultado, reprograma, cambios.desdeFecha);
        onClose();
      },
      onError: (error) => toast.error(mensajeDeError(error)),
    });
  }

  function continuar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const { datos, errores: nuevos } = validarCambiosFijo({ desdeFecha, horario, precio, titulo, hasta }, hoy);
    setErrores(nuevos);
    if (!datos) return;
    if (!reprograma) {
      guardar(datos, false);
      return;
    }
    vistaPrevia.mutate({
      clubId,
      canchaId: datos.canchaId,
      diaSemana: datos.dia,
      horaInicio: datos.hora,
      duracionMin: datos.duracion,
      desde: datos.desdeFecha,
      hasta: datos.hasta,
      excluirSerie: serie.id,
    }, {
      onSuccess: () => {
        setOmitir(false);
        setRevision(datos);
      },
      onError: (error) => toast.error(mensajeDeError(error)),
    });
  }

  const ocupado = vistaPrevia.isPending || modificar.isPending;
  let contenido: ReactNode;
  let pie: ReactNode;

  if (revision && vistaPrevia.data) {
    const nombreCancha = canchas.find((cancha) => cancha.id === revision.canchaId)?.titulo ?? 'Cancha';
    contenido = (
      <div className="space-y-4">
        <p className="rounded-2xl bg-ink/[0.03] p-4 text-sm text-ink">
          Desde el <strong>{formatFechaLarga(revision.desdeFecha)}</strong>, «{revision.titulo}» pasa a{' '}
          <strong>{describirHorario(revision.dia, revision.hora, revision.duracion)}</strong> en {nombreCancha},
          a {formatMoney(revision.precio)} por turno. Las fechas anteriores no cambian.
        </p>
        <VistaPreviaFechas
          vista={vistaPrevia.data}
          desde={revision.desdeFecha}
          hasta={revision.hasta}
          omitir={omitir}
          onOmitir={setOmitir}
        />
      </div>
    );
    pie = (
      <>
        <Button variant="secondary" onClick={() => setRevision(null)} disabled={ocupado}>Volver</Button>
        <Button
          onClick={() => guardar(revision, omitir)}
          loading={modificar.isPending}
          disabled={!puedeConfirmarFechas(vistaPrevia.data, omitir, revision.desdeFecha)}
        >
          Guardar cambios
        </Button>
      </>
    );
  } else {
    contenido = (
      <form id={formId} onSubmit={continuar} noValidate className="space-y-5">
        <Aviso tono="info">
          Los cambios se aplican desde la fecha que elijas; las fechas anteriores no se tocan. Si alguna fecha
          futura ya está cobrada, primero registrá la devolución o movela desde la agenda.
        </Aviso>
        <Input
          type="date"
          label="Aplicar desde"
          min={hoy}
          value={desdeFecha}
          onChange={(evento) => setDesdeFecha(evento.target.value)}
          error={errores.desdeFecha}
          hint={serie.proxima ? `La próxima fecha del fijo es el ${formatFechaLarga(fechaArgentina(serie.proxima))}.` : undefined}
          className="sm:max-w-[50%] sm:pr-2"
          data-autofocus
        />
        <Input
          label="Nombre del fijo"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          maxLength={120}
          autoComplete="off"
          error={errores.titulo}
        />
        <CamposHorario valor={horario} onChange={setHorario} errores={errores} canchas={canchas} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Precio por turno"
            inputMode="decimal"
            autoComplete="off"
            value={precio}
            onChange={(evento) => setPrecio(evento.target.value)}
            error={errores.precio}
            hint="Se actualiza en las fechas que todavía no se cobraron."
          />
          <Input
            type="date"
            label="Termina (opcional)"
            min={desdeFecha}
            value={hasta}
            onChange={(evento) => setHasta(evento.target.value)}
            error={errores.hasta}
            hint="Si la adelantás, se liberan las fechas posteriores."
          />
        </div>
        {reprograma && (
          <p className="text-sm text-ink/70">
            Cambiaste el horario: antes de guardar te mostramos qué fechas se reservan y si chocan con otras reservas.
          </p>
        )}
      </form>
    );
    pie = (
      <>
        <Button variant="secondary" onClick={onClose} disabled={ocupado}>Cancelar</Button>
        <Button type="submit" form={formId} loading={ocupado} disabled={sinCambios}>
          {reprograma ? 'Revisar fechas' : 'Guardar cambios'}
        </Button>
      </>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={revision ? 'Revisá las fechas' : 'Modificar fijo'}
      descripcion={serie.titulo}
      size="lg"
      bloqueado={ocupado}
      footer={pie}
    >
      <div ref={contenidoRef} tabIndex={-1} className="outline-none">{contenido}</div>
    </Modal>
  );
}
