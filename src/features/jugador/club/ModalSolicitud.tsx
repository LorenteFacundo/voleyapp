import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { BloqueDisponible, CanchaPublica, ClubPublico, ConfigPartido, ResultadoSolicitud } from '@/api/tipos';
import { jugadorApi } from '@/api/jugador';
import { claves } from '@/api/claves';
import { mensajeDeError } from '@/api/cliente';
import { useAuth } from '@/contexts/auth';
import { rutaIngreso } from '@/lib/navigation';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Modal } from '@/components/ui/Modal';
import { Switch, Textarea } from '@/components/ui/Input';
import { CamposPartido } from '@/features/partidos/CamposPartido';
import {
  formularioPartidoInicial, validarFormularioPartido, type ErroresPartido, type FormularioPartido,
} from '@/features/partidos/formulario';
import { AvisoOperacion } from '../AvisoOperacion';
import { clasesBoton } from '@/components/ui/estilosBoton';
import { claseEnlace } from '../estilos';
import { usePuedeReservar } from '../usePuedeReservar';
import { ResultadoPedido } from './ResultadoPedido';
import { ResumenTurno } from './ResumenTurno';

const MAX_NOTA = 300;

/**
 * Pedido de un horario libre. Se monta con key por bloque: el formulario y
 * el resultado viven acá y se descartan al elegir otro horario.
 */
