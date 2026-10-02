import { useId, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import type { ClubConfig, ClubPanel } from '@/api/tipos';
import { Select, Switch, Textarea } from '@/components/ui/Input';
import { useGestion } from '@/contexts/gestion';
import { Apartado } from './Apartado';
import { BarraGuardar } from './BarraGuardar';
import {
  etiquetaAnticipacion, etiquetaCancelacion, etiquetaRespuesta, etiquetaVentana, formReservasDesde, OPCIONES_ANTICIPACION,
  OPCIONES_CANCELACION, OPCIONES_RESPUESTA, OPCIONES_VENTANA, opcionesConActual, payloadReservas,
  type ErroresFormulario, type FormReservas, type Opcion,
} from './club';
import { Publicacion } from './Publicacion';
import type { IrASeccion } from './secciones';
import { useAvisoSalida, useCambios } from './useCambios';

function opciones(lista: Opcion[]) {
  return lista.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>);
}

/** Publicación del club y reglas para reservar. */
export function SeccionReservas({ irA }: { irA: IrASeccion }) {
  const { clubId, panel } = useGestion();
  const club = panel.club;
  const base = useMemo(() => formReservasDesde(club), [club]);
  const { valores, editados, hayCambios, cambiar, descartar } = useCambios(base);
  const [errores, setErrores] = useState<ErroresFormulario<FormReservas>>({});
  const queryClient = useQueryClient();
  const formId = useId();
  useAvisoSalida(hayCambios);

  const guardar = useMutation({
    mutationFn: (datos: Partial<ClubConfig>) => clubApi.actualizarClub(clubId, datos),
    onSuccess: (actualizado) => {
      queryClient.setQueryData<ClubPanel>(claves.panel(clubId), (previo) => (previo ? { ...previo, club: actualizado } : previo));
      descartar();
      setErrores({});
      toast.success('Reglas de reserva guardadas.');
      void queryClient.invalidateQueries({ queryKey: claves.gestion(clubId) });
      void queryClient.invalidateQueries({ queryKey: claves.catalogo });
      void queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const { datos, errores: nuevos } = payloadReservas(valores, editados, club);
    setErrores(nuevos);
    if (Object.keys(nuevos).length) {
      toast.error('Revisá los campos marcados.');
      return;
    }
    if (!Object.keys(datos).length) {
      descartar();
      return;
    }
    guardar.mutate(datos);
  }

  const numero = (campo: Exclude<keyof FormReservas, 'politicas' | 'confirmacion_automatica'>) => ({
    value: valores[campo],
    onChange: (evento: { target: { value: string } }) => cambiar(campo, Number(evento.target.value)),
  });

  return (
    <div className="space-y-5">
      <Publicacion irA={irA} />

      <form id={formId} onSubmit={enviar} noValidate>
        <fieldset disabled={guardar.isPending} className="min-w-0 space-y-5">
          <Apartado titulo="Cómo se confirman los pedidos">
            <div className="space-y-5">
              <Switch
                checked={valores.confirmacion_automatica}
                onChange={(valor) => cambiar('confirmacion_automatica', valor)}
                label="Confirmación automática"
                descripcion={(
                  <>
                    <span className="block">
                      Activada: si el horario está libre, el pedido que hace un jugador desde la app queda confirmado al instante.
                    </span>
                    <span className="mt-1 block">
                      Desactivada: cada pedido queda pendiente hasta que lo confirmes o rechaces desde la Agenda; mientras tanto,
                      el horario queda apartado para esa persona.
                    </span>
                  </>
                )}
              />
              <Select
                label="Tiempo para responder pedidos"
                disabled={valores.confirmacion_automatica}
                hint={valores.confirmacion_automatica
                  ? 'Solo se usa cuando confirmás los pedidos a mano.'
                  : 'Si no respondés en ese plazo, el pedido vence y el horario se libera. Siempre vence 15 minutos antes del turno.'}
                {...numero('respuesta_horas')}
              >
                {opciones(opcionesConActual(OPCIONES_RESPUESTA, valores.respuesta_horas, etiquetaRespuesta))}
              </Select>
            </div>
          </Apartado>

          <Apartado titulo="Reglas para reservar" descripcion="Valen para los pedidos desde la app. En la Agenda podés cargar cualquier reserva a mano.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Anticipación mínima" hint="Cuánto antes del turno se puede pedir." {...numero('anticipacion_minima_min')}>
                {opciones(opcionesConActual(OPCIONES_ANTICIPACION, valores.anticipacion_minima_min, etiquetaAnticipacion))}
              </Select>
              <Select label="Ventana de reserva" hint="Con cuántos días de anticipación se puede pedir." {...numero('ventana_reserva_dias')}>
                {opciones(opcionesConActual(OPCIONES_VENTANA, valores.ventana_reserva_dias, etiquetaVentana))}
              </Select>
              <Select
                label="Cancelación sin contactar al club"
                hint="Hasta cuándo el jugador puede cancelar una reserva confirmada desde la app. Después tiene que escribirte."
                className="sm:col-span-2"
                {...numero('cancelacion_horas')}
              >
                {opciones(opcionesConActual(OPCIONES_CANCELACION, valores.cancelacion_horas, etiquetaCancelacion))}
              </Select>
              <Textarea
                label="Políticas del club (opcional)"
                rows={4}
                maxLength={1500}
                className="sm:col-span-2"
                value={valores.politicas}
                error={errores.politicas}
                onChange={(evento) => cambiar('politicas', evento.target.value)}
                hint={`Se muestran en la página del club. Por ejemplo: tolerancia de llegada, qué pasa si llueve o si se devuelve la seña. ${valores.politicas.length}/1500`}
              />
            </div>
          </Apartado>
        </fieldset>

        <BarraGuardar
          visible={hayCambios}
          mensaje="Tenés cambios sin guardar en las reglas de reserva."
          guardando={guardar.isPending}
          onDescartar={() => { descartar(); setErrores({}); }}
          formId={formId}
        />
      </form>
    </div>
  );
}
