import type { Reporte } from '@/api/tipos';
import { formatMoney, formatNumero } from '@/lib/format';
import { TarjetaDato } from '@/features/caja/TarjetaDato';
import { ratioOcupacion, resumenCancelaciones, textoHoras, textoPorcentaje } from './reportes';

/** Indicadores principales del período. */
export function KpisReporte({ reporte }: { reporte: Reporte }) {
  const ratio = ratioOcupacion(reporte.minutos_reservados, reporte.minutos_disponibles);
  const cancelaciones = resumenCancelaciones(reporte.canceladas);

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TarjetaDato
        etiqueta="Ocupación"
        valor={textoPorcentaje(ratio)}
        detalle={ratio === null ? 'No hubo horarios publicados en el período.' : 'De las horas publicadas.'}
      >
        {ratio !== null && (
          <div className="h-2 w-full rounded-r-[4px] bg-[#cde2fb]/60" aria-hidden="true">
            <div className="h-full rounded-r-[4px] bg-[#2a78d6]" style={{ width: `${Math.min(1, ratio) * 100}%` }} />
          </div>
        )}
      </TarjetaDato>
      <TarjetaDato
        etiqueta="Horas reservadas"
        valor={textoHoras(reporte.minutos_reservados)}
        detalle={`De ${textoHoras(reporte.minutos_disponibles)} disponibles.`}
      />
      <TarjetaDato etiqueta="Reservas" valor={formatNumero(reporte.reservas)} detalle="Confirmadas en el período." />
      <TarjetaDato etiqueta="Facturado" valor={formatMoney(reporte.facturado)} detalle="Precio de esas reservas." />
      <TarjetaDato etiqueta="Cobrado" valor={formatMoney(reporte.cobrado)} detalle="Pagos registrados en el período." />
      <TarjetaDato
        etiqueta="Cancelaciones"
        valor={formatNumero(cancelaciones.total)}
        detalle={cancelaciones.detalle.length
          ? cancelaciones.detalle.map((item) => `${item.etiqueta.toLowerCase()}: ${item.cantidad}`).join(' · ')
          : 'Ninguna en el período.'}
      />
      <TarjetaDato
        etiqueta="No vinieron"
        valor={formatNumero(reporte.no_vinieron)}
        detalle="Reservas marcadas como ausentes."
        tono={reporte.no_vinieron > 0 ? 'negativo' : 'normal'}
      />
    </dl>
  );
}
