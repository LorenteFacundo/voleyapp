import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { clubApi } from '@/api/club';
import { claves, useAgenda, usePendientes } from '@/api/consultas';
import type { ClubPanel, Ocupacion } from '@/api/tipos';
import {
  addDaysToISODate, esFechaISO, fechaArgentina, inicioDeSemana, minutosAHora, todayArgentinaISO,
} from '@/lib/date';
import type { VistaAgenda } from './EncabezadoAgenda';
import { proximaMediaHora } from './formulario';
import { useAhora } from './hooks';
import {
  armarGrilla, diaDe, libresVigentes, minutoEnDia, minutoInicialDeScroll, type BloqueLibre,
} from './layout';
import type { PrefillReserva } from './NuevaReservaModal';
import { esActiva } from './presentacion';

const SIN_OCUPACIONES: Ocupacion[] = [];

/** Turno que propone un bloque libre: el bloque publicado entero si está libre, si no el tramo. */
export function turnoDeLibre(libre: BloqueLibre): { hora: string; duracion: number } {
  const tramo = libre.completo ? libre.bloque : libre;
  return { hora: minutosAHora(tramo.inicio), duracion: tramo.fin - tramo.inicio };
}

/**
 * Estado de la pantalla de agenda: fecha y vista (en la URL), datos del día
 * o de la semana, grilla calculada y valores sugeridos para los formularios.
 */
export function useAgendaVista(clubId: number, panel: ClubPanel) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const ahora = useAhora();
  const hoy = todayArgentinaISO(new Date(ahora));
  const parametroFecha = params.get('fecha');
  const fecha = parametroFecha && esFechaISO(parametroFecha) ? parametroFecha : hoy;
  const vista: VistaAgenda = params.get('vista') === 'semana' ? 'semana' : 'dia';
  const publicarAbierto = params.get('publicar') === '1';
  const [verCanceladas, setVerCanceladas] = useState(false);

  // La vista diaria pide solo el día (se actualiza cada 30 s); la semanal, la semana.
  const lunes = inicioDeSemana(fecha);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, indice) => addDaysToISODate(lunes, indice)), [lunes]);
  const agenda = useAgenda(clubId, vista === 'dia' ? fecha : lunes, vista === 'dia' ? fecha : dias[6], vista === 'semana' && verCanceladas);
  const pendientes = usePendientes(clubId);
  const cargando = agenda.isPending || agenda.isPlaceholderData;
  const ocupaciones = agenda.data?.ocupaciones ?? SIN_OCUPACIONES;

  // Pasar al día siguiente suele ser lo próximo: se pide por adelantado.
  useEffect(() => {
    if (vista !== 'dia') return;
    const siguiente = addDaysToISODate(fecha, 1);
    void queryClient.prefetchQuery({
      queryKey: claves.agenda(clubId, siguiente, siguiente, false),
      queryFn: () => clubApi.agenda(clubId, siguiente, siguiente, false),
    });
  }, [clubId, fecha, queryClient, vista]);

  const actualizarParams = useCallback((cambios: Record<string, string | null>) => {
    setParams((previos) => {
      const siguientes = new URLSearchParams(previos);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null) siguientes.delete(clave);
        else siguientes.set(clave, valor);
      }
      return siguientes;
    }, { replace: true });
  }, [setParams]);

  const activas = useMemo(() => ocupaciones.filter(esActiva), [ocupaciones]);
  const grilla = useMemo(
    () => armarGrilla({ fecha, canchas: panel.canchas, horarios: panel.horarios, ocupaciones: activas }),
    [fecha, panel.canchas, panel.horarios, activas],
  );
  const minutoAhora = minutoEnDia(ahora, grilla.dia);
  const diaDeHoy = useMemo(() => diaDe(hoy), [hoy]);
  const minutoDeHoy = minutoEnDia(ahora, diaDeHoy) ?? 0;
  const libres = useMemo(() => libresVigentes(grilla.libres, fecha, hoy, minutoAhora), [grilla.libres, fecha, hoy, minutoAhora]);
  const minutoScroll = minutoInicialDeScroll({
    rango: grilla.rango,
    minutoAhora,
    primeros: [
      ...grilla.tramos.filter((item) => item.ocupacion.tipo === 'reserva').map((item) => item.tramo.inicio),
      ...libres.map((libre) => libre.inicio),
    ],
  });

  const pedidosPorDia = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const pedido of pendientes.data ?? []) {
      const dia = fechaArgentina(pedido.inicio);
      mapa.set(dia, (mapa.get(dia) ?? 0) + 1);
    }
    return mapa;
  }, [pendientes.data]);

  /** Valores iniciales de "Nueva reserva": el primer libre (de la cancha, si se indica) o la próxima media hora. */
  const prefillReserva = (canchaId: number | null = null): PrefillReserva => {
    const primerLibre = libres.find((libre) => canchaId === null || libre.canchaId === canchaId);
    if (primerLibre) return { canchaId: primerLibre.canchaId, fecha, ...turnoDeLibre(primerLibre) };
    const hora = fecha === hoy ? proximaMediaHora(minutoDeHoy) : minutosAHora(grilla.rango.inicio);
    return { canchaId, fecha, hora, duracion: null };
  };

  // Para bloquear y para el partido abierto: el día visible si no pasó, sin horas ya pasadas.
  const fechaFutura = fecha < hoy ? hoy : fecha;
  const desdeSugerido = fechaFutura === hoy ? proximaMediaHora(minutoDeHoy) : minutosAHora(grilla.rango.inicio);
  const bloqueoSugerido = {
    fecha: fechaFutura,
    desde: desdeSugerido,
    hasta: fechaFutura === fecha ? minutosAHora(grilla.rango.fin) : '00:00',
  };
  const libreParaPartido = fechaFutura === fecha
    ? libres.find((libre) => libre.completo && (minutoAhora === null || libre.bloque.inicio > minutoAhora))
    : undefined;
  const partidoSugerido = libreParaPartido
    ? { canchaId: libreParaPartido.canchaId, fecha: fechaFutura, ...turnoDeLibre(libreParaPartido) }
    : { canchaId: null, fecha: fechaFutura, hora: desdeSugerido, duracion: 120 };

  return {
    ahora,
    hoy,
    fecha,
    vista,
    dias,
    agenda,
    pendientes,
    cargando,
    ocupaciones,
    grilla,
    minutoAhora,
    libres,
    minutoScroll,
    pedidosPorDia,
    verCanceladas,
    setVerCanceladas,
    publicarAbierto,
    prefillReserva,
    bloqueoSugerido,
    partidoSugerido,
    // Sin ?fecha= la agenda muestra "hoy" y pasa sola al día siguiente a la medianoche.
    irAFecha: (nueva: string) => actualizarParams({ fecha: nueva === hoy ? null : nueva }),
    irADia: (nueva: string) => actualizarParams({ fecha: nueva === hoy ? null : nueva, vista: null }),
    cambiarVista: (nueva: VistaAgenda) => actualizarParams({ vista: nueva === 'semana' ? 'semana' : null }),
    abrirPublicar: () => actualizarParams({ publicar: '1' }),
    cerrarPublicar: () => actualizarParams({ publicar: null }),
  };
}
