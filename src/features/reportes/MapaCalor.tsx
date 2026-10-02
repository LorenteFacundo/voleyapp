import { useId, useState } from 'react';
import clsx from 'clsx';
import type { Reporte } from '@/api/tipos';
import { Switch } from '@/components/ui/Input';
import { DIAS_SEMANA, DIAS_SEMANA_CORTOS } from '@/lib/date';
import { formatNumero } from '@/lib/format';
import { ESCALA_CALOR, armarMapaCalor, textoPorcentaje, type CeldaCalor, type NivelCalor } from './reportes';

// Escala secuencial de un solo tono (azul): más oscuro = más ocupado.
const COLOR_NIVEL: Record<NivelCalor, string> = {
  [-1]: 'bg-ink/[0.05] text-ink/65',
  0: 'bg-[#cde2fb] text-ink',
  1: 'bg-[#86b6ef] text-ink',
  2: 'bg-[#3987e5] text-ink',
  3: 'bg-[#1c5cab] text-white',
  4: 'bg-[#0d366b] text-white',
};

function descripcionCelda(celda: CeldaCalor): string {
  const momento = `${DIAS_SEMANA[celda.dia]} a las ${celda.hora} h`;
  if (celda.ratio === null) return `${momento}: sin horario publicado`;
  return `${momento}: ${textoPorcentaje(celda.ratio)} ocupado (${formatNumero(celda.ocupados / 60)} h de ${formatNumero(celda.disponibles / 60)} h)`;
}

/**
 * Ocupación por día de la semana y hora. Es una tabla real (con encabezados
 * de fila y columna) para que se pueda recorrer con lector de pantalla; los
 * porcentajes se pueden mostrar también a la vista.
 */
export function MapaCalor({ calor }: { calor: Reporte['calor'] }) {
  const tituloId = useId();
  const [verValores, setVerValores] = useState(false);
  const mapa = armarMapaCalor(calor);

  return (
    <section aria-labelledby={tituloId} className="rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={tituloId} className="text-base font-bold">Ocupación por día y hora</h3>
          <p className="text-sm text-ink/65">Qué tan lleno estuvo cada horario en el período.</p>
        </div>
        {mapa.horas.length > 0 && (
          <div className="w-full sm:w-56">
            <Switch checked={verValores} onChange={setVerValores} label="Ver porcentajes" />
          </div>
        )}
      </div>

      {mapa.horas.length === 0 ? (
        <p className="mt-4 text-sm text-ink/65">No hubo horarios publicados en el período. Cargalos en Ajustes para medir la ocupación.</p>
      ) : (
        <>
          <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1">
            <table className="border-separate border-spacing-[2px] text-xs">
              <caption className="sr-only">
                Porcentaje de ocupación por día de la semana (filas) y hora de inicio (columnas).
              </caption>
              <thead>
                <tr>
                  <td className="sticky left-0 bg-white" />
                  {mapa.horas.map((hora) => (
                    <th key={hora} scope="col" className="min-w-9 px-0.5 pb-1 text-center font-semibold text-ink/65">
                      {hora}<span className="sr-only"> h</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mapa.filas.map((fila) => (
                  <tr key={fila.dia}>
                    <th scope="row" className="sticky left-0 z-10 bg-white pr-2 text-left font-semibold text-ink/70">
                      <span aria-hidden="true">{DIAS_SEMANA_CORTOS[fila.dia]}</span>
                      <span className="sr-only">{DIAS_SEMANA[fila.dia]}</span>
                    </th>
                    {fila.celdas.map((celda) => (
                      <td
                        key={celda.hora}
                        title={descripcionCelda(celda)}
                        className={clsx(
                          'h-9 min-w-9 rounded-[4px] text-center align-middle text-[11px] font-semibold tabular-nums',
                          COLOR_NIVEL[celda.nivel],
                        )}
                      >
                        <span className={verValores ? undefined : 'sr-only'}>
                          {celda.ratio === null ? (verValores ? '–' : 'Sin horario') : textoPorcentaje(celda.ratio)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink/70" aria-label="Referencias del mapa de calor">
            {ESCALA_CALOR.map((paso) => (
              <li key={paso.nivel} className="flex items-center gap-1.5">
                <span className={clsx('h-3.5 w-3.5 rounded-[3px]', COLOR_NIVEL[paso.nivel])} aria-hidden="true" />
                {paso.etiqueta}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
