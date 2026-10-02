// Datos de ejemplo para las pruebas de las pantallas de gestión.

import type {
  Caja, ClienteDetalle, ClienteListado, ClubPanel, Deudas, Ocupacion, Reporte, Serie,
} from '@/api/tipos';

export const PANEL: ClubPanel = {
  mi_rol: 'dueno',
  club: {
    id: 1, nombre: 'Club Norte', slug: 'club-norte', direccion: null, zona: null, telefono: null, whatsapp: null,
    instagram: null, descripcion: null, alias_pago: 'club.norte.mp', titular_pago: 'Club Norte SRL', latitud: null,
    longitud: null, publicado: true, confirmacion_automatica: false, anticipacion_minima_min: 60, ventana_reserva_dias: 21,
    cancelacion_horas: 24, respuesta_horas: 12, politicas: null,
  },
  canchas: [
    { id: 10, club_id: 1, titulo: 'Cancha 1', descripcion: null, fotos: [], precio_total: 30000, precio_sena: 0, techada: true, superficie: 'parquet', orden: 1, activa: true },
    { id: 11, club_id: 1, titulo: 'Cancha 2', descripcion: null, fotos: [], precio_total: 30000, precio_sena: 0, techada: true, superficie: 'parquet', orden: 2, activa: true },
  ],
  horarios: [
    { id: 1, cancha_id: 10, dia_semana: 2, hora_inicio: '19:00', hora_fin: '20:30', precio_total: 36000, precio_sena: 0, activo: true },
  ],
  pendientes: 0,
  pagos_informados: 0,
};

export function cliente(cambios: Partial<ClienteListado> = {}): ClienteListado {
  return {
    id: 7, nombre: 'Ana Pérez', telefono: '5491122334455', email: 'ana@mail.com', es_usuario_app: true, notas: null,
    archivado: false, created_at: '2026-09-01T12:00:00.000Z', saldo: -12000, reservas: 8,
    ultima: '2026-09-29T22:00:00.000Z', proxima: null, fijos: 1,
    ...cambios,
  };
}

export function ocupacion(cambios: Partial<Ocupacion> = {}): Ocupacion {
  return {
    id: 100, cancha_id: 10, inicio: '2026-09-29T22:00:00.000Z', fin: '2026-09-29T23:30:00.000Z', tipo: 'reserva',
    estado: 'confirmada', origen: 'whatsapp', titulo: null, precio: 12000, sena: 0, pagado: 0, estado_pago: 'pendiente',
    asistencia: null, notas: null, vence_at: null, pago_informado_at: null, motivo_cancelacion: null, cancelada_por: null,
    serie_id: null, created_at: '2026-09-20T12:00:00.000Z',
    cliente: { id: 7, nombre: 'Ana Pérez', telefono: '5491122334455', email: 'ana@mail.com', es_usuario_app: true },
    jugador: null, partido: null,
    ...cambios,
  };
}

export function detalleCliente(cambios: Partial<ClienteDetalle> = {}): ClienteDetalle {
  const { saldo, reservas: _reservas, ultima: _ultima, proxima: _proxima, fijos: _fijos, ...datos } = cliente();
  return {
    cliente: datos,
    saldo,
    ocupaciones: [ocupacion()],
    pagos: [{ id: 50, fecha: '2026-09-15', monto: 5000, medio: 'efectivo', nota: 'Seña', anulado: false, ocupacion_id: null }],
    series: [{ id: 3, titulo: 'Martes vóley', dia_semana: 2, hora_inicio: '19:00', duracion_min: 90, activa: true }],
    ...cambios,
  };
}

export function serie(cambios: Partial<Serie> = {}): Serie {
  return {
    id: 3, titulo: 'Martes vóley', cliente: { id: 7, nombre: 'Ana Pérez', telefono: '5491122334455' },
    cancha: { id: 10, titulo: 'Cancha 1' }, dia_semana: 2, hora_inicio: '19:00', duracion_min: 90, desde: '2026-09-01',
    hasta: null, precio: 36000, notas: null, vigente: true, proxima: '2026-10-06T22:00:00.000Z', fechas_futuras: 12, deuda: 8000,
    ...cambios,
  };
}

export const CAJA: Caja = {
  pagos: [
    {
      id: 1, fecha: '2026-10-01', monto: 12000, medio: 'transferencia', nota: null, anulado: false, created_at: '2026-10-01T15:00:00.000Z',
      cliente: { id: 7, nombre: 'Ana Pérez' }, ocupacion: { id: 100, inicio: '2026-09-29T22:00:00.000Z', cancha: 'Cancha 1', titulo: null },
      registrado_por: 'Facu',
    },
    {
      id: 2, fecha: '2026-10-01', monto: -3000, medio: 'efectivo', nota: 'Devolución', anulado: false, created_at: '2026-10-01T16:00:00.000Z',
      cliente: null, ocupacion: null, registrado_por: 'Facu',
    },
  ],
  totales: { total: 9000, ingresos: 12000, devoluciones: 3000, por_medio: { transferencia: 12000, efectivo: -3000 } },
  a_devolver: [ocupacion({ id: 101, estado: 'cancelada', cancelada_por: 'club', pagado: 6000, estado_pago: 'a_devolver', motivo_cancelacion: 'Lluvia' })],
};

export const DEUDAS: Deudas = {
  clientes: [{ cliente: detalleCliente().cliente, saldo: -12000, impagas: 2 }],
  sin_cliente: [ocupacion({ id: 102, cliente: null, titulo: 'Turno suelto', precio: 10000, pagado: 2000 })],
};

export const REPORTE: Reporte = {
  desde: '2026-09-04',
  hasta: '2026-10-01',
  minutos_disponibles: 12000,
  minutos_reservados: 7200,
  reservas: 40,
  facturado: 1200000,
  cobrado: 950000,
  por_origen: { fijo: 24, whatsapp: 10, app: 6 },
  canceladas: { jugador: 3, sistema: 1 },
  no_vinieron: 2,
  por_cancha: [
    { cancha_id: 10, titulo: 'Cancha 1', minutos_disponibles: 6000, minutos_reservados: 4800 },
    { cancha_id: 11, titulo: 'Cancha 2', minutos_disponibles: 6000, minutos_reservados: 2400 },
  ],
  calor: [
    { dia: 2, hora: 15, ocupados: 0, disponibles: 480 },
    { dia: 2, hora: 16, ocupados: 0, disponibles: 480 },
    { dia: 2, hora: 19, ocupados: 480, disponibles: 480 },
    { dia: 4, hora: 20, ocupados: 300, disponibles: 480 },
  ],
  top_clientes: [{ cliente_id: 7, nombre: 'Ana Pérez', reservas: 8, monto: 96000 }],
};
