import type { BloqueDisponible } from '@/api/tipos';
import { formatMoney } from '@/lib/format';
import { capitalizar, fechaLarga } from '../fechas';

/** Resumen del turno elegido: club, cancha, día, horario, precio y seña. */
export function ResumenTurno({ clubNombre, canchaTitulo, bloque }: { clubNombre: string; canchaTitulo: string; bloque: BloqueDisponible }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-line p-4 text-sm">
      <div className="col-span-2">
        <dt className="text-xs font-semibold text-ink/65">Club</dt>
        <dd className="font-bold text-ink">{clubNombre}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold text-ink/65">Cancha</dt>
        <dd className="font-bold text-ink">{canchaTitulo}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold text-ink/65">Día</dt>
        <dd className="font-bold text-ink">{capitalizar(fechaLarga(bloque.fecha))}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold text-ink/65">Horario</dt>
        <dd className="font-bold text-ink">{bloque.hora_inicio} a {bloque.hora_fin}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold text-ink/65">Precio del turno</dt>
        <dd className="font-bold text-ink">{bloque.precio > 0 ? formatMoney(bloque.precio) : 'Sin cargo'}</dd>
      </div>
      {bloque.sena > 0 && (
        <div>
          <dt className="text-xs font-semibold text-ink/65">Seña</dt>
          <dd className="font-bold text-ink">{formatMoney(bloque.sena)}</dd>
        </div>
      )}
    </dl>
  );
}
