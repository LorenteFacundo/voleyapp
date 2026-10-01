import { useState, type ReactNode } from 'react';
import { Download, Plus, Search, Upload, Users } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useClientes } from '@/api/consultas';
import { clubApi } from '@/api/club';
import { mensajeDeError } from '@/api/cliente';
import { Button } from '@/components/ui/Button';
import { Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Input, Switch } from '@/components/ui/Input';
import { descargarArchivo, generarCsv, nombreArchivo } from '@/lib/archivos';
import { todayArgentinaISO } from '@/lib/date';
import { pluralizar } from '@/lib/format';
import { ClienteDetalleModal } from '@/features/clientes/ClienteDetalleModal';
import { ClienteFormModal } from '@/features/clientes/ClienteFormModal';
import { COLUMNAS_EXPORTACION, filasExportacionClientes } from '@/features/clientes/csvClientes';
import { ImportarClientesModal } from '@/features/clientes/ImportarClientesModal';
import { ListaClientes } from '@/features/clientes/ListaClientes';
import { useValorDiferido } from '@/hooks/useValorDiferido';
import { useGestion } from '@/contexts/gestion';

/** El servidor devuelve como máximo esta cantidad de clientes por consulta. */
const LIMITE_LISTADO = 200;
/** La exportación pide más clientes que el listado (máximo del servidor). */
const LIMITE_EXPORTACION = 500;

export function ClientesPage() {
  const { clubId, panel } = useGestion();
  const [busqueda, setBusqueda] = useState('');
  const [archivados, setArchivados] = useState(false);
  const termino = useValorDiferido(busqueda.trim(), 300);
  const clientes = useClientes(clubId, termino, archivados);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const lista = clientes.data ?? [];
  const buscando = busqueda.trim() !== termino || (clientes.isFetching && clientes.isPlaceholderData);

  async function exportar() {
    if (!lista.length) return;
    setExportando(true);
    try {
      const todos = await clubApi.clientes(clubId, termino, archivados, LIMITE_EXPORTACION);
      descargarArchivo(
        nombreArchivo('clientes', panel.club.slug, todayArgentinaISO()),
        generarCsv(COLUMNAS_EXPORTACION, filasExportacionClientes(todos)),
        'text/csv;charset=utf-8',
      );
      toast.success(`Exportaste ${pluralizar(todos.length, 'cliente')}.`);
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setExportando(false);
    }
  }

  let resultado: ReactNode;
  if (clientes.isPending) {
    resultado = <Cargando texto="Cargando clientes…" />;
  } else if (clientes.isError) {
    resultado = <ErrorCarga error={clientes.error} onRetry={() => clientes.refetch()} />;
  } else if (!lista.length) {
    resultado = termino ? (
      <Vacio
        icono={<Search size={32} />}
        titulo={`No encontramos clientes para «${termino}»`}
        descripcion={archivados ? 'Probá con otro nombre o con parte del teléfono.' : 'Probá con otro nombre, con parte del teléfono o incluí los archivados.'}
      />
    ) : (
      <Vacio
        icono={<Users size={32} />}
        titulo="Todavía no cargaste clientes"
        descripcion="Cargalos uno por uno o importá tu planilla de Excel. También se suman solos cuando reservan por la app."
        accion={(
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => setCreando(true)}><Plus size={16} aria-hidden="true" /> Nuevo cliente</Button>
            <Button variant="secondary" onClick={() => setImportando(true)}><Upload size={16} aria-hidden="true" /> Importar planilla</Button>
          </div>
        )}
      />
    );
  } else {
    resultado = (
      <div className={clsx('transition-opacity', buscando && 'opacity-60')}>
        <ListaClientes clientes={lista} onAbrir={setDetalleId} />
        {lista.length >= LIMITE_LISTADO && (
          <p className="mt-3 text-center text-sm text-ink/65">
            Mostramos los primeros {LIMITE_LISTADO} clientes. Buscá por nombre o teléfono para encontrar al resto.
          </p>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="titulo-clientes" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-clientes" className="font-display text-xl font-black text-vb-blue">Clientes</h2>
          <p className="text-sm text-ink/65">Con quién hablás, cuánto te deben y cuándo vuelven a jugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportando(true)}>
            <Upload size={16} aria-hidden="true" /> Importar
          </Button>
          <Button variant="secondary" onClick={exportar} disabled={!lista.length} loading={exportando}>
            {!exportando && <Download size={16} aria-hidden="true" />} Exportar
          </Button>
          <Button onClick={() => setCreando(true)}>
            <Plus size={16} aria-hidden="true" /> Nuevo cliente
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-vb-gray/10 bg-white p-3 shadow-card sm:flex-row sm:items-center">
        <Input
          type="search"
          label="Buscar cliente"
          labelOculto
          placeholder="Buscar por nombre o teléfono"
          icono={<Search size={18} />}
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          autoComplete="off"
          className="sm:flex-1"
        />
        <div className="sm:w-60">
          <Switch checked={archivados} onChange={setArchivados} label="Incluir archivados" />
        </div>
      </div>

      <p role="status" className="min-h-5 text-sm text-ink/65">
        {buscando ? 'Buscando…' : clientes.data ? pluralizar(lista.length, 'cliente') : ''}
      </p>

      {resultado}

      {creando && <ClienteFormModal onClose={() => setCreando(false)} onCreado={(cliente) => setDetalleId(cliente.id)} />}
      {detalleId !== null && <ClienteDetalleModal key={detalleId} clienteId={detalleId} onClose={() => setDetalleId(null)} />}
      {importando && <ImportarClientesModal onClose={() => setImportando(false)} />}
    </section>
  );
}
