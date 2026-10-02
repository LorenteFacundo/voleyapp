/** Barra de avance de una importación fila por fila. */
export function ProgresoImportacion({ hechos, total, etiqueta }: { hechos: number; total: number; etiqueta: string }) {
  return (
    <div className="space-y-2 py-4">
      <p role="status" aria-live="polite" className="text-sm font-semibold text-ink">
        {etiqueta}: {hechos} de {total}…
      </p>
      <progress
        value={hechos}
        max={Math.max(total, 1)}
        aria-label="Avance de la importación"
        className="h-3 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-vb-orange-ink [&::-webkit-progress-bar]:bg-ink/10 [&::-webkit-progress-value]:bg-vb-orange-ink"
      />
      <p className="text-xs text-ink/65">No cierres esta ventana hasta que termine.</p>
    </div>
  );
}
