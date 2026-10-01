import clsx from 'clsx';
import { textoSaldo } from './mensajes';

/** Saldo de un cliente: rojo si debe, verde si tiene saldo a favor. */
export function SaldoCliente({ saldo, className }: { saldo: number; className?: string }) {
  const { texto, tono } = textoSaldo(Number(saldo));
  return (
    <span
      className={clsx(
        'whitespace-nowrap',
        tono === 'debe' && 'font-bold text-red-700',
        tono === 'favor' && 'font-bold text-green-700',
        tono === 'neutro' && 'text-ink/65',
        className,
      )}
    >
      {texto}
    </span>
  );
}
