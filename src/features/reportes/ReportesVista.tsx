import { useState, type ReactNode } from 'react';
import { ChartBar } from 'lucide-react';
import clsx from 'clsx';
import { useReporte } from '@/api/consultas';
import type { Reporte } from '@/api/tipos';
import { Aviso, Cargando, ErrorCarga, Vacio } from '@/components/ui/Estados';
import { todayArgentinaISO } from '@/lib/date';
import { formatNumero } from '@/lib/format';
import { useGestion } from '@/contexts/gestion';
import { etiquetaOrigen } from '@/features/caja/etiquetas';
import { LIMITE_REPORTE, PRESETS_REPORTE, rangoReporte, validarRango, type PresetReporte, type Rango } from '@/features/caja/periodos';
import { SelectorPeriodo } from '@/features/caja/SelectorPeriodo';
import { ClienteDetalleModal } from '@/features/clientes/ClienteDetalleModal';
import { ActividadReciente } from './ActividadReciente';
import { BarrasProporcion, type FilaBarra } from './BarrasProporcion';
import { HorasValle } from './HorasValle';
import { KpisReporte } from './KpisReporte';
import { MapaCalor } from './MapaCalor';
import { distribucionOrigen, ratioOcupacion, textoHoras, textoPorcentaje } from './reportes';
import { TopClientes } from './TopClientes';

function filasPorCancha(reporte: Reporte): FilaBarra[] {
  return reporte.por_cancha
    .filter((cancha) => Number(cancha.minutos_disponibles) > 0 || Number(cancha.minutos_reservados) > 0)
    .map((cancha) => {
      const ratio = ratioOcupacion(cancha.minutos_reservados, cancha.minutos_disponibles);
      return {
        clave: String(cancha.cancha_id),
        etiqueta: cancha.titulo,
        proporcion: ratio ?? 0,
        valor: ratio === null ? 'Sin horarios' : textoPorcentaje(ratio),
        detalle: `${textoHoras(cancha.minutos_reservados)} reservadas de ${textoHoras(cancha.minutos_disponibles)}`,
      };
    });
}

function filasPorOrigen(reporte: Reporte): FilaBarra[] {
  return distribucionOrigen(reporte.por_origen).map((item) => ({
    clave: item.origen,
    etiqueta: etiquetaOrigen(item.origen),
    proporcion: item.proporcion,
    valor: `${textoPorcentaje(item.proporcion)} · ${formatNumero(item.cantidad)}`,
  }));
}

/** Reportes del club: ocupación, ingresos, horas valle y actividad del equipo. */
export function ReportesVista() {
  const { clubId } = useGestion();
  const hoy = todayArgentinaISO();
  const [preset, setPreset] = useState<PresetReporte>('ultimas4');
  const [rango, setRango] = useState<Rango>(() => rangoReporte('ultimas4', todayArgentinaISO()));
  const [clienteId, setClienteId] = useState<number | null>(null);

  const errorRango = validarRango(rango, LIMITE_REPORTE);
  const reporte = useReporte(errorRango ? null : clubId, rango.desde, rango.hasta);

  function elegirPreset(nuevo: PresetReporte) {
    setPreset(nuevo);
    if (nuevo !== 'personalizado') setRango(rangoReporte(nuevo, todayArgentinaISO()));
  }

  let contenido: ReactNode;
  if (errorRango) {
    contenido = <Aviso tono="alerta">Corregí las fechas para ver el reporte.</Aviso>;
  } else if (reporte.isPending) {
    contenido = <Cargando texto="Armando el reporte…" />;
  } else if (reporte.isError) {
    contenido = <ErrorCarga error={reporte.error} onRetry={() => reporte.refetch()} />;
  } else if (!Number(reporte.data.minutos_disponibles) && !Number(reporte.data.reservas)) {
    contenido = (
      <Vacio
        icono={<ChartBar size={32} />}
        titulo="No hay datos para este período"
        descripcion="No hubo horarios publicados ni reservas confirmadas. Probá con otro período o cargá tus horarios en Ajustes."
      />
    );
  } else {
    const datos = reporte.data;
    const canchas = filasPorCancha(datos);
    contenido = (
      <div className={clsx('space-y-4 transition-opacity', reporte.isPlaceholderData && 'opacity-60')} aria-busy={reporte.isPlaceholderData || undefined}>
        <KpisReporte reporte={datos} />
        <HorasValle calor={datos.calor} />
        <MapaCalor calor={datos.calor} />
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="ocupacion-cancha" className="rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card">
            <h3 id="ocupacion-cancha" className="text-base font-bold">Ocupación por cancha</h3>
            <div className="mt-3">
              {canchas.length
                ? <BarrasProporcion filas={canchas} />
                : <p className="text-sm text-ink/65">Sin datos de canchas en el período.</p>}
            </div>
          </section>
          <section aria-labelledby="reservas-origen" className="rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card">
            <h3 id="reservas-origen" className="text-base font-bold">Por dónde llegaron las reservas</h3>
            <div className="mt-3">
              {Number(datos.reservas) > 0
                ? <BarrasProporcion filas={filasPorOrigen(datos)} />
                : <p className="text-sm text-ink/65">No hubo reservas confirmadas en el período.</p>}
            </div>
          </section>
        </div>
        <TopClientes clientes={datos.top_clientes} onVerCliente={setClienteId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-vb-gray/10 bg-white p-4 shadow-card">
        <SelectorPeriodo
          presets={PRESETS_REPORTE}
          preset={preset}
          rango={rango}
          onPreset={elegirPreset}
          onRango={setRango}
          error={errorRango}
          hoy={hoy}
        />
      </div>
      {contenido}
      <ActividadReciente />
      {clienteId !== null && <ClienteDetalleModal key={clienteId} clienteId={clienteId} onClose={() => setClienteId(null)} />}
    </div>
  );
}
