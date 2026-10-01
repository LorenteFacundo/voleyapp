import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { diaSemana, formatFechaLarga, todayArgentinaISO } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { formatTelefono } from '@/lib/telefono';
import { useGestion } from '@/contexts/gestion';
import { montoParaCampo } from '@/features/caja/montos';
import { SelectorOpciones } from '@/features/caja/SelectorOpciones';
import { BuscadorCliente, type ClienteElegido } from '@/features/clientes/BuscadorCliente';
import { useEnfocarAlCambiar } from '@/features/clientes/useEnfocarAlCambiar';
import { useInvalidarGestion } from '@/features/clientes/useInvalidarGestion';
import { avisarFijoCreado } from './avisos';
import { CamposHorario } from './CamposHorario';
import { describirHorario, precioSugerido, proximaFecha, puedeConfirmarFechas, type Horario } from './fijos';
import { horaActualArgentina, validarNuevoFijo, type Errores, type NuevoFijoValido } from './formularios';
import { VistaPreviaFechas } from './VistaPreviaFechas';

type ModoCliente = 'existente' | 'nuevo';

const MODOS_CLIENTE: { valor: ModoCliente; etiqueta: string }[] = [
  { valor: 'existente', etiqueta: 'Ya está en mis clientes' },
  { valor: 'nuevo', etiqueta: 'Cliente nuevo' },
];

