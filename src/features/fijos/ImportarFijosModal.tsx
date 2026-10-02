import { useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Download, Info } from 'lucide-react';
import clsx from 'clsx';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { useClientes, useSeries } from '@/api/consultas';
import type { ResultadoSerie } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Aviso, Cargando, ErrorCarga } from '@/components/ui/Estados';
import { Switch } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { descargarArchivo, generarCsv, nombreArchivo } from '@/lib/archivos';
import { formatDiaMes, todayArgentinaISO } from '@/lib/date';
import { formatMoney, pluralizar } from '@/lib/format';
import { useGestion } from '@/contexts/gestion';
import { procesarEnSerie, type ResultadoTarea } from '@/features/clientes/importacion';
import { ProgresoImportacion } from '@/features/clientes/ProgresoImportacion';
import { SelectorArchivoCsv } from '@/features/clientes/SelectorArchivoCsv';
import { useInvalidarGestion } from '@/features/clientes/useInvalidarGestion';
import { useEnfocarAlCambiar } from '@/features/clientes/useEnfocarAlCambiar';
import { normalizarClave } from '@/features/clientes/validacion';
import {
  COLUMNAS_PLANTILLA_FIJOS, analizarCsvFijos, describirFijoImportado, type DatosFijoImportado, type FilaFijo,
} from './csvFijos';
import { fechasCortas } from './fijos';

type FilaLista = FilaFijo & { datos: DatosFijoImportado };

type Resumen = {
  creados: { fila: number; descripcion: string; creadas: number; conflictos: string[] }[];
  errores: { fila: number; descripcion: string; mensaje: string }[];
  detenidos: number;
  invalidas: number;
};

type Fase =
  | { tipo: 'archivo' }
  | { tipo: 'importando'; hechos: number; total: number }
  | { tipo: 'resumen'; resumen: Resumen };

function esLista(fila: FilaFijo): fila is FilaLista {
  return fila.datos !== null;
}

function nombreDelFijo(fila: FilaFijo): string {
  return fila.datos?.titulo ?? fila.datos?.clienteNombre ?? (fila.original.titulo || fila.original.cliente || 'Sin nombre');
}

