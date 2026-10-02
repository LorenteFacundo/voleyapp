import { useState, type ReactNode } from 'react';
import { Plus, Repeat2, Upload } from 'lucide-react';
import { useSeries } from '@/api/consultas';
import type { Serie } from '@/api/tipos';
import { Button } from '@/components/ui/Button';
import { Aviso, Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Switch } from '@/components/ui/Input';
import { DIAS_SEMANA } from '@/lib/date';
import { formatMoney, pluralizar } from '@/lib/format';
import { ClienteDetalleModal } from '@/features/clientes/ClienteDetalleModal';
import { agruparPorDia } from '@/features/fijos/fijos';
import { ImportarFijosModal } from '@/features/fijos/ImportarFijosModal';
import { ModificarFijoModal } from '@/features/fijos/ModificarFijoModal';
import { NuevoFijoModal } from '@/features/fijos/NuevoFijoModal';
import { TarjetaFijo } from '@/features/fijos/TarjetaFijo';
import { TerminarFijoModal } from '@/features/fijos/TerminarFijoModal';
import { useGestion } from '@/contexts/gestion';

export function FijosPage() {
  const { clubId, panel } = useGestion();
  const [verFinalizados, setVerFinalizados] = useState(false);
  const series = useSeries(clubId, verFinalizados);
  const [creando, setCreando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [modificando, setModificando] = useState<Serie | null>(null);
  const [terminando, setTerminando] = useState<Serie | null>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);

  const hayCanchas = panel.canchas.some((cancha) => cancha.activa);
  const lista = series.data ?? [];
  const vigentes = lista.filter((serie) => serie.vigente).length;
  const deuda = lista.reduce((total, serie) => total + Number(serie.deuda), 0);

  let contenido: ReactNode;
  if (series.isPending) {
    contenido = <Cargando texto="Cargando fijos…" />;
  } else if (series.isError) {
    contenido = <ErrorCarga error={series.error} onRetry={() => series.refetch()} />;
  } else if (!lista.length) {
    contenido = (
      <Vacio
        icono={<Repeat2 size={32} />}
        titulo="Todavía no hay fijos"
        descripcion="Los alquileres semanales se cargan una vez y reservan solos cada fecha, con su cobro y su deuda."
        accion={hayCanchas && (
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => setCreando(true)}><Plus size={16} aria-hidden="true" /> Nuevo fijo</Button>
            <Button variant="secondary" onClick={() => setImportando(true)}><Upload size={16} aria-hidden="true" /> Importar planilla</Button>
          </div>
        )}
      />
    );
  } else {
    contenido = (
      <div className="space-y-6">
        {agruparPorDia(lista).map((grupo) => (
          <section key={grupo.dia} aria-labelledby={`fijos-dia-${grupo.dia}`} className="space-y-3">
            <h3 id={`fijos-dia-${grupo.dia}`} className="flex items-baseline gap-2 text-lg font-bold">
              {DIAS_SEMANA[grupo.dia]}{' '}
              <span className="text-sm font-semibold text-ink/65">({grupo.items.length})</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {grupo.items.map((serie) => (
                <TarjetaFijo
                  key={serie.id}
                  serie={serie}
                  onModificar={() => setModificando(serie)}
                  onTerminar={() => setTerminando(serie)}
                  onVerCliente={setClienteId}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <section aria-labelledby="titulo-fijos" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-fijos" className="font-display text-xl font-black text-vb-blue">Fijos</h2>
          <p className="text-sm text-ink/65">Alquileres que se repiten cada semana. Reservamos sus fechas con 12 semanas de anticipación.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportando(true)} disabled={!hayCanchas}>
            <Upload size={16} aria-hidden="true" /> Importar
          </Button>
          <Button onClick={() => setCreando(true)} disabled={!hayCanchas}>
            <Plus size={16} aria-hidden="true" /> Nuevo fijo
          </Button>
        </div>
      </div>

      {!hayCanchas && (
        <Aviso tono="alerta">Para cargar fijos necesitás al menos una cancha activa. El dueño puede cargarla en Ajustes.</Aviso>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-vb-gray/10 bg-white p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-sm text-ink/70">
          {series.data ? (
            <>
              {pluralizar(vigentes, 'fijo vigente', 'fijos vigentes')}
              {deuda > 0 && <> · <span className="font-bold text-red-700">Te deben {formatMoney(deuda)}</span></>}
            </>
          ) : 'Cargando…'}
        </p>
        <div className="sm:w-56">
          <Switch checked={verFinalizados} onChange={setVerFinalizados} label="Ver finalizados" />
        </div>
      </div>

      {contenido}

      {creando && <NuevoFijoModal onClose={() => setCreando(false)} />}
      {importando && <ImportarFijosModal onClose={() => setImportando(false)} />}
      {modificando && <ModificarFijoModal key={modificando.id} serie={modificando} onClose={() => setModificando(null)} />}
      {terminando && <TerminarFijoModal key={terminando.id} serie={terminando} onClose={() => setTerminando(null)} />}
      {clienteId !== null && <ClienteDetalleModal key={clienteId} clienteId={clienteId} onClose={() => setClienteId(null)} />}
    </section>
  );
}
