import { useId, useState, type ChangeEvent } from 'react';
import { leerArchivoCsv } from './importacion';

const TAMANO_MAXIMO = 2 * 1024 * 1024;

type Props = {
  onArchivo: (archivo: { nombre: string; texto: string }) => void;
  deshabilitado?: boolean;
};

/** Campo para elegir la planilla (.csv) y leerla en el navegador. */
export function SelectorArchivoCsv({ onArchivo, deshabilitado = false }: Props) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);

  async function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const campo = evento.currentTarget;
    const archivo = campo.files?.[0];
    // Permite volver a elegir el mismo archivo después de corregirlo.
    campo.value = '';
    if (!archivo) return;
    if (archivo.size > TAMANO_MAXIMO) {
      setError('El archivo es muy grande (máximo 2 MB). Dividilo en partes.');
      return;
    }
    if (!/\.(csv|txt)$/i.test(archivo.name)) {
      setError('Elegí un archivo .csv. En Excel: Archivo → Guardar como → CSV.');
      return;
    }
    setError(null);
    setLeyendo(true);
    try {
      onArchivo({ nombre: archivo.name, texto: await leerArchivoCsv(archivo) });
    } catch {
      setError('No pudimos leer el archivo. Probá guardarlo de nuevo como CSV.');
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">Planilla en formato CSV</label>
      <input
        id={id}
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={(evento) => void alElegir(evento)}
        disabled={deshabilitado || leyendo}
        aria-describedby={`${id}-ayuda`}
        aria-invalid={error ? true : undefined}
        className={[
          'block w-full rounded-xl text-sm text-ink/70',
          'file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-xl file:border-0 file:bg-vb-blue file:px-4 file:text-sm file:font-semibold file:text-white',
          'hover:file:bg-vb-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink disabled:opacity-60',
        ].join(' ')}
      />
      {error ? (
        <p id={`${id}-ayuda`} role="alert" className="mt-1 text-sm text-red-700">{error}</p>
      ) : (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-ink/65">
          {leyendo ? 'Leyendo el archivo…' : 'En Excel: Archivo → Guardar como → «CSV UTF-8 (delimitado por comas)» o «CSV (delimitado por comas)».'}
        </p>
      )}
    </div>
  );
}
