import { CalendarDays, Clock3, User, CreditCard } from 'lucide-react';
import { formatDate, formatMoney } from '@/lib/format';
import type { ReservaAdmin } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type ReservasTableProps = {
  reservas: ReservaAdmin[];
  loading: boolean;
};

const estadoPagoColors: Record<string, string> = {
  pendiente: 'warning',
  pagado: 'success',
  cancelado: 'danger',
};

export function ReservasTable({ reservas, loading }: ReservasTableProps) {
  if (loading) {
    return <div className="text-center py-8 text-ink/50">Cargando reservas...</div>;
  }

  return (
    <>
      <div className="text-sm text-ink/50 mb-3">{reservas.length} reservas</div>

      <div className="grid gap-2">
        {reservas.map((reserva) => (
          <Card key={reserva.id} padding="md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-ink">{reserva.cancha_titulo}</h3>
                  <Badge variant={(estadoPagoColors[reserva.estado_pago] as 'success' | 'warning' | 'danger') ?? 'default'}>
                    {reserva.estado_pago}
                  </Badge>
                </div>
                <p className="text-xs text-ink/50">{reserva.club_nombre}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink/70">
                  <span className="flex items-center gap-1">
                    <User size={14} />
                    {reserva.usuario_nombre}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays size={14} />
                    {formatDate(reserva.fecha)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock3 size={14} />
                    {reserva.hora_inicio.slice(0, 5)}–{reserva.hora_fin.slice(0, 5)}
                  </span>
                  <span className="flex items-center gap-1">
                    <CreditCard size={14} />
                    {formatMoney(reserva.monto_sena_pagado)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

    </>
  );
}
