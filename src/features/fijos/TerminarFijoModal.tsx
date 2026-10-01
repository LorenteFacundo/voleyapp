import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import type { Serie } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Estados';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { esFechaISO, fechaArgentina, formatFechaLarga, todayArgentinaISO } from '@/lib/date';
import { pluralizar } from '@/lib/format';
import { useInvalidarGestion } from '@/features/clientes/useInvalidarGestion';
import { describirHorario } from './fijos';

/** Confirmación para terminar un fijo desde una fecha (libera esa fecha y las siguientes). */
export function TerminarFijoModal({ serie, onClose }: { serie: Serie; onClose: () => void }) {
  const invalidar = useInvalidarGestion();
  const hoy = todayArgentinaISO();
  const [fecha, setFecha] = useState(serie.proxima ? fechaArgentina(serie.proxima) : hoy);
  const [intentado, setIntentado] = useState(false);
  const error = !esFechaISO(fecha) || fecha < hoy ? 'Elegí una fecha desde hoy.' : null;

  const terminar = useMutation({
    mutationFn: (desde: string) => clubApi.finalizarSerie(serie.id, desde),
    onSuccess: () => invalidar(serie.cliente?.id),
  });

  function confirmar() {
    setIntentado(true);
    if (error) return;
    terminar.mutate(fecha, {
      onSuccess: ({ canceladas }) => {
        toast.success('Fijo terminado.', {
          description: canceladas > 0 ? `Se liberaron ${pluralizar(canceladas, 'fecha')} en la agenda.` : undefined,
        });
        onClose();
      },
      onError: (falla) => toast.error(mensajeDeError(falla)),
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Terminar fijo"
      descripcion={`${serie.titulo} · ${describirHorario(serie.dia_semana, serie.hora_inicio, serie.duracion_min)} · ${serie.cancha.titulo}`}
      size="sm"
      bloqueado={terminar.isPending}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={terminar.isPending}>Volver</Button>
          <Button variant="danger" onClick={confirmar} loading={terminar.isPending}>Terminar fijo</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm text-ink/75">
          Se cancelan las fechas desde el día que elijas (incluido) y quedan libres en la agenda. Las fechas anteriores
          quedan como están, con sus pagos.
        </p>
        <Input
          type="date"
          label="Liberar desde"
          min={hoy}
          value={fecha}
          onChange={(evento) => setFecha(evento.target.value)}
          error={intentado ? error : null}
          hint={esFechaISO(fecha) ? `El ${formatFechaLarga(fecha)} ya no se reserva.` : undefined}
          data-autofocus
        />
        <p className="text-sm text-ink/65">
          Hoy tiene {pluralizar(Number(serie.fechas_futuras), 'fecha generada', 'fechas generadas')} por delante.
        </p>
        <Aviso tono="info">
          Si alguna de esas fechas ya está cobrada, primero registrá la devolución o movela desde la agenda.
        </Aviso>
      </div>
    </Modal>
  );
}
