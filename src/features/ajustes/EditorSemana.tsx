import { useId } from 'react';
import { AlertCircle, ChevronDown, Copy, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import {
  bloquesDelDia, DIAS_EDITOR, etiquetaPrecio, etiquetaRango, nombreDia, resumenDia, terminaAlDiaSiguiente, type Bloque,
} from './horarios';

type Props = {
  bloques: Bloque[];
  errores: Record<string, string[]>;
  bloqueado: boolean;
  onAgregar: (dia: number) => void;
  onEditar: (bloque: Bloque) => void;
  onQuitar: (bloque: Bloque) => void;
  onCopiarDia: (dia: number) => void;
};

/** Semana de lunes a domingo: columnas en pantallas grandes y desplegables por día en celulares. */
export function EditorSemana(props: Props) {
  return (
    <>
      <GrillaSemana {...props} />
      <AcordeonSemana {...props} />
    </>
  );
}

const botonColumna = 'flex min-h-9 items-center justify-center gap-1 rounded-lg px-1 text-sm font-semibold text-vb-gray/75 transition '
  + 'hover:bg-ink/5 hover:text-vb-gray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink '
  + 'disabled:cursor-not-allowed disabled:opacity-40';

function GrillaSemana({ bloques, errores, bloqueado, onAgregar, onEditar, onQuitar, onCopiarDia }: Props) {
  return (
    <div className="hidden gap-2 lg:grid lg:grid-cols-7">
      {DIAS_EDITOR.map((dia) => {
        const delDia = bloquesDelDia(bloques, dia);
        return (
          <section key={dia} aria-label={nombreDia(dia)} className="flex min-w-0 flex-col rounded-2xl border border-ink/10 bg-white">
            <header className="flex items-center justify-between gap-1 border-b border-ink/10 px-2.5 py-2">
              <h4 className="text-sm font-bold text-vb-blue">{nombreDia(dia)}</h4>
              <span className="text-xs font-semibold text-ink/65">{delDia.length || ''}</span>
            </header>
            <ul className="flex-1 space-y-1.5 p-1.5">
              {delDia.map((bloque) => (
                <li key={bloque.clave}>
                  <ChipBloque bloque={bloque} errores={errores[bloque.clave]} bloqueado={bloqueado} onEditar={onEditar} onQuitar={onQuitar} />
                </li>
              ))}
              {!delDia.length && <li className="px-1 py-3 text-center text-xs text-ink/65">Sin bloques</li>}
            </ul>
            <div className="flex items-center gap-1 border-t border-ink/10 p-1.5">
              <button
                type="button"
                className={clsx(botonColumna, 'flex-1')}
                disabled={bloqueado}
                onClick={() => onAgregar(dia)}
                aria-label={`Agregar un bloque el ${nombreDia(dia).toLowerCase()}`}
              >
                <Plus size={15} aria-hidden="true" /> Agregar
              </button>
              <button
                type="button"
                className={clsx(botonColumna, 'w-9 shrink-0')}
                disabled={bloqueado || !delDia.length}
                onClick={() => onCopiarDia(dia)}
                aria-label={`Copiar los bloques del ${nombreDia(dia).toLowerCase()} a otros días`}
                title="Copiar este día a…"
              >
                <Copy size={15} aria-hidden="true" />
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AcordeonSemana({ bloques, errores, bloqueado, onAgregar, onEditar, onQuitar, onCopiarDia }: Props) {
  return (
    <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white lg:hidden">
      {DIAS_EDITOR.map((dia) => {
        const delDia = bloquesDelDia(bloques, dia);
        const conProblemas = delDia.filter((bloque) => errores[bloque.clave]?.length).length;
        return (
          <details key={dia} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 hover:bg-ink/[0.03] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block font-bold text-vb-blue">{nombreDia(dia)}</span>
                <span className="block text-xs text-ink/65">{resumenDia(bloques, dia)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {conProblemas > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-700">
                    <AlertCircle size={14} aria-hidden="true" /> {conProblemas === 1 ? '1 problema' : `${conProblemas} problemas`}
                  </span>
                )}
                <ChevronDown size={18} className="text-ink/65 transition group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <div className="space-y-3 px-4 pb-4">
              {delDia.length > 0 && (
                <ul className="space-y-2">
                  {delDia.map((bloque) => (
                    <li key={bloque.clave}>
                      <ChipBloque grande bloque={bloque} errores={errores[bloque.clave]} bloqueado={bloqueado} onEditar={onEditar} onQuitar={onQuitar} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={bloqueado} onClick={() => onAgregar(dia)}>
                  <Plus size={15} aria-hidden="true" /> Agregar bloque
                </Button>
                {delDia.length > 0 && (
                  <Button variant="ghost" disabled={bloqueado} onClick={() => onCopiarDia(dia)}>
                    <Copy size={15} aria-hidden="true" /> Copiar este día a…
                  </Button>
                )}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

type ChipProps = {
  bloque: Bloque;
  errores?: string[];
  bloqueado: boolean;
  grande?: boolean;
  onEditar: (bloque: Bloque) => void;
  onQuitar: (bloque: Bloque) => void;
};

function ChipBloque({ bloque, errores, bloqueado, grande, onEditar, onQuitar }: ChipProps) {
  const errorId = useId();
  const dia = nombreDia(bloque.dia_semana).toLowerCase();
  const conErrores = !!errores?.length;
  const rango = etiquetaRango(bloque);
  const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vb-orange-ink';

  return (
    <div>
      {/* En columnas angostas el botón de eliminar va en la esquina y aparece al pasar el mouse o con el teclado. */}
      <div
        className={clsx(
          'group relative flex items-stretch overflow-hidden rounded-xl border',
          conErrores ? 'border-red-300 bg-red-50' : 'border-vb-blue/15 bg-vb-blue/[0.04]',
        )}
      >
        <button
          type="button"
          disabled={bloqueado}
          onClick={() => onEditar(bloque)}
          aria-describedby={conErrores ? errorId : undefined}
          className={clsx(
            'min-w-0 flex-1 text-left transition hover:bg-vb-blue/10 disabled:cursor-not-allowed',
            foco,
            grande ? 'min-h-12 px-3 py-2' : 'px-2 py-1.5 pr-6',
          )}
        >
          <span className="sr-only">Editar el bloque del {dia}:</span>{' '}
          <span className="block whitespace-nowrap text-sm font-bold tabular-nums text-ink">
            {rango}
            {terminaAlDiaSiguiente(bloque) && (
              <>
                <span className="ml-1 text-xs font-semibold text-ink/65" aria-hidden="true" title="Termina al día siguiente">+1</span>
                {' '}<span className="sr-only">(termina al día siguiente)</span>
              </>
            )}
          </span>
          <span className="block text-xs text-ink/65">{etiquetaPrecio(bloque)}</span>
        </button>
        <button
          type="button"
          disabled={bloqueado}
          onClick={() => onQuitar(bloque)}
          aria-label={`Eliminar el bloque del ${dia} de ${rango}`}
          title="Eliminar bloque"
          className={clsx(
            'grid shrink-0 place-items-center text-ink/65 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed',
            foco,
            grande
              ? 'w-12'
              : 'absolute right-0.5 top-0.5 h-7 w-7 rounded-lg opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
          )}
        >
          <X size={grande ? 16 : 14} aria-hidden="true" />
        </button>
      </div>
      {conErrores && <p id={errorId} className="mt-1 text-xs font-medium text-red-700">{errores.join(' ')}</p>}
    </div>
  );
}