export function ModalSolicitud({
  club, cancha, bloque, onCerrar,
}: { club: ClubPublico; cancha: CanchaPublica; bloque: BloqueDisponible; onCerrar: () => void }) {
  const { session, perfil } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { puede, situacion } = usePuedeReservar();
  const idFormulario = useId();
  const [nota, setNota] = useState('');
  const [organizar, setOrganizar] = useState(false);
  const [partido, setPartido] = useState<FormularioPartido>(() => formularioPartidoInicial(cancha.superficie));
  const [errores, setErrores] = useState<ErroresPartido>({});
  const [resultado, setResultado] = useState<ResultadoSolicitud | null>(null);

  const solicitar = useMutation({
    mutationFn: jugadorApi.solicitarReserva,
    onSuccess: (datos) => {
      setResultado(datos);
      void queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
      void queryClient.invalidateQueries({ queryKey: claves.reservas });
      void queryClient.invalidateQueries({ queryKey: claves.partidos });
    },
    onError: (error) => {
      toast.error(mensajeDeError(error));
      // Si alguien lo tomó recién, la grilla se actualiza y lo muestra ocupado.
      void queryClient.invalidateQueries({ queryKey: claves.disponibilidad });
    },
  });

  const rutaRegreso = `/club/${club.slug}?cancha=${bloque.cancha_id}&fecha=${bloque.fecha}&bloque=${bloque.horario_id}`;
  const libre = bloque.estado === 'libre';
  const esMio = bloque.estado === 'mi_solicitud' || bloque.estado === 'mi_reserva';

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!puede || solicitar.isPending) return;
    let config: ConfigPartido | null = null;
    if (organizar) {
      const validacion = validarFormularioPartido(partido, { precioTotal: bloque.precio, anotados: 1 });
      setErrores(validacion.errores);
      if (!validacion.config) {
        toast.error('Revisá los datos del partido.');
        return;
      }
      config = validacion.config;
    }
    solicitar.mutate({ horarioId: bloque.horario_id, fecha: bloque.fecha, partido: config, nota: nota.trim() || null });
  }

  let titulo = 'Pedir esta cancha';
  if (resultado) titulo = resultado.estado === 'confirmada' ? '¡Reserva confirmada!' : '¡Pedido enviado!';
  else if (esMio) titulo = 'Ya tenés este horario';
  else if (!libre) titulo = 'Este horario ya no está libre';

  let pie;
  if (resultado) {
    pie = (
      <>
        <Link to="/mis-reservas" className={clasesBoton({ variant: 'secondary' })}>Ver mis reservas</Link>
        <Button onClick={onCerrar}>Listo</Button>
      </>
    );
  } else if (!libre) {
    pie = <Button variant="secondary" onClick={onCerrar}>{esMio ? 'Cerrar' : 'Elegir otro horario'}</Button>;
  } else if (!session) {
    pie = (
      <>
        <Button variant="secondary" onClick={onCerrar}>Volver</Button>
        <Button onClick={() => navigate(rutaIngreso(rutaRegreso))}>
          <LogIn size={17} aria-hidden="true" /> Ingresar para pedir
        </Button>
      </>
    );
  } else {
    pie = (
      <>
        <Button variant="secondary" onClick={onCerrar} disabled={solicitar.isPending}>Cancelar</Button>
        <Button type="submit" form={idFormulario} loading={solicitar.isPending} disabled={!puede}>
          {!solicitar.isPending && <Send size={17} aria-hidden="true" />}
          {club.confirmacion_automatica ? 'Reservar' : 'Pedir cancha'}
        </Button>
      </>
    );
  }

  return (
    <Modal open onClose={onCerrar} title={titulo} size="md" bloqueado={solicitar.isPending} footer={pie}>
      {resultado ? (
        <ResultadoPedido resultado={resultado} club={club} canchaTitulo={cancha.titulo} bloque={bloque} />
      ) : !libre ? (
        <div className="space-y-4">
          <ResumenTurno clubNombre={club.nombre} canchaTitulo={cancha.titulo} bloque={bloque} />
          <Aviso tono={esMio ? 'info' : 'alerta'}>
            {esMio
              ? <>Lo ves con su estado y el pago en <Link to="/mis-reservas" className={claseEnlace}>Mis reservas</Link>.</>
              : 'Alguien lo pidió hace un momento o ya no se puede pedir desde la app. Elegí otro horario de la grilla.'}
          </Aviso>
        </div>
      ) : !session ? (
        <div className="space-y-4">
          <ResumenTurno clubNombre={club.nombre} canchaTitulo={cancha.titulo} bloque={bloque} />
          <Aviso tono="info" titulo="Ingresá para pedir este horario">
            Con tu cuenta le mandás el pedido al club y seguís la respuesta desde Mis reservas. Después de ingresar volvés acá.
          </Aviso>
        </div>
      ) : (
        <form id={idFormulario} noValidate onSubmit={enviar} className="space-y-5">
          <ResumenTurno clubNombre={club.nombre} canchaTitulo={cancha.titulo} bloque={bloque} />
          <p className="flex items-start gap-2 text-sm text-ink/70">
            <ShieldCheck size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-green-700" />
            {club.confirmacion_automatica
              ? 'Este club confirma al instante: la cancha queda reservada apenas la pedís.'
              : `El club responde en hasta ${club.respuesta_horas} h. Mientras tanto, el horario queda apartado para vos.`}
          </p>

          {!puede && situacion !== 'sin_sesion' ? (
            <AvisoOperacion />
          ) : (
            <>
              <Textarea
                label="Nota para el club (opcional)"
                rows={2}
                maxLength={MAX_NOTA}
                placeholder="Ej.: Somos 10, traemos pelota."
                value={nota}
                onChange={(evento) => setNota(evento.target.value)}
                hint={`${nota.length}/${MAX_NOTA}`}
              />

              <div className="rounded-2xl border border-ink/10 p-4">
                <Switch
                  checked={organizar}
                  onChange={setOrganizar}
                  label="Organizar un partido"
                  descripcion="Publicalo para que se sumen otros jugadores y repartan el costo."
                />
                {organizar && (
                  <div className="mt-5 border-t border-ink/10 pt-5">
                    <CamposPartido
                      valor={partido}
                      onChange={(cambios) => setPartido((actual) => ({ ...actual, ...cambios }))}
                      errores={errores}
                      precioTotal={bloque.precio}
                      anotados={1}
                    />
                  </div>
                )}
              </div>

              <p className="text-xs text-ink/65">
                Al pedir la cancha compartís tu nombre y teléfono con el club.
                {perfil && !perfil.telefono && (
                  <> Todavía no cargaste tu teléfono: <Link to="/perfil" className={claseEnlace}>sumalo en tu perfil</Link> para que el club pueda avisarte.</>
                )}
              </p>
            </>
          )}
        </form>
      )}
    </Modal>
  );
}
