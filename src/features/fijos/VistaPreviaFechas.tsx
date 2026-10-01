import { useId } from 'react';
import { CalendarCheck, CalendarX } from 'lucide-react';
import type { VistaPreviaSerie } from '@/api/tipos';
import { Aviso } from '@/components/ui/Estados';
import { formatFechaCorta, formatFechaLarga } from '@/lib/date';
import { pluralizar } from '@/lib/format';

type Props = {
  vista: VistaPreviaSerie;
  /** Fecha de fin elegida (null = sin fin). */
  hasta: string | null;
  desde: string;
  omitir: boolean;
  onOmitir: (omitir: boolean) => void;
};

/** Resultado de "Revisar fechas": cuántas se reservan y cuáles chocan con otras reservas. */
export function VistaPreviaFechas({ vista, hasta, desde, omitir, onOmitir }: Props) {
  const idOmitir = useId();
  const conflictos = vista.conflictos.length;
  const libres = Math.max(vista.fechas - conflictos, 0);
  const limite = hasta && hasta < vista.horizonte ? hasta : vista.horizonte;

  if (vista.fechas === 0) {
    return desde > vista.horizonte ? (
      <Aviso tono="info" titulo="Las fechas se generan más adelante">
        El fijo empieza el {formatFechaLarga(desde)}. Reservamos las fechas con hasta 12 semanas de anticipación,
        así que van a aparecer en la agenda a medida que se acerquen.
      </Aviso>
    ) : (
      <Aviso tono="alerta" titulo="No hay fechas para reservar">
        Con ese día y esas fechas de inicio y fin no queda ningún turno por delante. Revisá los datos.
      </Aviso>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl bg-green-50 p-4 text-green-950">
        <CalendarCheck className="mt-0.5 shrink-0 text-green-700" size={20} aria-hidden="true" />
        <div className="text-sm">
          <p className="font-bold">
            {!conflictos
              ? `Se reservan ${pluralizar(vista.fechas, 'fecha')}`
              : omitir
                ? `Se reservan ${pluralizar(libres, 'fecha')} y se omiten ${conflictos}`
                : `${pluralizar(vista.fechas, 'fecha')} por delante`}
          </p>
          <p className="mt-0.5">
            {vista.primera && <>Desde el {formatFechaLarga(vista.primera)} </>}
            hasta el {formatFechaLarga(limite)}.
            {!hasta || hasta > vista.horizonte
              ? ' Las fechas siguientes se agregan solas cada semana.'
              : ''}
          </p>
        </div>
      </div>

      {conflictos > 0 && (
        <section aria-labelledby={`${idOmitir}-titulo`} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 id={`${idOmitir}-titulo`} className="flex items-center gap-2 text-base font-bold text-amber-950">
            <CalendarX size={18} aria-hidden="true" />
            {conflictos === 1 ? 'Una fecha choca con otra reserva' : `${conflictos} fechas chocan con otras reservas`}
          </h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-amber-950">
            {vista.conflictos.map((conflicto) => (
              <li key={`${conflicto.fecha}-${conflicto.detalle}`}>
                <span className="font-semibold">{formatFechaCorta(conflicto.fecha)}:</span> {conflicto.detalle}
              </li>
            ))}
          </ul>
          <label htmlFor={idOmitir} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-white p-3 text-sm font-semibold text-ink">
            <input
              id={idOmitir}
              type="checkbox"
              checked={omitir}
              onChange={(evento) => onOmitir(evento.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-vb-orange-ink"
            />
            <span>
              Omitir esas fechas y reservar el resto
              <span className="block font-normal text-ink/65">
                Esas fechas quedan como están; el fijo no las ocupa.
              </span>
            </span>
          </label>
          {!omitir && (
            <p className="text-xs text-amber-900">Para crear el fijo, marcá la opción o cambiá el horario.</p>
          )}
        </section>
      )}
    </div>
  );
}
