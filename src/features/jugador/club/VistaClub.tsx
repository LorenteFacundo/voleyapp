import { useSearchParams } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import type { BloqueDisponible, ClubPublico } from '@/api/tipos';
import { useDisponibilidad } from '@/api/consultas';
import { todayArgentinaISO } from '@/lib/date';
import { Card } from '@/components/ui/Card';
import { Vacio } from '@/components/ui/Estados';
import { Seccion } from '../Seccion';
import { capitalizar, fechaLarga } from '../fechas';
import { CanchasClub } from './CanchasClub';
import { EncabezadoClub } from './EncabezadoClub';
import { GrillaDisponibilidad } from './GrillaDisponibilidad';
import { ModalSolicitud } from './ModalSolicitud';
import { PoliticasClub } from './PoliticasClub';
import { SelectorFecha } from './SelectorFecha';
import {
  canchaElegida, diasReservables, fechaElegida, libresPorFecha, ventanaDeConsulta,
} from './disponibilidad';

const ID_HORARIOS = 'horarios';

/**
 * Página de un club. La fecha, la cancha y el horario elegidos viven en la URL
 * (?fecha=&cancha=&bloque=) para poder compartirla y volver después de ingresar.
 */
export function VistaClub({ club }: { club: ClubPublico }) {
  const [params, setParams] = useSearchParams();
  const hoy = todayArgentinaISO();
  const dias = diasReservables(hoy, club.ventana_reserva_dias);
  const fecha = fechaElegida(params.get('fecha'), dias);
  const canchaId = canchaElegida(params.get('cancha'), club.canchas);
  const ventana = ventanaDeConsulta(hoy, fecha);
  const disponibilidad = useDisponibilidad(club.canchas.length ? { clubId: club.id, desde: ventana.desde, hasta: ventana.hasta } : null);
  const bloques = disponibilidad.data?.bloques ?? [];

  const horarioElegido = Number(params.get('bloque'));
  const bloqueElegido = Number.isInteger(horarioElegido) && horarioElegido > 0
    ? bloques.find((bloque) => bloque.horario_id === horarioElegido && bloque.fecha === fecha) ?? null
    : null;
  const canchaDelBloque = bloqueElegido ? club.canchas.find((cancha) => cancha.id === bloqueElegido.cancha_id) ?? null : null;

  function actualizar(cambios: Record<string, string | null>) {
    setParams((actuales) => {
      const proximos = new URLSearchParams(actuales);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor == null) proximos.delete(clave);
        else proximos.set(clave, valor);
      }
      return proximos;
    }, { replace: true });
  }

  function elegirBloque(bloque: BloqueDisponible) {
    actualizar({ bloque: String(bloque.horario_id), fecha: bloque.fecha });
  }

  function verHorariosDeCancha(id: number) {
    actualizar({ cancha: String(id) });
    document.getElementById(ID_HORARIOS)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <EncabezadoClub club={club} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <div id={ID_HORARIOS} className="scroll-mt-24">
            <Card padding="lg">
              <Seccion
                titulo="Elegí tu horario"
                descripcion={club.canchas.length ? `${capitalizar(fechaLarga(fecha))} · Tocá un horario libre para pedirlo.` : undefined}
              >
                {club.canchas.length ? (
                  <div className="space-y-4">
                    <SelectorFecha
                      dias={dias}
                      elegida={fecha}
                      libres={libresPorFecha(bloques)}
                      onElegir={(dia) => actualizar({ fecha: dia === hoy ? null : dia, bloque: null })}
                    />
                    <GrillaDisponibilidad
                      club={club}
                      fecha={fecha}
                      hoy={hoy}
                      canchaId={canchaId}
                      consulta={disponibilidad}
                      onElegirCancha={(id) => actualizar({ cancha: id == null ? null : String(id) })}
                      onElegirBloque={elegirBloque}
                    />
                  </div>
                ) : (
                  <Vacio
                    icono={<CalendarClock size={32} />}
                    titulo="Este club todavía no publicó canchas"
                    descripcion="Escribile por WhatsApp para consultar horarios."
                  />
                )}
              </Seccion>
            </Card>
          </div>
          <CanchasClub canchas={club.canchas} onVerHorarios={verHorariosDeCancha} />
        </div>
        <aside aria-label="Información del club" className="space-y-4">
          <PoliticasClub club={club} />
        </aside>
      </div>

      {bloqueElegido && canchaDelBloque && (
        <ModalSolicitud
          key={`${bloqueElegido.horario_id}-${bloqueElegido.fecha}`}
          club={club}
          cancha={canchaDelBloque}
          bloque={bloqueElegido}
          onCerrar={() => actualizar({ bloque: null })}
        />
      )}
    </>
  );
}
