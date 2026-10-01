import { useId, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { Badge } from '@/components/ui/Badge';
import { errorArchivoFoto, MAXIMO_FOTOS, moverFoto, TIPOS_FOTO } from './canchas';
import { clasesBoton } from '@/components/ui/estilosBoton';

type Props = {
  clubId: number;
  fotos: string[];
  setFotos: Dispatch<SetStateAction<string[]>>;
  subiendo: number;
  setSubiendo: Dispatch<SetStateAction<number>>;
  deshabilitado?: boolean;
};

const botonIcono = 'grid h-11 w-11 place-items-center rounded-lg text-ink/65 transition hover:bg-ink/5 hover:text-ink '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange-ink disabled:opacity-30';

/** Fotos de una cancha: se suben al elegirlas y se guardan junto con la cancha. */
export function FotosCancha({ clubId, fotos, setFotos, subiendo, setSubiendo, deshabilitado }: Props) {
  const inputId = useId();
  const ayudaId = useId();
  const lugares = MAXIMO_FOTOS - fotos.length - subiendo;

  async function elegir(evento: ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(evento.target.files ?? []);
    evento.target.value = '';
    const validos = elegidos.filter((archivo) => {
      const error = errorArchivoFoto(archivo);
      if (error) toast.error(error);
      return !error;
    });
    if (validos.length > lugares) {
      toast.error(`Podés cargar hasta ${MAXIMO_FOTOS} fotos por cancha. Subimos las primeras ${Math.max(lugares, 0)}.`);
    }
    const aSubir = validos.slice(0, Math.max(lugares, 0));
    if (!aSubir.length) return;

    setSubiendo((cantidad) => cantidad + aSubir.length);
    const resultados = await Promise.allSettled(aSubir.map((archivo) => clubApi.subirFoto(clubId, archivo)));
    const subidas: string[] = [];
    resultados.forEach((resultado, indice) => {
      if (resultado.status === 'fulfilled') subidas.push(resultado.value);
      else toast.error(`No se pudo subir "${aSubir[indice].name}": ${mensajeDeError(resultado.reason)}`);
    });
    setFotos((actuales) => [...actuales, ...subidas].slice(0, MAXIMO_FOTOS));
    setSubiendo((cantidad) => cantidad - aSubir.length);
  }

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-ink">Fotos</legend>
      <p id={ayudaId} className="mt-0.5 text-xs text-ink/65">
        Hasta {MAXIMO_FOTOS} fotos JPG, PNG o WEBP de hasta 5 MB. La primera es la portada.
      </p>

      {(fotos.length > 0 || subiendo > 0) && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fotos.map((foto, indice) => (
            <li key={foto} className="overflow-hidden rounded-xl border border-ink/10 bg-white">
              <div className="relative aspect-[4/3] bg-ink/5">
                <img src={foto} alt={`Foto ${indice + 1} de la cancha`} loading="lazy" className="h-full w-full object-cover" />
                {indice === 0 && <Badge variant="info" className="absolute left-2 top-2">Portada</Badge>}
              </div>
              <div className="flex items-center justify-between px-0.5 py-0.5">
                <button
                  type="button"
                  className={botonIcono}
                  disabled={deshabilitado || indice === 0}
                  onClick={() => setFotos((actuales) => moverFoto(actuales, indice, -1))}
                  aria-label={`Mover la foto ${indice + 1} a la izquierda`}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={clsx(botonIcono, 'hover:text-red-700')}
                  disabled={deshabilitado}
                  onClick={() => setFotos((actuales) => actuales.filter((url) => url !== foto))}
                  aria-label={`Quitar la foto ${indice + 1}`}
                >
                  <Trash2 size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={botonIcono}
                  disabled={deshabilitado || indice === fotos.length - 1}
                  onClick={() => setFotos((actuales) => moverFoto(actuales, indice, 1))}
                  aria-label={`Mover la foto ${indice + 1} a la derecha`}
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
          {Array.from({ length: subiendo }, (_, indice) => (
            <li key={`subiendo-${indice}`} className="grid aspect-[4/3] animate-pulse place-items-center rounded-xl bg-ink/10 text-xs font-semibold text-ink/65">
              Subiendo…
            </li>
          ))}
        </ul>
      )}

      {lugares > 0 ? (
        <div className="mt-3 inline-flex rounded-xl focus-within:ring-2 focus-within:ring-vb-orange-ink focus-within:ring-offset-2">
          <input
            id={inputId}
            type="file"
            accept={TIPOS_FOTO.join(',')}
            multiple
            className="sr-only"
            aria-describedby={ayudaId}
            disabled={deshabilitado}
            onChange={elegir}
          />
          <label htmlFor={inputId} className={clasesBoton({ variant: 'secondary', deshabilitado, className: deshabilitado ? undefined : 'cursor-pointer' })}>
            <ImagePlus size={16} aria-hidden="true" /> {fotos.length ? 'Agregar más fotos' : 'Agregar fotos'}
          </label>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-ink/65">Llegaste al máximo de {MAXIMO_FOTOS} fotos.</p>
      )}
    </fieldset>
  );
}
