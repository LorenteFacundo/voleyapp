import { useId, useState, type ClipboardEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi } from '@/api/admin';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import type { InvitacionCreada } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { separarCoordenadas, type ErroresFormulario } from '@/features/ajustes/club';
import { EnlaceInvitacion } from '@/features/ajustes/EnlaceInvitacion';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { FormInvitar } from '@/features/ajustes/FormInvitar';
import { FORM_NUEVO_CLUB_VACIO, validarNuevoClub, type DatosNuevoClub, type FormNuevoClub } from './nuevoClub';

type Props = {
  /** Datos para empezar (por ejemplo, los de un club interesado). */
  inicial?: Partial<FormNuevoClub>;
  onClose: () => void;
};

type Creado = { id: number; nombre: string; slug: string };

/** Alta de un club y, enseguida, la invitación a su dueño. */
export function NuevoClubModal({ inicial, onClose }: Props) {
  const [form, setForm] = useState<FormNuevoClub>({ ...FORM_NUEVO_CLUB_VACIO, ...inicial });
  const [errores, setErrores] = useState<ErroresFormulario<FormNuevoClub>>({});
  const [creado, setCreado] = useState<Creado | null>(null);
  const [invitacion, setInvitacion] = useState<InvitacionCreada | null>(null);
  const queryClient = useQueryClient();
  const formId = useId();

  const crear = useMutation({
    mutationFn: (datos: DatosNuevoClub) => adminApi.crearClub(datos),
    onSuccess: (resultado, datos) => {
      setCreado({ id: resultado.club_id, nombre: datos.nombre, slug: resultado.slug });
      toast.success(`Creaste ${datos.nombre}.`);
      void queryClient.invalidateQueries({ queryKey: claves.admin });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  function editar(campo: keyof FormNuevoClub, valor: string) {
    setForm((previo) => ({ ...previo, [campo]: valor }));
    if (errores[campo]) setErrores((previos) => ({ ...previos, [campo]: undefined }));
  }

  // Lo que se copia de Google Maps ("-34.6037, -58.3816") completa los dos campos.
  function pegarCoordenadas(evento: ClipboardEvent<HTMLInputElement>) {
    const par = separarCoordenadas(evento.clipboardData.getData('text'));
    if (!par) return;
    evento.preventDefault();
    setForm((previo) => ({ ...previo, latitud: par[0], longitud: par[1] }));
    setErrores((previos) => ({ ...previos, latitud: undefined, longitud: undefined }));
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const { datos, errores: nuevos } = validarNuevoClub(form);
    setErrores(nuevos);
    if (datos) crear.mutate(datos);
  }

  const campo = (nombre: keyof FormNuevoClub) => ({
    value: form[nombre],
    error: errores[nombre],
    onChange: (evento: { target: { value: string } }) => editar(nombre, evento.target.value),
  });

  if (creado) {
    return (
      <Modal
        key="creado"
        open
        onClose={onClose}
        title={invitacion ? 'Invitación para el dueño' : `${creado.nombre} ya está creado`}
        footer={(
          <>
            <Link to={`/gestion/${creado.id}/ajustes`} className={clasesBoton({ variant: 'secondary' })}>Configurar el club</Link>
            <Button onClick={onClose}>{invitacion ? 'Listo' : 'Invitar más tarde'}</Button>
          </>
        )}
      >
        {invitacion ? (
          <EnlaceInvitacion invitacion={invitacion} clubNombre={creado.nombre} />
        ) : (
          <div className="space-y-4">
            <Aviso tono="exito">
              El club quedó sin publicar, con el enlace /club/{creado.slug}. Invitá a su dueño para que cargue canchas y horarios,
              o configuralo vos desde su panel.
            </Aviso>
            <FormInvitar clubId={creado.id} rolFijo="dueno" onCreada={setInvitacion} enfocar />
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      key="alta"
      open
      onClose={onClose}
      bloqueado={crear.isPending}
      size="lg"
      title="Nuevo club"
      descripcion="Se crea sin publicar. Después el dueño completa canchas, horarios y datos."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={crear.isPending}>Cancelar</Button>
          <Button type="submit" form={formId} loading={crear.isPending}>Crear club</Button>
        </>
      )}
    >
      <form id={formId} onSubmit={enviar} noValidate>
        <fieldset disabled={crear.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Input label="Nombre del club" required maxLength={120} className="sm:col-span-2" data-autofocus {...campo('nombre')} />
          <Input label="Zona (opcional)" maxLength={80} hint="Barrio o localidad." {...campo('zona')} />
          <Input label="Dirección (opcional)" maxLength={200} {...campo('direccion')} />
          <Input
            label="Latitud (opcional)"
            inputMode="decimal"
            hint="Podés pegar las dos coordenadas juntas, como las copia Google Maps."
            {...campo('latitud')}
            onPaste={pegarCoordenadas}
          />
          <Input label="Longitud (opcional)" inputMode="decimal" {...campo('longitud')} onPaste={pegarCoordenadas} />
          <Input label="WhatsApp (opcional)" type="tel" inputMode="tel" hint="Con código de área, por ejemplo 11 2233-4455." {...campo('whatsapp')} />
          <Input label="Teléfono (opcional)" type="tel" inputMode="tel" {...campo('telefono')} />
        </fieldset>
      </form>
    </Modal>
  );
}
