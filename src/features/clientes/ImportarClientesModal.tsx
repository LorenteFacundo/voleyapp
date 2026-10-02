import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Download, Info } from 'lucide-react';
import clsx from 'clsx';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { claves } from '@/api/claves';
import { Button } from '@/components/ui/Button';
import { Aviso, Cargando, ErrorCarga } from '@/components/ui/Estados';
import { Switch } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { descargarArchivo, generarCsv, nombreArchivo } from '@/lib/archivos';
import { formatTelefono } from '@/lib/telefono';
import { pluralizar } from '@/lib/format';
import { useGestion } from '@/contexts/gestion';
import {
  COLUMNAS_PLANTILLA_CLIENTES, analizarCsvClientes, buscarExistente, type FilaCliente,
} from './csvClientes';
import { procesarEnSerie, type ResultadoTarea } from './importacion';
import { ProgresoImportacion } from './ProgresoImportacion';
import { SelectorArchivoCsv } from './SelectorArchivoCsv';
import { useInvalidarGestion } from './useInvalidarGestion';
import { useEnfocarAlCambiar } from './useEnfocarAlCambiar';
import type { DatosCliente } from './validacion';

type FilaValida = FilaCliente & { datos: DatosCliente };

type Resumen = {
  creados: number;
  yaExistian: number;
  repetidas: number;
  invalidas: number;
  detenidos: number;
  errores: { fila: number; nombre: string; mensaje: string }[];
};

type Fase =
  | { tipo: 'archivo' }
  | { tipo: 'importando'; hechos: number; total: number }
  | { tipo: 'resumen'; resumen: Resumen };

/** El servidor devuelve hasta 500 clientes por consulta: si hay más, se verifica cada fila antes de crearla. */
const LIMITE_LISTADO = 500;

function esValida(fila: FilaCliente): fila is FilaValida {
  return fila.estado === 'valida' && fila.datos !== null;
}

