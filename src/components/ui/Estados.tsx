import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { mensajeDeError } from '@/api/cliente';
import { Button, Spinner } from './Button';

export function Cargando({ texto = 'Cargando…', className }: { texto?: string; className?: string }) {
  return (
    <div role="status" className={clsx('flex items-center justify-center gap-2 py-10 text-sm text-ink/55', className)}>
      <Spinner className="h-5 w-5 text-vb-orange" />
      {texto}
    </div>
  );
}

export function Vacio({
  icono, titulo, descripcion, accion, className,
}: { icono?: ReactNode; titulo: string; descripcion?: ReactNode; accion?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      {icono && <div className="mb-1 text-vb-orange" aria-hidden="true">{icono}</div>}
      <h3 className="text-base font-bold text-ink">{titulo}</h3>
      {descripcion && <p className="max-w-sm text-sm text-ink/60">{descripcion}</p>}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}

export function ErrorCarga({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={clsx('flex flex-col items-center gap-3 rounded-2xl bg-red-50 px-4 py-8 text-center', className)}>
      <AlertTriangle className="text-red-700" aria-hidden="true" />
      <p className="max-w-md text-sm font-medium text-red-900">{mensajeDeError(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" /> Reintentar
        </Button>
      )}
    </div>
  );
}

export function Aviso({
  tono = 'info', titulo, children, className,
}: { tono?: 'info' | 'exito' | 'alerta' | 'error'; titulo?: string; children?: ReactNode; className?: string }) {
  const estilos = {
    info: 'border-blue-200 bg-blue-50 text-blue-950',
    exito: 'border-green-200 bg-green-50 text-green-950',
    alerta: 'border-amber-200 bg-amber-50 text-amber-950',
    error: 'border-red-200 bg-red-50 text-red-950',
  };
  return (
    <div role={tono === 'error' ? 'alert' : 'note'} className={clsx('rounded-2xl border px-4 py-3 text-sm', estilos[tono], className)}>
      {titulo && <p className="font-bold">{titulo}</p>}
      {children && <div className={clsx(titulo && 'mt-1')}>{children}</div>}
    </div>
  );
}
