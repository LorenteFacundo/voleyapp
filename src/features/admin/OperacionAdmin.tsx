import { useId, useMemo, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi } from '@/api/admin';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import { useResumenAdmin } from '@/api/consultas';
import type { EstadoOperacion } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Aviso, Cargando, ErrorCarga } from '@/components/ui/Estados';
import { Switch, Textarea } from '@/components/ui/Input';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { useCambios } from '@/features/ajustes/useCambios';

type Form = { pausadas: boolean; motivo: string; lista: boolean };

function FormOperacion({ operacion }: { operacion: EstadoOperacion }) {
  const base = useMemo<Form>(() => ({
    pausadas: operacion.reservas_pausadas,
    motivo: operacion.motivo_pausa ?? '',
    lista: operacion.requiere_lista_acceso,
  }), [operacion]);
  const { valores, hayCambios, cambiar, descartar } = useCambios(base);
  const queryClient = useQueryClient();
  const confirmar = useConfirmar();
  const formId = useId();

  const guardar = useMutation({
    mutationFn: (datos: Form) => adminApi.configurarOperacion({
      reservasPausadas: datos.pausadas,
      requiereListaAcceso: datos.lista,
      motivo: datos.pausadas ? datos.motivo.trim() || null : null,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: claves.admin });
      void queryClient.invalidateQueries({ queryKey: claves.estadoOperacion });
      descartar();
      toast.success('Operación actualizada.');
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  });

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const cambios: string[] = [];
    if (valores.pausadas !== base.pausadas) {
      cambios.push(valores.pausadas
        ? 'Se pausan los pedidos nuevos de jugadores desde la app.'
        : 'Los jugadores vuelven a poder pedir turnos desde la app.');
    } else if (valores.pausadas && valores.motivo.trim() !== base.motivo.trim()) {
      cambios.push('Cambia el mensaje que ven los jugadores.');
    }
    if (valores.lista !== base.lista) {
      cambios.push(valores.lista
        ? 'Solo las cuentas habilitadas en Usuarios van a poder reservar.'
        : 'Cualquier cuenta con el email confirmado va a poder reservar.');
    }
    const { confirmado } = await confirmar({
      titulo: '¿Aplicar los cambios de operación?',
      descripcion: (
        <ul className="list-disc space-y-1 pl-5">
          {cambios.map((cambio) => <li key={cambio}>{cambio}</li>)}
          <li>Los clubes siguen pudiendo usar su agenda normalmente.</li>
        </ul>
      ),
      confirmar: 'Aplicar',
      peligro: valores.pausadas && !base.pausadas,
    });
    if (confirmado) guardar.mutate(valores);
  }

  return (
    <form id={formId} onSubmit={enviar} noValidate>
      <Card padding="lg">
        <fieldset disabled={guardar.isPending} className="min-w-0 space-y-6">
          <legend className="sr-only">Operación de la app</legend>
          <div className="space-y-3">
            <Switch
              checked={valores.pausadas}
              onChange={(valor) => cambiar('pausadas', valor)}
              label="Reservas de jugadores pausadas"
              descripcion="Frena los pedidos nuevos y la inscripción a partidos desde la app. Las reservas que ya existen no cambian."
            />
            {valores.pausadas && (
              <Textarea
                label="Mensaje para los jugadores (opcional)"
                rows={2}
                maxLength={300}
                placeholder="Estamos haciendo mejoras: volvemos a tomar reservas el lunes."
                hint={`Lo ven al intentar reservar. ${valores.motivo.length}/300`}
                value={valores.motivo}
                onChange={(evento) => cambiar('motivo', evento.target.value)}
              />
            )}
          </div>
          <Switch
            checked={valores.lista}
            onChange={(valor) => cambiar('lista', valor)}
            label="Solo cuentas habilitadas (lista de acceso del piloto)"
            descripcion="Si está activo, solo reservan las cuentas con “Acceso al piloto” en Usuarios. Si no, cualquiera con el email confirmado."
          />
          <Aviso tono="info">
            Los clubes siempre pueden operar su agenda: cargar reservas a mano, confirmar o rechazar pedidos, bloquear horarios y cobrar.
          </Aviso>
        </fieldset>
        {hayCambios && (
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={descartar} disabled={guardar.isPending}>Descartar</Button>
            <Button type="submit" loading={guardar.isPending}>Guardar cambios</Button>
          </div>
        )}
      </Card>
    </form>
  );
}

export function OperacionAdmin() {
  const resumen = useResumenAdmin();
  const tituloId = useId();
  return (
    <section aria-labelledby={tituloId} className="max-w-3xl">
      <div className="mb-4">
        <h2 id={tituloId} className="font-display text-xl font-black text-vb-blue">Operación</h2>
        <p className="mt-0.5 text-sm text-ink/65">Controlá quién puede reservar desde la app durante el piloto.</p>
      </div>
      {resumen.isPending ? <Cargando />
        : resumen.isError ? <ErrorCarga error={resumen.error} onRetry={() => resumen.refetch()} />
          : <FormOperacion operacion={resumen.data.operacion} />}
    </section>
  );
}
