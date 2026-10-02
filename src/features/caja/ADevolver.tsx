import { CircleCheck, Undo2 } from 'lucide-react';
import type { Ocupacion } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Vacio } from '@/components/ui/Estados';
import { formatFechaHora } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { formatTelefono } from '@/lib/telefono';
import { useGestion } from '@/contexts/gestion';
import { EnlaceWhatsApp } from '@/components/ui/EnlaceWhatsApp';
import { mensajeDevolucion } from '@/features/clientes/mensajes';
import { contactoDeReserva, motivoBaja } from './etiquetas';

export type PedidoDevolucion = { ocupacion: Ocupacion; descripcion: string };

type Props = {
  ocupaciones: Ocupacion[];
  onDevolver: (pedido: PedidoDevolucion) => void;
};

/** Reservas canceladas que ya tenían plata cobrada: hay que devolverla. */
export function ADevolver({ ocupaciones, onDevolver }: Props) {
  const { panel } = useGestion();
  const nombreCancha = (id: number) => panel.canchas.find((cancha) => cancha.id === id)?.titulo ?? 'Cancha';

  if (!ocupaciones.length) {
    return (
      <Vacio
        icono={<CircleCheck size={32} />}
        titulo="No hay devoluciones pendientes"
        descripcion="Cuando se cancele una reserva que ya estaba paga, va a aparecer acá para que registres la devolución."
      />
    );
  }

  const total = ocupaciones.reduce((suma, ocupacion) => suma + Number(ocupacion.pagado), 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/70">
        Reservas canceladas con plata cobrada, de cualquier fecha. En total: <strong>{formatMoney(total)}</strong>.
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {ocupaciones.map((ocupacion) => {
          const contacto = contactoDeReserva(ocupacion);
          const cuando = formatFechaHora(ocupacion.inicio);
          const descripcion = `${contacto.nombre} · ${nombreCancha(ocupacion.cancha_id)} · ${cuando}`;
          return (
            <li key={ocupacion.id} className="flex flex-col gap-3 rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{contacto.nombre}</p>
                  <p className="text-sm text-ink/65">{cuando} · {nombreCancha(ocupacion.cancha_id)}</p>
                  {contacto.telefono && <p className="text-sm text-ink/65">{formatTelefono(contacto.telefono)}</p>}
                </div>
                <p className="shrink-0 text-right">
                  <span className="block text-xs text-ink/65">Cobrado</span>
                  <span className="font-bold text-red-700">{formatMoney(ocupacion.pagado)}</span>
                </p>
              </div>
              <p className="text-sm text-ink/70">
                {motivoBaja(ocupacion)}
                {ocupacion.motivo_cancelacion ? `: ${ocupacion.motivo_cancelacion}` : '.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onDevolver({ ocupacion, descripcion })}>
                  <Undo2 size={14} aria-hidden="true" /> Registrar devolución
                </Button>
                {contacto.telefono && (
                  <EnlaceWhatsApp
                    tamano="sm"
                    telefono={contacto.telefono}
                    mensaje={mensajeDevolucion({
                      cliente: contacto.nombre,
                      monto: Number(ocupacion.pagado),
                      club: panel.club.nombre,
                      reserva: cuando,
                    })}
                    etiqueta={`Escribirle a ${contacto.nombre} por la devolución`}
                  >
                    Avisar por WhatsApp
                  </EnlaceWhatsApp>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
