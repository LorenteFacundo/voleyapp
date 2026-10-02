import type { ReactNode } from 'react';
import type { ClubConfig, Ocupacion } from '@/api/tipos';
import { enlaceWhatsApp } from '@/lib/telefono';
import { EnlaceWhatsApp } from '@/components/ui/EnlaceWhatsApp';
import {
  mensajeCancelacion, mensajeCobro, mensajeConfirmacion, mensajeRecordatorio, type DatosTurno,
} from './mensajes';
import { montoCorto, nombreDeOcupacion, saldoDe, telefonoDeOcupacion } from './presentacion';

function datosDelTurno(ocupacion: Ocupacion, club: ClubConfig, cancha: string, hoy: string): DatosTurno {
  return {
    club: club.nombre,
    nombre: ocupacion.cliente?.nombre ?? ocupacion.jugador?.nombre ?? null,
    cancha,
    inicio: ocupacion.inicio,
    fin: ocupacion.fin,
    hoy,
  };
}

/** Atajos para escribirle al cliente: confirmación, recordatorio y cobro. */
export function MensajesWhatsApp({ ocupacion, club, cancha, hoy }: {
  ocupacion: Ocupacion; club: ClubConfig; cancha: string; hoy: string;
}) {
  const telefono = telefonoDeOcupacion(ocupacion);
  if (!telefono) return null;
  const datos = datosDelTurno(ocupacion, club, cancha, hoy);
  const saldo = saldoDe(ocupacion);
  return (
    <div className="flex flex-wrap gap-2">
      <EnlaceWhatsApp href={enlaceWhatsApp(telefono, mensajeConfirmacion(datos))}>Confirmación</EnlaceWhatsApp>
      <EnlaceWhatsApp href={enlaceWhatsApp(telefono, mensajeRecordatorio(datos))}>Recordatorio</EnlaceWhatsApp>
      {saldo > 0 && (
        <EnlaceWhatsApp
          href={enlaceWhatsApp(telefono, mensajeCobro({ ...datos, restante: saldo, alias: club.alias_pago, titular: club.titular_pago }))}
        >
          Cobrar {montoCorto(saldo)}
        </EnlaceWhatsApp>
      )}
    </div>
  );
}

/** Enlace para avisar una cancelación a quien la app no avisa sola. */
export function AvisoCancelacionWhatsApp({ ocupacion, club, cancha, hoy, destacado = true }: {
  ocupacion: Ocupacion; club: ClubConfig; cancha: string; hoy: string; destacado?: boolean;
}) {
  const telefono = telefonoDeOcupacion(ocupacion);
  if (!telefono) return null;
  const mensaje = mensajeCancelacion({
    ...datosDelTurno(ocupacion, club, cancha, hoy),
    motivo: ocupacion.motivo_cancelacion,
    pagado: Number(ocupacion.pagado),
  });
  return (
    <EnlaceWhatsApp href={enlaceWhatsApp(telefono, mensaje)} variante={destacado ? 'destacado' : 'boton'}>
      Avisar a {nombreDeOcupacion(ocupacion).split(/\s+/)[0]}
    </EnlaceWhatsApp>
  );
}

/** Enlace para confirmarle por WhatsApp un horario nuevo o una reserva cargada. */
export function AvisoConfirmacionWhatsApp({ ocupacion, club, cancha, hoy, children }: {
  ocupacion: Ocupacion; club: ClubConfig; cancha: string; hoy: string; children: ReactNode;
}) {
  const telefono = telefonoDeOcupacion(ocupacion);
  if (!telefono) return null;
  return (
    <EnlaceWhatsApp href={enlaceWhatsApp(telefono, mensajeConfirmacion(datosDelTurno(ocupacion, club, cancha, hoy)))} variante="destacado">
      {children}
    </EnlaceWhatsApp>
  );
}