export function ImportarClientesModal({ onClose }: { onClose: () => void }) {
  const { clubId, panel } = useGestion();
  const existentes = useQuery({
    queryKey: [...claves.clientes(clubId, '', true), 'importacion'],
    queryFn: () => clubApi.clientes(clubId, null, true, LIMITE_LISTADO),
  });
  const invalidar = useInvalidarGestion();
  const [archivo, setArchivo] = useState<{ nombre: string; texto: string } | null>(null);
  const [fase, setFase] = useState<Fase>({ tipo: 'archivo' });
  const [soloProblemas, setSoloProblemas] = useState(false);
  const detener = useRef(false);
  const contenidoRef = useEnfocarAlCambiar(fase.tipo);

  const listaExistentes = existentes.data;
  const analisis = useMemo(
    () => (archivo && listaExistentes ? analizarCsvClientes(archivo.texto, listaExistentes) : null),
    [archivo, listaExistentes],
  );
  const filas = analisis?.filas ?? [];
  const validas = filas.filter(esValida);
  const repetidas = filas.filter((fila) => fila.estado === 'repetida').length;
  const invalidas = filas.filter((fila) => fila.estado === 'error').length;
  const visibles = soloProblemas ? filas.filter((fila) => fila.estado !== 'valida') : filas;

  function descargarPlantilla() {
    descargarArchivo(
      nombreArchivo('plantilla-clientes', panel.club.slug),
      generarCsv([...COLUMNAS_PLANTILLA_CLIENTES], []),
      'text/csv;charset=utf-8',
    );
  }

  async function importar() {
    if (!validas.length) return;
    const verificar = (listaExistentes?.length ?? 0) >= LIMITE_LISTADO;
    const total = validas.length;
    detener.current = false;
    setFase({ tipo: 'importando', hechos: 0, total });
    const resultados = await procesarEnSerie(validas, async (fila) => {
      if (verificar) {
        const encontrados = await clubApi.clientes(clubId, fila.datos.telefono ?? fila.datos.nombre, true);
        if (buscarExistente(fila.datos, encontrados)) return 'existia' as const;
      }
      await clubApi.guardarCliente({ clubId, ...fila.datos });
      return 'creado' as const;
    }, {
      describirError: mensajeDeError,
      alAvanzar: (hechos) => setFase({ tipo: 'importando', hechos, total }),
      detener: () => detener.current,
    });
    invalidar();
    setFase({ tipo: 'resumen', resumen: resumir(resultados, repetidas, invalidas) });
  }

  const importando = fase.tipo === 'importando';

  let contenido: ReactNode;
  let pie: ReactNode;
  if (fase.tipo === 'importando') {
    contenido = <ProgresoImportacion hechos={fase.hechos} total={fase.total} etiqueta="Creando clientes" />;
    pie = (
      <Button variant="secondary" onClick={() => { detener.current = true; }}>
        Detener
      </Button>
    );
  } else if (fase.tipo === 'resumen') {
    contenido = <ResumenImportacion resumen={fase.resumen} />;
    pie = <Button onClick={onClose}>Listo</Button>;
  } else {
    contenido = (
      <div className="space-y-5">
        <section aria-labelledby="plantilla-clientes" className="space-y-2 text-sm text-ink/75">
          <h3 id="plantilla-clientes" className="text-base font-bold">1. Prepará la planilla</h3>
          <p>
            Una fila por cliente con las columnas <strong>nombre</strong> (obligatoria), <strong>telefono</strong>,{' '}
            <strong>email</strong> y <strong>notas</strong>. Podés usar tu Excel: guardalo como CSV.
          </p>
          <Button variant="secondary" size="sm" onClick={descargarPlantilla}>
            <Download size={16} aria-hidden="true" /> Descargar plantilla
          </Button>
          <p className="text-xs text-ink/65">
            Si un cliente ya está cargado con el mismo teléfono (o el mismo nombre, si no tiene teléfono), se omite.
          </p>
        </section>

        <section aria-labelledby="archivo-clientes" className="space-y-3">
          <h3 id="archivo-clientes" className="text-base font-bold">2. Elegí el archivo</h3>
          {existentes.isPending ? (
            <Cargando texto="Preparando la importación…" className="py-4" />
          ) : existentes.isError ? (
            <ErrorCarga error={existentes.error} onRetry={() => existentes.refetch()} />
          ) : (
            <SelectorArchivoCsv onArchivo={setArchivo} />
          )}
        </section>

        {archivo && analisis && (
          <section aria-labelledby="revision-clientes" className="space-y-3">
            <h3 id="revision-clientes" className="text-base font-bold">3. Revisá antes de importar</h3>
            <p className="text-sm text-ink/65">Archivo: {archivo.nombre}</p>
            {analisis.error ? (
              <Aviso tono="error">{analisis.error}</Aviso>
            ) : (
              <>
                <p role="status" className="text-sm text-ink">
                  {pluralizar(filas.length, 'fila')}: <strong>{pluralizar(validas.length, 'lista', 'listas')}</strong> para importar
                  {repetidas > 0 && <>, {pluralizar(repetidas, 'repetida', 'repetidas')}</>}
                  {invalidas > 0 && <>, <span className="font-semibold text-red-700">{pluralizar(invalidas, 'con errores', 'con errores')}</span></>}.
                </p>
                {(repetidas > 0 || invalidas > 0) && (
                  <Switch checked={soloProblemas} onChange={setSoloProblemas} label="Ver solo las filas con observaciones" />
                )}
                <TablaVistaPrevia filas={visibles} />
              </>
            )}
          </section>
        )}
      </div>
    );
    pie = (
      <>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void importar()} disabled={!validas.length}>
          {validas.length ? `Importar ${pluralizar(validas.length, 'cliente')}` : 'Importar'}
        </Button>
      </>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Importar clientes"
      descripcion="Pasá tu lista de clientes desde Excel en un solo paso."
      size="xl"
      bloqueado={importando}
      footer={pie}
    >
      <div ref={contenidoRef} tabIndex={-1} className="outline-none">{contenido}</div>
    </Modal>
  );
}

