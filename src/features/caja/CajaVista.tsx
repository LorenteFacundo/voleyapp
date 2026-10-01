import { useId, useState, type ReactNode } from 'react';
import { Download, Plus, Receipt } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useCaja, useDeudas } from '@/api/consultas';
import { Button } from '@/components/ui/Button';
import { Aviso, Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { descargarArchivo, generarCsv, nombreArchivo } from '@/lib/archivos';
import { addDaysToISODate, todayArgentinaISO } from '@/lib/date';
import { pluralizar } from '@/lib/format';
import { useGestion } from '@/contexts/gestion';
import { ClienteDetalleModal } from '@/features/clientes/ClienteDetalleModal';
import { ADevolver } from './ADevolver';
import { ENCABEZADOS_PAGOS, filasPagos } from './csv';
import { DeudasClub } from './DeudasClub';
import { ListaPagos } from './ListaPagos';
import {
  LIMITE_CAJA, PRESETS_CAJA, rangoCaja, validarRango, type PresetCaja, type Rango,
} from './periodos';
import { RegistrarPagoModal, type PedidoPago } from './RegistrarPagoModal';
import { ResumenCaja } from './ResumenCaja';
import { SelectorPeriodo } from './SelectorPeriodo';

type Pestana = 'pagos' | 'devolver' | 'deudas';

/** Caja del club: cobros del período, devoluciones pendientes y deudas. */
export function CajaVista() {
  const { clubId, panel } = useGestion();
  const hoy = todayArgentinaISO();
  const [pestana, setPestana] = useState<Pestana>('pagos');
  const idPestanas = useId();
  const [preset, setPreset] = useState<PresetCaja>('hoy');
  const [rango, setRango] = useState<Rango>(() => rangoCaja('hoy', todayArgentinaISO()));
  const [pedidoPago, setPedidoPago] = useState<PedidoPago | null>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);

  const errorRango = validarRango(rango, LIMITE_CAJA);
  const caja = useCaja(errorRango ? null : clubId, rango.desde, rango.hasta);
  const deudas = useDeudas(clubId);

  const pagos = caja.data?.pagos ?? [];
  const vigentes = pagos.filter((pago) => !pago.anulado).length;
  const aDevolver = caja.data?.a_devolver ?? [];
  const clientesConDeuda = deudas.data?.clientes.length ?? 0;

  function elegirPreset(nuevo: PresetCaja) {
    setPreset(nuevo);
    if (nuevo !== 'personalizado') setRango(rangoCaja(nuevo, todayArgentinaISO()));
  }

  function exportar() {
    if (!caja.data || !pagos.length) return;
    descargarArchivo(
      nombreArchivo('caja', panel.club.slug, rango.desde, rango.hasta),
      generarCsv(ENCABEZADOS_PAGOS, filasPagos(pagos)),
      'text/csv;charset=utf-8',
    );
    toast.success(`Exportaste ${pluralizar(pagos.length, 'pago')}.`);
  }

  let panelPagos: ReactNode;
  if (errorRango) {
    panelPagos = <Aviso tono="alerta">Corregí las fechas para ver la caja.</Aviso>;
  } else if (caja.isPending) {
    panelPagos = <Cargando texto="Cargando la caja…" />;
  } else if (caja.isError) {
    panelPagos = <ErrorCarga error={caja.error} onRetry={() => caja.refetch()} />;
  } else {
    panelPagos = (
      <div className={clsx('space-y-4 transition-opacity', caja.isPlaceholderData && 'opacity-60')} aria-busy={caja.isPlaceholderData || undefined}>
        <ResumenCaja totales={caja.data.totales} cantidad={vigentes} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold">Pagos del período</h3>
          <Button variant="secondary" size="sm" onClick={exportar} disabled={!pagos.length}>
            <Download size={14} aria-hidden="true" /> Exportar para el contador
          </Button>
        </div>
        {pagos.length ? (
          <ListaPagos pagos={pagos} />
        ) : (
          <Vacio
            icono={<Receipt size={32} />}
            titulo="No hay pagos en este período"
            descripcion="Registrá los cobros desde acá, desde la ficha de cada cliente o desde la agenda."
          />
        )}
      </div>
    );
  }

  let panelDevolver: ReactNode;
  if (caja.data) panelDevolver = <ADevolver ocupaciones={aDevolver} onDevolver={({ ocupacion, descripcion }) => setPedidoPago({
    modo: 'devolucion',
    ocupacion: { id: ocupacion.id, descripcion, clienteId: ocupacion.cliente?.id ?? null },
    montoSugerido: Number(ocupacion.pagado),
    montoMaximo: Number(ocupacion.pagado),
  })} />;
  else if (caja.isError) panelDevolver = <ErrorCarga error={caja.error} onRetry={() => caja.refetch()} />;
  else panelDevolver = <Cargando />;

  const pestanas = [
    { id: 'pagos' as const, label: 'Cobros' },
    { id: 'devolver' as const, label: 'A devolver', badge: aDevolver.length || null },
    { id: 'deudas' as const, label: 'Deudas', badge: clientesConDeuda || null },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-ink/65">Lo que entró, lo que hay que devolver y quién te debe.</p>
        <Button onClick={() => setPedidoPago({})}>
          <Plus size={16} aria-hidden="true" /> Registrar pago
        </Button>
      </div>

      <Tabs tabs={pestanas} activeTab={pestana} onChange={setPestana} label="Secciones de la caja" idBase={idPestanas} />

      <TabPanel idBase={idPestanas} id={pestana} className="space-y-4">
        {pestana === 'pagos' && (
          <>
            <div className="rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card">
              <SelectorPeriodo
                presets={PRESETS_CAJA}
                preset={preset}
                rango={rango}
                onPreset={elegirPreset}
                onRango={setRango}
                error={errorRango}
                hoy={hoy}
                maximo={addDaysToISODate(hoy, 1)}
              />
            </div>
            {panelPagos}
          </>
        )}
        {pestana === 'devolver' && panelDevolver}
        {pestana === 'deudas' && <DeudasClub onRegistrarPago={setPedidoPago} onVerCliente={setClienteId} />}
      </TabPanel>

      {pedidoPago && <RegistrarPagoModal {...pedidoPago} onClose={() => setPedidoPago(null)} />}
      {clienteId !== null && <ClienteDetalleModal key={clienteId} clienteId={clienteId} onClose={() => setClienteId(null)} />}
    </div>
  );
}
