import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi, type DatosCancha } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import type { CanchaGestion } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Input, Select, Switch, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatMoney } from '@/lib/format';
import { parsearMonto, type ErroresFormulario } from './club';
import { formCanchaDesde, SUPERFICIES, validarCancha, type FormCancha } from './canchas';
import { FotosCancha } from './FotosCancha';

type Props = {
  clubId: number;
  /** null para crear una cancha nueva. */
  cancha: CanchaGestion | null;
  ordenNueva: number;
  onClose: () => void;
  /** Para ofrecer cargar los horarios de una cancha recién creada. */
  onIrAHorarios: (canchaId: number) => void;
};

function vistaMonto(texto: string): string | null {
  const valor = parsearMonto(texto);
  return valor !== null && !Number.isNaN(valor) && texto.trim() ? `= ${formatMoney(valor)}` : null;
}

export function CanchaModal({ clubId, cancha, ordenNueva, onClose, onIrAHorarios }: Props) {
  const [form, setForm] = useState<FormCancha>(() => formCanchaDesde(cancha, ordenNueva));
  const [fotos, setFotos] = useState<string[]>(cancha?.fotos ?? []);
  const [subiendo, setSubiendo] = useState(0);
  const [errores, setErrores] = useState<ErroresFormulario<FormCancha>>({});
  const queryClient = useQueryClient();
  const formId = useId();

  const guardar = useMutation({
    mutationFn: (datos: DatosCancha) => clubApi.guardarCancha(datos),
    onSuccess: (guardada) => {
      if (cancha) toast.success('Cancha actualizada.');
      else {
        toast.success(`Creaste ${guardada.titulo}. Ahora cargale los horarios que se pueden reservar.`, {
          action: { label: 'Cargar horarios', onClick: () => onIrAHorarios(guardada.id) },
        });
      }
      void queryClient.invalidateQueries({ queryKey: claves.gestion(clubId) });
      void queryClient.invalidateQueries({ queryKey: claves.catalogo });
      void queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
      onClose();
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  function editar<K extends keyof FormCancha>(campo: K, valor: FormCancha[K]) {
    setForm((previo) => ({ ...previo, [campo]: valor }));
    if (errores[campo]) setErrores((previos) => ({ ...previos, [campo]: undefined }));
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const { datos, errores: nuevos } = validarCancha(form);
    setErrores(nuevos);
    if (!datos) return;
    guardar.mutate({ ...datos, clubId, id: cancha?.id ?? null, fotos });
  }

  const ocupado = guardar.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      bloqueado={ocupado}
      size="lg"
      title={cancha ? `Editar ${cancha.titulo}` : 'Nueva cancha'}
      descripcion={cancha ? undefined : 'Después de crearla, cargá sus horarios para que se pueda reservar.'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={ocupado}>Cancelar</Button>
          <Button type="submit" form={formId} loading={ocupado} disabled={subiendo > 0}>
            {subiendo > 0 ? 'Subiendo fotos…' : cancha ? 'Guardar cambios' : 'Crear cancha'}
          </Button>
        </>
      )}
    >
      <form id={formId} onSubmit={enviar} noValidate>
        <fieldset disabled={ocupado} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Input
            label="Nombre"
            required
            maxLength={80}
            className="sm:col-span-2"
            hint="Por ejemplo: Cancha 1, Cancha de arena, Central."
            value={form.titulo}
            error={errores.titulo}
            onChange={(evento) => editar('titulo', evento.target.value)}
            data-autofocus
          />
          <Textarea
            label="Descripción (opcional)"
            rows={3}
            maxLength={1000}
            className="sm:col-span-2"
            hint="Medidas, iluminación, red, qué la hace especial."
            value={form.descripcion}
            error={errores.descripcion}
            onChange={(evento) => editar('descripcion', evento.target.value)}
          />
          <Input
            label="Precio de referencia"
            inputMode="numeric"
            placeholder="30.000"
            hint={vistaMonto(form.precio)
              ?? 'Se usa para sugerir el precio de las reservas que cargues a mano fuera de los horarios publicados.'}
            value={form.precio}
            error={errores.precio}
            onChange={(evento) => editar('precio', evento.target.value)}
          />
          <Input
            label="Seña de referencia (opcional)"
            inputMode="numeric"
            placeholder="10.000"
            hint={vistaMonto(form.sena) ?? 'La seña sugerida para esas reservas.'}
            value={form.sena}
            error={errores.sena}
            onChange={(evento) => editar('sena', evento.target.value)}
          />
          <p className="text-xs text-ink/65 sm:col-span-2">
            Los precios que pagan los jugadores en cada horario se definen en la sección Horarios.
          </p>
          <Select
            label="Superficie"
            value={form.superficie}
            onChange={(evento) => editar('superficie', evento.target.value as FormCancha['superficie'])}
          >
            <option value="">Sin especificar</option>
            {SUPERFICIES.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
          </Select>
          <Input
            label="Orden"
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            step={1}
            hint="Las canchas se muestran de menor a mayor."
            value={form.orden}
            error={errores.orden}
            onChange={(evento) => editar('orden', evento.target.value)}
          />
          <div className="space-y-4 rounded-xl bg-ink/[0.03] p-3 sm:col-span-2">
            <Switch
              checked={form.techada}
              onChange={(valor) => editar('techada', valor)}
              label="Techada"
              descripcion={form.techada ? 'Se juega aunque llueva.' : 'Al aire libre.'}
            />
            <Switch
              checked={form.activa}
              onChange={(valor) => editar('activa', valor)}
              label="Activa"
              descripcion={form.activa
                ? 'Se muestra a los jugadores y se puede reservar.'
                : 'No se muestra a los jugadores. Las reservas que ya tiene no se cancelan.'}
            />
          </div>
          <div className="sm:col-span-2">
            <FotosCancha
              clubId={clubId}
              fotos={fotos}
              setFotos={setFotos}
              subiendo={subiendo}
              setSubiendo={setSubiendo}
              deshabilitado={ocupado}
            />
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
