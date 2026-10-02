import { useId, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useClienteDetalle } from '@/api/consultas';
import { mensajeDeError } from '@/api/cliente';
import { Button } from '@/components/ui/Button';
import { Cargando, ErrorCarga } from '@/components/ui/Estados';
import { Modal } from '@/components/ui/Modal';
import { useConfirmar } from '@/components/ui/confirmar-contexto';
import { formatMoney, pluralizar } from '@/lib/format';
import { PagoForm, type ValoresPago } from '@/features/caja/PagoForm';
import { avisarPagoRegistrado, useRegistrarPago } from '@/features/caja/useMutacionesCaja';
import { ClienteForm } from './ClienteForm';
import { FichaCliente } from './FichaCliente';
import { useEnfocarAlCambiar } from './useEnfocarAlCambiar';
import { useArchivarCliente, useGuardarCliente } from './useMutacionesClientes';
import type { DatosCliente } from './validacion';

type Vista = 'ficha' | 'editar' | 'pago';

/**
 * Ficha de un cliente en un único diálogo: editar y registrar un pago se
 * muestran en el mismo lugar (sin abrir un diálogo encima de otro).
 */
export function ClienteDetalleModal({ clienteId, onClose }: { clienteId: number; onClose: () => void }) {
  const detalle = useClienteDetalle(clienteId);
  const [vista, setVista] = useState<Vista>('ficha');
  const formId = useId();
  const guardar = useGuardarCliente();
  const registrar = useRegistrarPago();
  const archivar = useArchivarCliente();
  const confirmar = useConfirmar();
  // Al cambiar de vista, el foco pasa al primer campo de la nueva.
  const contenidoRef = useEnfocarAlCambiar(vista);

  const ocupado = guardar.isPending || registrar.isPending;
  const datos = detalle.data;

  function guardarCambios(cambios: DatosCliente) {
    guardar.mutate({ id: clienteId, ...cambios }, {
      onSuccess: () => {
        toast.success('Cambios guardados.');
        setVista('ficha');
      },
      onError: (error) => toast.error(mensajeDeError(error)),
    });
  }

  function registrarPago(valores: ValoresPago) {
    registrar.mutate({
      monto: valores.monto,
      medio: valores.medio,
      fecha: valores.fecha,
      nota: valores.nota,
      clienteId,
      ocupacionId: null,
    }, {
      onSuccess: (resultado) => {
        avisarPagoRegistrado(valores.monto, resultado.saldo_cliente);
        setVista('ficha');
      },
      onError: (error) => toast.error(mensajeDeError(error)),
    });
  }

  async function alternarArchivo() {
    if (!datos) return;
    const { cliente } = datos;
    const archivando = !cliente.archivado;
    const fijosActivos = datos.series.filter((serie) => serie.activa).length;
    const avisos = [
      fijosActivos > 0 && `Tiene ${pluralizar(fijosActivos, 'fijo activo', 'fijos activos')}: siguen generando fechas.`,
      Number(datos.saldo) < 0 && `Debe ${formatMoney(-datos.saldo)}.`,
    ].filter(Boolean);
    const { confirmado } = await confirmar({
      titulo: archivando ? `¿Archivar a ${cliente.nombre}?` : `¿Desarchivar a ${cliente.nombre}?`,
      descripcion: archivando ? (
        <>
          <p>Deja de aparecer en la lista y en las búsquedas. Sus reservas, pagos y fijos no cambian, y lo podés desarchivar cuando quieras.</p>
          {avisos.length > 0 && <p className="mt-2 font-semibold">{avisos.join(' ')}</p>}
        </>
      ) : 'Vuelve a aparecer en la lista de clientes y en las búsquedas.',
      confirmar: archivando ? 'Archivar' : 'Desarchivar',
    });
    if (!confirmado) return;
    archivar.mutate({ id: cliente.id, archivado: archivando }, {
      onSuccess: () => toast.success(archivando ? `Archivaste a ${cliente.nombre}.` : `${cliente.nombre} volvió a tu lista de clientes.`),
      onError: (error) => toast.error(mensajeDeError(error)),
    });
  }

  let titulo: ReactNode = datos?.cliente.nombre ?? 'Cliente';
  let descripcion: ReactNode;
  let pie: ReactNode;
  let contenido: ReactNode;

  if (detalle.isPending) {
    contenido = <Cargando texto="Cargando la ficha…" />;
  } else if (detalle.isError || !datos) {
    contenido = <ErrorCarga error={detalle.error} onRetry={() => detalle.refetch()} />;
  } else if (vista === 'editar') {
    titulo = 'Editar cliente';
    descripcion = datos.cliente.nombre;
    contenido = (
      <ClienteForm
        id={formId}
        inicial={{
          id: datos.cliente.id,
          nombre: datos.cliente.nombre,
          telefono: datos.cliente.telefono,
          email: datos.cliente.email,
          notas: datos.cliente.notas,
        }}
        onSubmit={guardarCambios}
      />
    );
    pie = (
      <>
        <Button variant="secondary" onClick={() => setVista('ficha')} disabled={ocupado}>Volver</Button>
        <Button type="submit" form={formId} loading={guardar.isPending}>Guardar cambios</Button>
      </>
    );
  } else if (vista === 'pago') {
    titulo = 'Registrar pago a cuenta';
    descripcion = `De ${datos.cliente.nombre}. Queda a cuenta de sus turnos.`;
    contenido = (
      <PagoForm
        id={formId}
        modo="pago"
        montoInicial={Number(datos.saldo) < 0 ? -datos.saldo : null}
        onSubmit={registrarPago}
      />
    );
    pie = (
      <>
        <Button variant="secondary" onClick={() => setVista('ficha')} disabled={ocupado}>Volver</Button>
        <Button type="submit" form={formId} loading={registrar.isPending}>Registrar pago</Button>
      </>
    );
  } else {
    contenido = (
      <FichaCliente
        detalle={datos}
        onEditar={() => setVista('editar')}
        onPagar={() => setVista('pago')}
        onArchivar={() => void alternarArchivo()}
        archivando={archivar.isPending}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title={titulo} descripcion={descripcion} size="lg" bloqueado={ocupado} footer={pie}>
      <div ref={contenidoRef} tabIndex={-1} className="outline-none">{contenido}</div>
    </Modal>
  );
}
