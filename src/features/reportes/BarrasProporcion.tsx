export type FilaBarra = {
  clave: string;
  etiqueta: string;
  /** De 0 a 1 (se recorta a 1 para dibujar). */
  proporcion: number;
  /** Texto del valor, al final de la fila. */
  valor: string;
  detalle?: string;
};

/**
 * Barras horizontales finas de una sola serie: el valor siempre está escrito
 * al lado, así que la barra no es la única forma de leerlo.
 */
export function BarrasProporcion({ filas }: { filas: FilaBarra[] }) {
  return (
    <ul className="space-y-3">
      {filas.map((fila) => (
        <li key={fila.clave}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-ink">{fila.etiqueta}</span>
            <span className="shrink-0 tabular-nums text-ink/75">{fila.valor}</span>
          </div>
          <div className="mt-1 h-2.5 w-full rounded-r-[4px] bg-[#cde2fb]/50" aria-hidden="true">
            <div
              className="h-full rounded-r-[4px] bg-[#2a78d6] transition-[width] duration-500"
              style={{ width: `${Math.max(0, Math.min(1, fila.proporcion)) * 100}%` }}
            />
          </div>
          {fila.detalle && <p className="mt-0.5 text-xs text-ink/65">{fila.detalle}</p>}
        </li>
      ))}
    </ul>
  );
}
