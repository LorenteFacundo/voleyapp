import type { Caja } from '@/api/tipos';
import { formatMoney } from '@/lib/format';
import { MEDIOS_PAGO } from './etiquetas';
import { TarjetaDato } from './TarjetaDato';

type Props = { totales: Caja['totales']; cantidad: number };

/** Totales del período y lo cobrado por cada medio de pago. */
export function ResumenCaja({ totales, cantidad }: Props) {
  const porMedio = MEDIOS_PAGO.map((medio) => ({ ...medio, monto: Number(totales.por_medio[medio.valor] ?? 0) }));
  const maximo = Math.max(0, ...porMedio.map((medio) => medio.monto));
  const devoluciones = Number(totales.devoluciones);

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaDato etiqueta="Total cobrado" valor={formatMoney(totales.total)} detalle="Ingresos menos devoluciones." />
        <TarjetaDato etiqueta="Ingresos" valor={formatMoney(totales.ingresos)} />
        <TarjetaDato
          etiqueta="Devoluciones"
          valor={formatMoney(devoluciones)}
          tono={devoluciones > 0 ? 'negativo' : 'normal'}
        />
        <TarjetaDato etiqueta="Pagos" valor={cantidad} detalle="Registrados y vigentes." />
      </dl>

      <section aria-labelledby="caja-por-medio" className="rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card">
        <h3 id="caja-por-medio" className="text-base font-bold">Por medio de pago</h3>
        <ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {porMedio.map((medio) => (
            <li key={medio.valor}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink/75">{medio.etiqueta}</span>
                <span className={medio.monto ? 'font-semibold tabular-nums text-ink' : 'tabular-nums text-ink/65'}>
                  {formatMoney(medio.monto)}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-r-[4px] bg-[#cde2fb]/50" aria-hidden="true">
                <div
                  className="h-full rounded-r-[4px] bg-[#2a78d6]"
                  style={{ width: `${maximo > 0 ? Math.max(0, (medio.monto / maximo) * 100) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