function TablaVistaPrevia({ filas }: { filas: FilaCliente[] }) {
  if (!filas.length) return <p className="text-sm text-ink/65">No hay filas para mostrar.</p>;
  return (
    <div className="max-h-[45dvh] overflow-auto rounded-xl border border-ink/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">Vista previa de los clientes a importar</caption>
        <thead className="sticky top-0 bg-white text-xs font-semibold uppercase tracking-wide text-ink/65 shadow-[0_1px_0_rgba(16,24,32,0.1)]">
          <tr>
            <th scope="col" className="px-3 py-2">Fila</th>
            <th scope="col" className="px-3 py-2">Nombre</th>
            <th scope="col" className="px-3 py-2">Teléfono</th>
            <th scope="col" className="px-3 py-2">Email</th>
            <th scope="col" className="px-3 py-2">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {filas.map((fila) => (
            <tr key={fila.fila} className={clsx(fila.estado === 'error' && 'bg-red-50/60', fila.estado === 'repetida' && 'bg-amber-50/60')}>
              <td className="px-3 py-2 tabular-nums text-ink/65">{fila.fila}</td>
              <td className="px-3 py-2 font-medium text-ink">{fila.datos?.nombre ?? fila.original.nombre}</td>
              <td className="whitespace-nowrap px-3 py-2 text-ink/70">
                {fila.datos?.telefono ? formatTelefono(fila.datos.telefono) : fila.original.telefono}
              </td>
              <td className="px-3 py-2 text-ink/70">{fila.datos?.email ?? fila.original.email}</td>
              <td className="px-3 py-2">
                {fila.estado === 'valida' && (
                  <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                    <CircleCheck size={16} aria-hidden="true" /> Lista
                  </span>
                )}
                {fila.estado === 'repetida' && (
                  <span className="inline-flex items-start gap-1 text-amber-900">
                    <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Se omite. {fila.motivo}
                  </span>
                )}
                {fila.estado === 'error' && (
                  <ul className="space-y-0.5 text-red-800">
                    {fila.errores.map((error) => (
                      <li key={error} className="flex items-start gap-1">
                        <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function resumir(
  resultados: ResultadoTarea<FilaValida, 'creado' | 'existia'>[], repetidas: number, invalidas: number,
): Resumen {
  const resumen: Resumen = { creados: 0, yaExistian: 0, repetidas, invalidas, detenidos: 0, errores: [] };
  for (const resultado of resultados) {
    if (resultado.estado === 'ok') {
      if (resultado.valor === 'creado') resumen.creados += 1;
      else resumen.yaExistian += 1;
    } else if (resultado.estado === 'error') {
      resumen.errores.push({ fila: resultado.item.fila, nombre: resultado.item.datos.nombre, mensaje: resultado.error });
    } else {
      resumen.detenidos += 1;
    }
  }
  return resumen;
}

function ResumenImportacion({ resumen }: { resumen: Resumen }) {
  const omitidas = resumen.repetidas + resumen.yaExistian;
  return (
    <div className="space-y-4">
      <Aviso tono={resumen.errores.length ? 'alerta' : 'exito'} titulo="Importación terminada">
        <ul className="list-disc space-y-0.5 pl-5">
          <li>{pluralizar(resumen.creados, 'cliente creado', 'clientes creados')}.</li>
          {omitidas > 0 && <li>{pluralizar(omitidas, 'fila omitida', 'filas omitidas')} por estar repetidas o ya cargadas.</li>}
          {resumen.invalidas > 0 && <li>{pluralizar(resumen.invalidas, 'fila con errores', 'filas con errores')} que no se importaron.</li>}
          {resumen.detenidos > 0 && <li>{pluralizar(resumen.detenidos, 'fila quedó', 'filas quedaron')} sin importar porque detuviste la importación.</li>}
          {resumen.errores.length > 0 && <li>{pluralizar(resumen.errores.length, 'fila falló', 'filas fallaron')} al guardarse.</li>}
        </ul>
      </Aviso>
      {resumen.errores.length > 0 && (
        <section aria-labelledby="errores-importacion">
          <h3 id="errores-importacion" className="text-base font-bold">Filas que no se pudieron guardar</h3>
          <ul className="mt-2 divide-y divide-ink/5 rounded-xl border border-ink/10 text-sm">
            {resumen.errores.map((error) => (
              <li key={error.fila} className="px-3 py-2">
                <span className="font-semibold">Fila {error.fila} · {error.nombre}:</span> {error.mensaje}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
