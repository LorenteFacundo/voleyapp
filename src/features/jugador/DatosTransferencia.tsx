import { Banknote } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { BotonCopiar } from '@/components/ui/BotonCopiar';

/** Alias y titular para transferir, con botón para copiar el alias. */
export function DatosTransferencia({
  alias, titular, monto, concepto = 'seña', nota,
}: { alias: string; titular?: string | null; monto?: number | null; concepto?: 'seña' | 'saldo'; nota?: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-line px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink/65">
        <Banknote size={14} aria-hidden="true" />
        {monto ? `${concepto === 'seña' ? 'Seña' : 'Saldo'}: ${formatMoney(monto)}` : 'Datos para transferir'}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-ink/65">Alias</p>
          <p className="break-all font-mono text-base font-bold text-ink">{alias}</p>
          {titular && <p className="mt-0.5 text-xs text-ink/65">A nombre de {titular}</p>}
        </div>
        <BotonCopiar texto={alias} etiqueta="Copiar alias" etiquetaAccesible={`Copiar alias ${alias}`} />
      </div>
      {nota && <p className="mt-2 text-xs text-ink/65">{nota}</p>}
    </div>
  );
}
