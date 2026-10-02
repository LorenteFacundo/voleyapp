// Datos de ejemplo para las pruebas de la agenda (no se usan en la app).

import type { CanchaGestion, ClubPanel, HorarioPublicado, Ocupacion } from '@/api/tipos';

export function crearHorario(parcial: Partial<HorarioPublicado> = {}): HorarioPublicado {
  return {
    id: 1,
    cancha_id: 1,
    dia_semana: 4,
    hora_inicio: '19:00',
    hora_fin: '21:00',
    precio_total: 30000,
    precio_sena: 10000,
    activo: true,
    ...parcial,
  };
}

export function crearCancha(parcial: Partial<CanchaGestion> = {}): CanchaGestion {
  return {
    id: 1,
    club_id: 7,
    titulo: 'Cancha 1',
    descripcion: null,
    fotos: [],
    precio_total: 28000,
    precio_sena: 0,
    techada: true,
    superficie: 'parquet',
    orden: 1,
    activa: true,
    ...parcial,
  };
}

export function crearOcupacion(parcial: Partial<Ocupacion> = {}): Ocupacion {
  return {
    id: 100,
    cancha_id: 1,
    // Jueves 1 de octubre de 2026, 19:00 a 21:00 en Buenos Aires.
    inicio: '2026-10-01T22:00:00.000Z',
    fin: '2026-10-02T00:00:00.000Z',
    tipo: 'reserva',
    estado: 'confirmada',
    origen: 'whatsapp',
    titulo: null,
    precio: 30000,
    sena: 0,
    pagado: 0,
    estado_pago: 'pendiente',
    asistencia: null,
    notas: null,
    vence_at: null,
    pago_informado_at: null,
    motivo_cancelacion: null,
    cancelada_por: null,
    serie_id: null,
    created_at: '2026-09-30T12:00:00.000Z',
    cliente: { id: 9, nombre: 'Juan Pérez', telefono: '5491122334455', email: null, es_usuario_app: false },
    jugador: null,
    partido: null,
    ...parcial,
  };
}

export function crearPanel(parcial: Partial<ClubPanel> = {}): ClubPanel {
  return {
    mi_rol: 'dueno',
    club: {
      id: 7,
      nombre: 'Club Vóley Palermo',
      slug: 'voley-palermo',
      direccion: 'Av. Siempre Viva 123',
      zona: 'Palermo',
      telefono: null,
      whatsapp: '5491100000000',
      instagram: null,
      descripcion: null,
      alias_pago: 'voley.palermo',
      titular_pago: 'Club Vóley Palermo',
      latitud: null,
      longitud: null,
      publicado: true,
      confirmacion_automatica: false,
      anticipacion_minima_min: 60,
      ventana_reserva_dias: 21,
      cancelacion_horas: 24,
      respuesta_horas: 12,
      politicas: null,
    },
    canchas: [crearCancha(), crearCancha({ id: 2, titulo: 'Cancha 2', orden: 2 })],
    horarios: [
      crearHorario({ id: 1, cancha_id: 1, hora_inicio: '19:00', hora_fin: '21:00' }),
      crearHorario({ id: 2, cancha_id: 1, hora_inicio: '21:00', hora_fin: '23:00' }),
      crearHorario({ id: 3, cancha_id: 2, hora_inicio: '19:00', hora_fin: '21:00' }),
    ],
    pendientes: 0,
    pagos_informados: 0,
    ...parcial,
  };
}
