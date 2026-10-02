import { Lock } from 'lucide-react';
import clsx from 'clsx';
import { useLogros } from '@/api/consultas';
import { fechaArgentina, formatDiaMes } from '@/lib/date';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { iconoLogro, resumenLogros } from './logros';

/** Grilla de logros: los obtenidos a color, los que faltan en gris. */
export function ListaLogros() {
  const logros = useLogros();

  if (logros.isPending) return <Cargando texto="Cargando tus logros…" />;
  if (logros.isError) return <ErrorCarga error={logros.error} onRetry={() => logros.refetch()} />;
  if (!logros.data.length) {
    return <Vacio titulo="Todavía no hay logros para ganar" descripcion="Pronto vas a poder sumar logros jugando partidos." />;
  }

  const { obtenidos, total } = resumenLogros(logros.data);

  return (
    <>
      <p className="mb-3 text-sm text-ink/65">
        {obtenidos ? `Conseguiste ${obtenidos} de ${total}. ¡Seguí jugando!` : 'Jugá tu primer partido para empezar a sumar logros.'}
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {logros.data.map((logro) => {
          const Icono = iconoLogro(logro.icono);
          const obtenido = !!logro.otorgado_at;
          return (
            <li
              key={logro.id}
              className={clsx(
                'flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-center',
                obtenido ? 'border-vb-orange/30 bg-vb-orange-light' : 'border-ink/10 bg-line',
              )}
            >
              <span
                className={clsx(
                  'relative grid h-12 w-12 place-items-center rounded-full',
                  obtenido ? 'bg-vb-orange-ink text-white shadow-card' : 'bg-ink/10 text-ink/65',
                )}
                aria-hidden="true"
              >
                <Icono size={24} />
                {!obtenido && (
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-white text-ink/65 shadow">
                    <Lock size={11} />
                  </span>
                )}
              </span>
              <span className={clsx('text-sm font-bold', obtenido ? 'text-ink' : 'text-ink/65')}>{logro.nombre}</span>
              <span className="text-xs leading-snug text-ink/65">{logro.descripcion}</span>
              <span className={clsx('text-[11px] font-semibold', obtenido ? 'text-vb-orange-ink' : 'text-ink/65')}>
                {obtenido && logro.otorgado_at ? `Lo ganaste el ${formatDiaMes(fechaArgentina(logro.otorgado_at))}` : 'Bloqueado'}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
