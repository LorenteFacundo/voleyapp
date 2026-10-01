import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarX2 } from 'lucide-react';
import type { Ocupacion } from '@/api/tipos';
import { DIAS_SEMANA, diaSemana, fechaArgentina, formatFechaLarga, minutosAHora } from '@/lib/date';
import { Aviso, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { Switch } from '@/components/ui/Input';
import { BloquearModal } from '@/features/agenda/BloquearModal';
import { CompartirLibresModal } from '@/features/agenda/CompartirLibresModal';
import { DetalleOcupacionModal } from '@/features/agenda/DetalleOcupacionModal';
import { DiaGrid } from '@/features/agenda/DiaGrid';
import { EncabezadoAgenda } from '@/features/agenda/EncabezadoAgenda';
import { NuevaReservaModal, type PrefillReserva } from '@/features/agenda/NuevaReservaModal';
import { PagosInformadosModal } from '@/features/agenda/PagosInformadosModal';
import { PartidoAbiertoModal } from '@/features/agenda/PartidoAbiertoModal';
import { PendientesModal } from '@/features/agenda/PendientesModal';
import {
  AccionesAgenda, BotonNuevaReserva, LeyendaAgenda, ResumenAgenda,
} from '@/features/agenda/ResumenAgenda';
import { SemanaLista } from '@/features/agenda/SemanaLista';
import { turnoDeLibre, useAgendaVista } from '@/features/agenda/useAgendaVista';
import { useGestion } from '@/contexts/gestion';

type ModalAgenda =
  | { tipo: 'nueva'; prefill: PrefillReserva }
  | { tipo: 'detalle'; ocupacion: Ocupacion; at: number }
  | { tipo: 'pendientes' }
  | { tipo: 'pagos' }
  | { tipo: 'bloquear' }
  | { tipo: 'compartir' };

/** Agenda del club: grilla del día, lista semanal, pedidos, cobros, bloqueos y turnos libres. */
export function AgendaPage() {
  const { clubId, panel, esDueno } = useGestion();
  const vistaAgenda = useAgendaVista(clubId, panel);
  const {
    ahora, hoy, fecha, vista, dias, agenda, pendientes, cargando, ocupaciones, grilla, minutoAhora, libres,
    minutoScroll, pedidosPorDia, verCanceladas, setVerCanceladas, publicarAbierto, irAFecha, irADia,
  } = vistaAgenda;
  const [modal, setModal] = useState<ModalAgenda | null>(null);

  // El detalle muestra la versión más nueva: la que devolvió el último cambio
  // o la que trajo la agenda (o los pendientes) después.
  const detalle = modal?.tipo === 'detalle' ? modal : null;
  const ocupacionDetalle = useMemo(() => {
    if (!detalle) return null;
    let mejor = detalle.ocupacion;
    let momento = detalle.at;
    const fuentes = [
      { lista: agenda.isPlaceholderData ? undefined : agenda.data?.ocupaciones, at: agenda.dataUpdatedAt },
      { lista: pendientes.data, at: pendientes.dataUpdatedAt },
    ];
    for (const fuente of fuentes) {
      const encontrada = fuente.lista?.find((ocupacion) => ocupacion.id === detalle.ocupacion.id);
      if (encontrada && fuente.at > momento) {
        mejor = encontrada;
        momento = fuente.at;
      }
    }
    return mejor;
  }, [detalle, agenda.data, agenda.dataUpdatedAt, agenda.isPlaceholderData, pendientes.data, pendientes.dataUpdatedAt]);

  const cerrar = () => setModal(null);
  const abrirDetalle = (ocupacion: Ocupacion) => setModal({ tipo: 'detalle', ocupacion, at: Date.now() });
  const actualizarDetalle = (ocupacion: Ocupacion) => {
    const at = Date.now();
    // Si el detalle ya se cerró, un resultado tardío no lo vuelve a abrir.
    setModal((actual) => (actual?.tipo === 'detalle' && actual.ocupacion.id === ocupacion.id
      ? { tipo: 'detalle', ocupacion, at }
      : actual));
  };
  const verEnAgenda = (ocupacion: Ocupacion) => {
    irADia(fechaArgentina(ocupacion.inicio));
    abrirDetalle(ocupacion);
  };
  const abrirNueva = (prefill: Partial<PrefillReserva> = {}) => setModal({
    tipo: 'nueva',
    prefill: { ...vistaAgenda.prefillReserva(prefill.canchaId ?? null), ...prefill },
  });

  const sinCanchas = !panel.canchas.some((cancha) => cancha.activa) && grilla.columnas.length === 0;
  const nombreDia = DIAS_SEMANA[diaSemana(fecha)].toLowerCase();
  const errorSinDatos = agenda.isError && !agenda.data;

  return (
    <div className="space-y-4 pb-12 lg:pb-0">
      <EncabezadoAgenda
        fecha={fecha}
        hoy={hoy}
        vista={vista}
        pedidosPorDia={pedidosPorDia}
        onFecha={irAFecha}
        onDia={irADia}
        onVista={vistaAgenda.cambiarVista}
      />

      <ResumenAgenda
        pedidos={pendientes.data?.length ?? panel.pendientes}
        pagosInformados={panel.pagos_informados}
        libres={cargando ? null : libres.length}
        libresHoy={fecha === hoy}
        onPedidos={() => setModal({ tipo: 'pendientes' })}
        onPagos={() => setModal({ tipo: 'pagos' })}
        onLibres={() => setModal({ tipo: 'compartir' })}
      />

      <AccionesAgenda
        onNueva={() => abrirNueva()}
        onBloquear={() => setModal({ tipo: 'bloquear' })}
        onPartido={vistaAgenda.abrirPublicar}
        onCompartir={() => setModal({ tipo: 'compartir' })}
      />

      {sinCanchas ? (
        <Vacio
          icono={<CalendarX2 size={36} />}
          titulo="Todavía no hay canchas activas"
          descripcion={esDueno
            ? 'Cargá tus canchas y sus horarios para empezar a usar la agenda.'
            : 'Pedile al dueño del club que cargue las canchas y sus horarios.'}
          accion={esDueno ? (
            <Link
              to={`/gestion/${clubId}/ajustes`}
              className="inline-flex min-h-11 items-center rounded-xl bg-vb-orange-ink px-4 text-sm font-bold text-white hover:bg-orange-800"
            >
              Ir a Ajustes
            </Link>
          ) : undefined}
        />
      ) : vista === 'dia' ? (
        <>
          {agenda.isError && agenda.data && (
            <Aviso tono="alerta">No pudimos actualizar la agenda. Mostramos lo último que se cargó y reintentamos solos.</Aviso>
          )}
          {!cargando && !grilla.hayHorarios && (
            <Aviso tono="info">
              No hay horarios publicados para los {nombreDia.endsWith('s') ? nombreDia : `${nombreDia}s`}.
              Igual podés cargar reservas tocando la grilla.
              {esDueno && (
                <> <Link to={`/gestion/${clubId}/ajustes`} className="font-semibold underline">Configurar horarios</Link></>
              )}
            </Aviso>
          )}
          {errorSinDatos ? (
            <ErrorCarga error={agenda.error} onRetry={() => void agenda.refetch()} />
          ) : (
            <DiaGrid
              grilla={grilla}
              libres={libres}
              minutoAhora={minutoAhora}
              ahora={ahora}
              cargando={cargando}
              minutoScroll={minutoScroll}
              etiqueta={`Agenda del ${formatFechaLarga(fecha)}`}
              onOcupacion={abrirDetalle}
              onLibre={(libre) => abrirNueva({ canchaId: libre.canchaId, fecha, ...turnoDeLibre(libre) })}
              onCelda={(canchaId, minuto) => abrirNueva(minuto === null
                ? { canchaId }
                : { canchaId, fecha, hora: minutosAHora(minuto), duracion: null })}
            />
          )}
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
            <Switch
              checked={verCanceladas}
              onChange={setVerCanceladas}
              label="Ver canceladas"
              descripcion="Muestra también las reservas canceladas, rechazadas y vencidas."
            />
          </div>
          {errorSinDatos ? (
            <ErrorCarga error={agenda.error} onRetry={() => void agenda.refetch()} />
          ) : (
            <SemanaLista
              dias={dias}
              ocupaciones={ocupaciones}
              canchas={panel.canchas}
              horarios={panel.horarios}
              hoy={hoy}
              ahora={ahora}
              cargando={cargando}
              onOcupacion={abrirDetalle}
              onDia={irADia}
            />
          )}
        </>
      )}

      {!sinCanchas && <LeyendaAgenda />}
      {!sinCanchas && <BotonNuevaReserva onClick={() => abrirNueva()} />}

      {modal?.tipo === 'nueva' && (
        <NuevaReservaModal
          clubId={clubId}
          panel={panel}
          prefill={modal.prefill}
          hoy={hoy}
          onClose={cerrar}
          onCreada={(ocupacion) => {
            cerrar();
            const dia = fechaArgentina(ocupacion.inicio);
            if (vista === 'dia' ? dia !== fecha : !dias.includes(dia)) irAFecha(dia);
          }}
        />
      )}
      {detalle && ocupacionDetalle && (
        <DetalleOcupacionModal
          clubId={clubId}
          panel={panel}
          esDueno={esDueno}
          ocupacion={ocupacionDetalle}
          hoy={hoy}
          onClose={cerrar}
          onActualizada={actualizarDetalle}
        />
      )}
      {modal?.tipo === 'pendientes' && (
        <PendientesModal clubId={clubId} canchas={panel.canchas} onClose={cerrar} onVer={verEnAgenda} />
      )}
      {modal?.tipo === 'pagos' && (
        <PagosInformadosModal
          clubId={clubId}
          canchas={panel.canchas}
          hoy={hoy}
          onClose={cerrar}
          onVer={verEnAgenda}
        />
      )}
      {modal?.tipo === 'bloquear' && (
        <BloquearModal clubId={clubId} panel={panel} hoy={hoy} inicial={vistaAgenda.bloqueoSugerido} onClose={cerrar} />
      )}
      {modal?.tipo === 'compartir' && (
        <CompartirLibresModal clubId={clubId} panel={panel} esDueno={esDueno} hoy={hoy} fechaVista={fecha} onClose={cerrar} />
      )}
      {/* Espera a tener el día cargado para sugerir un turno libre real. */}
      {publicarAbierto && (!cargando || agenda.isError) && (
        <PartidoAbiertoModal
          clubId={clubId}
          panel={panel}
          hoy={hoy}
          inicial={vistaAgenda.partidoSugerido}
          onClose={vistaAgenda.cerrarPublicar}
        />
      )}
    </div>
  );
}