export function ImportarFijosModal({ onClose }: { onClose: () => void }) {
  const { clubId, panel } = useGestion();
  const clientes = useClientes(clubId, '', true);
  const series = useSeries(clubId, false);
  const invalidar = useInvalidarGestion();
  const hoy = todayArgentinaISO();
  const [archivo, setArchivo] = useState<{ nombre: string; texto: string } | null>(null);
  const [fase, setFase] = useState<Fase>({ tipo: 'archivo' });
  const [soloProblemas, setSoloProblemas] = useState(false);
  const detener = useRef(false);
  const contenidoRef = useEnfocarAlCambiar(fase.tipo);

  const listaClientes = clientes.data;
  const listaSeries = series.data;
  const { canchas, horarios } = panel;
  const analisis = useMemo(
    () => (archivo && listaClientes && listaSeries
      ? analizarCsvFijos(archivo.texto, { canchas, horarios, hoy, clientes: listaClientes, series: listaSeries })
      : null),
    [archivo, listaClientes, listaSeries, canchas, horarios, hoy],
  );
  const filas = analisis?.filas ?? [];
  const listas = filas.filter(esLista);
  const conProblemas = filas.length - listas.length;
  const visibles = soloProblemas ? filas.filter((fila) => !fila.datos || fila.avisos.length) : filas;

  function descargarPlantilla() {
    descargarArchivo(
      nombreArchivo('plantilla-fijos', panel.club.slug),
      generarCsv([...COLUMNAS_PLANTILLA_FIJOS], []),
      'text/csv;charset=utf-8',
    );
  }

  async function importar() {
    if (!listas.length) return;
    const total = listas.length;
    // Clientes sin teléfono creados en esta importación, para no duplicarlos.
    const creadosPorNombre = new Map<string, number>();
    detener.current = false;
    setFase({ tipo: 'importando', hechos: 0, total });
    const resultados = await procesarEnSerie(listas, async (fila) => {
      const datos = fila.datos;
      let clienteId = fila.clienteExistente?.id ?? null;
      if (!clienteId && datos.clienteNombre && !datos.clienteTelefono) {
        const clave = normalizarClave(datos.clienteNombre);
        clienteId = creadosPorNombre.get(clave) ?? null;
        if (!clienteId) {
          const nuevo = await clubApi.guardarCliente({ clubId, nombre: datos.clienteNombre });
          creadosPorNombre.set(clave, nuevo.id);
          clienteId = nuevo.id;
        }
      }
      return clubApi.crearSerie({
        clubId,
        canchaId: datos.canchaId,
        titulo: datos.titulo ?? '',
        diaSemana: datos.dia,
        horaInicio: datos.hora,
        duracionMin: datos.duracion,
        desde: datos.desde,
        hasta: datos.hasta,
        precio: datos.precio,
        clienteId,
        // Con teléfono, el servidor reutiliza el cliente que ya tenga ese número.
        clienteNombre: clienteId ? null : datos.clienteNombre,
        clienteTelefono: clienteId ? null : datos.clienteTelefono,
        omitirConflictos: true,
      });
    }, {
      describirError: mensajeDeError,
      alAvanzar: (hechos) => setFase({ tipo: 'importando', hechos, total }),
      detener: () => detener.current,
    });
    invalidar();
    setFase({ tipo: 'resumen', resumen: resumir(resultados, conProblemas) });
  }

  let contenido: ReactNode;
  let pie: ReactNode;
  if (fase.tipo === 'importando') {
    contenido = <ProgresoImportacion hechos={fase.hechos} total={fase.total} etiqueta="Creando fijos" />;
    pie = <Button variant="secondary" onClick={() => { detener.current = true; }}>Detener</Button>;
  } else if (fase.tipo === 'resumen') {
    contenido = <ResumenImportacion resumen={fase.resumen} />;
    pie = <Button onClick={onClose}>Listo</Button>;
  } else {
    const cargando = clientes.isPending || series.isPending;
    const falla = clientes.isError ? clientes : series.isError ? series : null;
    contenido = (
      <div className="space-y-5">
        <section aria-labelledby="plantilla-fijos" className="space-y-2 text-sm text-ink/75">
          <h3 id="plantilla-fijos" className="text-base font-bold">1. Prepará la planilla</h3>
          <p>
            Una fila por fijo. Columnas: <strong>titulo</strong>, <strong>cliente</strong>, <strong>telefono</strong>,{' '}
            <strong>cancha</strong>, <strong>dia</strong>, <strong>hora</strong>, <strong>duracion_min</strong>,{' '}
            <strong>precio</strong>, <strong>desde</strong> y <strong>hasta</strong>. Son obligatorias cancha, día y hora,
            y el título o el cliente.
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink/65">
            <li>Cancha: el nombre como figura en Ajustes ({panel.canchas.filter((c) => c.activa).map((c) => c.titulo).join(', ') || 'todavía no hay canchas activas'}).</li>
            <li>Día: lunes, mar, miércoles… o un número del 1 (lunes) al 7 (domingo).</li>
            <li>Hora: 19:00 o 19:30. Duración en minutos (si falta, usamos la del horario publicado o 1 h).</li>
            <li>Precio: si falta, usamos el del horario publicado. Fechas: DD/MM/AAAA; sin «desde», empieza hoy.</li>
          </ul>
          <Button variant="secondary" size="sm" onClick={descargarPlantilla}>
            <Download size={16} aria-hidden="true" /> Descargar plantilla
          </Button>
        </section>

        <section aria-labelledby="archivo-fijos" className="space-y-3">
          <h3 id="archivo-fijos" className="text-base font-bold">2. Elegí el archivo</h3>
          {cargando ? (
            <Cargando texto="Preparando la importación…" className="py-4" />
          ) : falla ? (
            <ErrorCarga error={falla.error} onRetry={() => falla.refetch()} />
          ) : (
            <SelectorArchivoCsv onArchivo={setArchivo} />
          )}
        </section>

        {archivo && analisis && (
          <section aria-labelledby="revision-fijos" className="space-y-3">
            <h3 id="revision-fijos" className="text-base font-bold">3. Revisá antes de importar</h3>
            <p className="text-sm text-ink/65">Archivo: {archivo.nombre}</p>
            {analisis.error ? (
              <Aviso tono="error">{analisis.error}</Aviso>
            ) : (
              <>
                <p role="status" className="text-sm text-ink">
                  {pluralizar(filas.length, 'fila')}: <strong>{pluralizar(listas.length, 'lista', 'listas')}</strong> para importar
                  {conProblemas > 0 && <>, <span className="font-semibold text-red-700">{pluralizar(conProblemas, 'con errores', 'con errores')}</span></>}.
                  {' '}Las fechas que choquen con otras reservas se omiten y te las mostramos al final.
                </p>
                {(conProblemas > 0 || filas.some((fila) => fila.avisos.length)) && (
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
        <Button onClick={() => void importar()} disabled={!listas.length}>
          {listas.length ? `Crear ${pluralizar(listas.length, 'fijo')}` : 'Importar'}
        </Button>
      </>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Importar fijos"
      descripcion="Cargá todos tus alquileres semanales desde tu planilla."
      size="xl"
      bloqueado={fase.tipo === 'importando'}
      footer={pie}
    >
      <div ref={contenidoRef} tabIndex={-1} className="outline-none">{contenido}</div>
    </Modal>
  );
}

function TablaVistaPrevia({ filas }: { filas: FilaFijo[] }) {
  if (!filas.length) return <p className="text-sm text-ink/65">No hay filas para mostrar.</p>;
  return (
    <div className="max-h-[45dvh] overflow-auto rounded-xl border border-ink/10">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">Vista previa de los fijos a importar</caption>
        <thead className="sticky top-0 bg-white text-xs font-semibold uppercase tracking-wide text-ink/65 shadow-[0_1px_0_rgba(16,24,32,0.1)]">
          <tr>
            <th scope="col" className="px-3 py-2">Fila</th>
            <th scope="col" className="px-3 py-2">Fijo</th>
            <th scope="col" className="px-3 py-2">Horario</th>
            <th scope="col" className="px-3 py-2">Precio</th>
            <th scope="col" className="px-3 py-2">Vigencia</th>
            <th scope="col" className="px-3 py-2">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {filas.map((fila) => (
            <tr key={fila.fila} className={clsx(!fila.datos && 'bg-red-50/60')}>
              <td className="px-3 py-2 tabular-nums text-ink/65">{fila.fila}</td>
              <td className="px-3 py-2">
                <span className="font-medium text-ink">{nombreDelFijo(fila)}</span>
                {fila.datos?.clienteNombre && fila.datos.titulo && (
                  <span className="block text-xs text-ink/65">{fila.datos.clienteNombre}</span>
                )}
              </td>
              <td className="px-3 py-2 text-ink/75">
                {fila.datos
                  ? describirFijoImportado(fila.datos)
                  : [fila.original.dia, fila.original.hora, fila.original.cancha].filter(Boolean).join(' · ')}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-ink/75">{fila.datos ? formatMoney(fila.datos.precio) : ''}</td>
              <td className="whitespace-nowrap px-3 py-2 text-ink/75">
                {fila.datos && <>Desde el {formatDiaMes(fila.datos.desde)}{fila.datos.hasta ? ` al ${formatDiaMes(fila.datos.hasta)}` : ''}</>}
              </td>
              <td className="px-3 py-2">
                {fila.datos ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                    <CircleCheck size={16} aria-hidden="true" /> Lista
                  </span>
                ) : (
                  <ul className="space-y-0.5 text-red-800">
                    {fila.errores.map((error) => (
                      <li key={error} className="flex items-start gap-1">
                        <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
                      </li>
                    ))}
                  </ul>
                )}
                {fila.datos && fila.avisos.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
                    {fila.avisos.map((aviso) => (
                      <li key={aviso} className="flex items-start gap-1">
                        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {aviso}
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

function resumir(resultados: ResultadoTarea<FilaLista, ResultadoSerie>[], invalidas: number): Resumen {
  const resumen: Resumen = { creados: [], errores: [], detenidos: 0, invalidas };
  for (const resultado of resultados) {
    const descripcion = `${nombreDelFijo(resultado.item)} · ${describirFijoImportado(resultado.item.datos)}`;
    if (resultado.estado === 'ok') {
      resumen.creados.push({
        fila: resultado.item.fila,
        descripcion,
        creadas: resultado.valor.creadas,
        conflictos: resultado.valor.conflictos ?? [],
      });
    } else if (resultado.estado === 'error') {
      resumen.errores.push({ fila: resultado.item.fila, descripcion, mensaje: resultado.error });
    } else {
      resumen.detenidos += 1;
    }
  }
  return resumen;
}

function ResumenImportacion({ resumen }: { resumen: Resumen }) {
  const conChoques = resumen.creados.filter((creado) => creado.conflictos.length > 0);
  const sinFechas = resumen.creados.filter((creado) => creado.creadas === 0);
  const hayProblemas = resumen.errores.length > 0 || conChoques.length > 0 || resumen.detenidos > 0;
  return (
    <div className="space-y-4">
      <Aviso tono={hayProblemas ? 'alerta' : 'exito'} titulo="Importación terminada">
        <ul className="list-disc space-y-0.5 pl-5">
          <li>{pluralizar(resumen.creados.length, 'fijo creado', 'fijos creados')}.</li>
          {conChoques.length > 0 && <li>{pluralizar(conChoques.length, 'fijo tiene', 'fijos tienen')} fechas omitidas por choques (detalle abajo).</li>}
          {resumen.invalidas > 0 && <li>{pluralizar(resumen.invalidas, 'fila con errores', 'filas con errores')} que no se importaron.</li>}
          {resumen.detenidos > 0 && <li>{pluralizar(resumen.detenidos, 'fila quedó', 'filas quedaron')} sin importar porque detuviste la importación.</li>}
          {resumen.errores.length > 0 && <li>{pluralizar(resumen.errores.length, 'fila falló', 'filas fallaron')} al guardarse.</li>}
        </ul>
      </Aviso>

      {sinFechas.length > 0 && (
        <Aviso tono="alerta" titulo="Fijos sin fechas reservadas">
          {sinFechas.map((creado) => `Fila ${creado.fila}`).join(', ')}: todas sus fechas chocaban con otras reservas.
          Revisalos en la lista y cambiales el horario o terminalos.
        </Aviso>
      )}

      {resumen.creados.length > 0 && (
        <section aria-labelledby="creados-importacion">
          <h3 id="creados-importacion" className="text-base font-bold">Fijos creados</h3>
          <ul className="mt-2 max-h-72 divide-y divide-ink/5 overflow-y-auto rounded-xl border border-ink/10 text-sm">
            {resumen.creados.map((creado) => (
              <li key={creado.fila} className="px-3 py-2">
                <p><span className="font-semibold">Fila {creado.fila}</span> · {creado.descripcion}</p>
                <p className="text-ink/65">{pluralizar(creado.creadas, 'fecha reservada', 'fechas reservadas')}.</p>
                {creado.conflictos.length > 0 && (
                  <p className="text-amber-900">Omitidas por choques: {fechasCortas(creado.conflictos)}.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {resumen.errores.length > 0 && (
        <section aria-labelledby="errores-importacion-fijos">
          <h3 id="errores-importacion-fijos" className="text-base font-bold">Filas que no se pudieron guardar</h3>
          <ul className="mt-2 divide-y divide-ink/5 rounded-xl border border-ink/10 text-sm">
            {resumen.errores.map((error) => (
              <li key={error.fila} className="px-3 py-2">
                <span className="font-semibold">Fila {error.fila} · {error.descripcion}:</span> {error.mensaje}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