/** Alta de un alquiler fijo en dos pasos: datos y revisión de fechas. */
export function NuevoFijoModal({ onClose }: { onClose: () => void }) {
  const { clubId, panel } = useGestion();
  const invalidar = useInvalidarGestion();
  const formId = useId();
  const hoy = todayArgentinaISO();
  const canchas = panel.canchas.filter((cancha) => cancha.activa);

  const [modoCliente, setModoCliente] = useState<ModoCliente>('existente');
  const [cliente, setCliente] = useState<ClienteElegido | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [titulo, setTitulo] = useState('');
  const [horario, setHorario] = useState<Horario>(() => ({
    canchaId: canchas.length === 1 ? canchas[0].id : null,
    dia: diaSemana(hoy),
    hora: '19:00',
    duracion: 60,
  }));
  // null = usar el valor sugerido (precio publicado / próxima fecha del día).
  const [precio, setPrecio] = useState<string | null>(null);
  const [desde, setDesde] = useState<string | null>(null);
  const [hasta, setHasta] = useState('');
  const [notas, setNotas] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [revision, setRevision] = useState<NuevoFijoValido | null>(null);
  const [omitir, setOmitir] = useState(false);
  const contenidoRef = useEnfocarAlCambiar(revision !== null);

  const vistaPrevia = useMutation({
    mutationFn: (datos: Parameters<typeof clubApi.previsualizarSerie>[0]) => clubApi.previsualizarSerie(datos),
  });
  const crear = useMutation({
    mutationFn: (datos: Parameters<typeof clubApi.crearSerie>[0]) => clubApi.crearSerie(datos),
    onSuccess: () => invalidar(revision?.clienteId),
  });

  const sugerido = precioSugerido(panel.horarios, horario);
  const precioCampo = precio ?? (sugerido !== null ? montoParaCampo(sugerido) : '');
  const desdeCampo = desde ?? proximaFecha(horario.dia, hoy, horario.hora, horaActualArgentina());
  const nombreCliente = modoCliente === 'existente' ? cliente?.nombre : nuevoNombre.trim();

  function revisar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const { datos, errores: nuevos } = validarNuevoFijo({
      cliente: modoCliente === 'existente'
        ? { modo: 'existente', id: cliente?.id ?? null }
        : { modo: 'nuevo', nombre: nuevoNombre, telefono: nuevoTelefono },
      titulo,
      horario,
      precio: precioCampo,
      desde: desdeCampo,
      hasta,
      notas,
    }, hoy);
    setErrores(nuevos);
    if (!datos) return;
    vistaPrevia.mutate({
      clubId,
      canchaId: datos.canchaId,
      diaSemana: datos.dia,
      horaInicio: datos.hora,
      duracionMin: datos.duracion,
      desde: datos.desde,
      hasta: datos.hasta,
    }, {
      onSuccess: () => {
        setOmitir(false);
        setRevision(datos);
      },
      onError: (error) => toast.error(mensajeDeError(error)),
    });
  }

  function crearFijo() {
    if (!revision) return;
    crear.mutate({
      clubId,
      canchaId: revision.canchaId,
      titulo: revision.titulo,
      diaSemana: revision.dia,
      horaInicio: revision.hora,
      duracionMin: revision.duracion,
      desde: revision.desde,
      hasta: revision.hasta,
      precio: revision.precio,
      clienteId: revision.clienteId,
      clienteNombre: revision.clienteNombre,
      clienteTelefono: revision.clienteTelefono,
      notas: revision.notas,
      omitirConflictos: omitir,
    }, {
      onSuccess: (resultado) => {
        avisarFijoCreado(resultado);
        onClose();
      },
      onError: (error) => toast.error(mensajeDeError(error)),
    });
  }

  const ocupado = vistaPrevia.isPending || crear.isPending;
  let contenido: ReactNode;
  let pie: ReactNode;

  if (revision && vistaPrevia.data) {
    const nombreCancha = canchas.find((cancha) => cancha.id === revision.canchaId)?.titulo ?? 'Cancha';
    contenido = (
      <div className="space-y-4">
        <dl className="grid gap-3 rounded-2xl bg-ink/[0.03] p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink/65">Fijo</dt>
            <dd className="font-semibold text-ink">{revision.titulo || nombreCliente}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/65">Cliente</dt>
            <dd className="text-ink">
              {nombreCliente}
              {revision.clienteTelefono && ` · ${formatTelefono(revision.clienteTelefono)}`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink/65">Horario</dt>
            <dd className="text-ink">{describirHorario(revision.dia, revision.hora, revision.duracion)} · {nombreCancha}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/65">Precio por turno</dt>
            <dd className="text-ink">{formatMoney(revision.precio)}</dd>
          </div>
        </dl>
        <VistaPreviaFechas
          vista={vistaPrevia.data}
          desde={revision.desde}
          hasta={revision.hasta}
          omitir={omitir}
          onOmitir={setOmitir}
        />
      </div>
    );
    pie = (
      <>
        <Button variant="secondary" onClick={() => setRevision(null)} disabled={ocupado}>Volver</Button>
        <Button onClick={crearFijo} loading={crear.isPending} disabled={!puedeConfirmarFechas(vistaPrevia.data, omitir, revision.desde)}>
          Crear fijo
        </Button>
      </>
    );
  } else {
    contenido = (
      <form id={formId} onSubmit={revisar} noValidate className="space-y-5">
        {canchas.length === 0 && (
          <Aviso tono="alerta">No hay canchas activas. Activá o cargá una cancha en Ajustes para crear fijos.</Aviso>
        )}
        <div className="space-y-3">
          <SelectorOpciones legend="¿Quién alquila?" opciones={MODOS_CLIENTE} valor={modoCliente} onChange={setModoCliente} />
          {modoCliente === 'existente' ? (
            <BuscadorCliente
              valor={cliente}
              onChange={setCliente}
              etiqueta="Buscar cliente"
              error={errores.cliente}
              enfocar
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nombre del cliente"
                value={nuevoNombre}
                onChange={(evento) => setNuevoNombre(evento.target.value)}
                maxLength={120}
                autoComplete="off"
                error={errores.clienteNombre}
                data-autofocus
              />
              <Input
                label="Teléfono (opcional)"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={nuevoTelefono}
                onChange={(evento) => setNuevoTelefono(evento.target.value)}
                error={errores.clienteTelefono}
                hint="Si ya tenés un cliente con ese teléfono, se lo asignamos."
              />
            </div>
          )}
        </div>

        <Input
          label="Nombre del fijo (opcional)"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          maxLength={120}
          autoComplete="off"
          placeholder={nombreCliente || 'Por ejemplo: Los del martes'}
          error={errores.titulo}
          hint="Si lo dejás vacío, usamos el nombre del cliente."
        />

        <CamposHorario valor={horario} onChange={setHorario} errores={errores} canchas={canchas} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Precio por turno"
            inputMode="decimal"
            autoComplete="off"
            value={precioCampo}
            onChange={(evento) => setPrecio(evento.target.value)}
            error={errores.precio}
            hint={sugerido !== null ? `Publicado para ese horario: ${formatMoney(sugerido)}.` : 'En pesos.'}
          />
          <Input
            type="date"
            label="Empieza"
            min={hoy}
            value={desdeCampo}
            onChange={(evento) => setDesde(evento.target.value)}
            error={errores.desde}
            hint={desde === null ? `El ${formatFechaLarga(desdeCampo)}.` : undefined}
          />
          <Input
            type="date"
            label="Termina (opcional)"
            min={desdeCampo}
            value={hasta}
            onChange={(evento) => setHasta(evento.target.value)}
            error={errores.hasta}
            hint="Vacío: sigue hasta que lo termines."
          />
        </div>

        <Textarea
          label="Notas (opcional)"
          value={notas}
          onChange={(evento) => setNotas(evento.target.value)}
          maxLength={500}
          rows={2}
          error={errores.notas}
        />
      </form>
    );
    pie = (
      <>
        <Button variant="secondary" onClick={onClose} disabled={ocupado}>Cancelar</Button>
        <Button type="submit" form={formId} loading={vistaPrevia.isPending} disabled={canchas.length === 0}>
          Revisar fechas
        </Button>
      </>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={revision ? 'Revisá las fechas' : 'Nuevo fijo'}
      descripcion={revision ? 'Antes de crear el fijo, mirá qué fechas se reservan.' : 'Un turno que se repite todas las semanas.'}
      size="lg"
      bloqueado={ocupado}
      footer={pie}
    >
      <div ref={contenidoRef} tabIndex={-1} className="outline-none">{contenido}</div>
    </Modal>
  );
}
