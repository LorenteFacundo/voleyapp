// Datos de ejemplo para las pruebas de Ajustes.

import type { CanchaGestion, ClubConfig, ClubPanel, Equipo, HorarioPublicado } from '@/api/tipos';

export const CLUB: ClubConfig = {
  id: 1,
  nombre: 'Club Sur',
  slug: 'club-sur',
  direccion: 'Av. Siempreviva 742',
  zona: 'Lanús',
  telefono: null,
  whatsapp: '5491122334455',
  instagram: 'clubsur',
  descripcion: null,
  alias_pago: null,
  titular_pago: null,
  latitud: null,
  longitud: null,
  publicado: false,
  confirmacion_automatica: false,
  anticipacion_minima_min: 60,
  ventana_reserva_dias: 21,
  cancelacion_horas: 24,
  respuesta_horas: 12,
  politicas: null,
};

export function cancha(id: number, titulo: string, cambios: Partial<CanchaGestion> = {}): CanchaGestion {
  return {
    id, club_id: 1, titulo, descripcion: null, fotos: [], precio_total: 30000, precio_sena: 10000,
    techada: true, superficie: 'parquet', orden: id, activa: true, ...cambios,
  };
}

export function horario(id: number, canchaId: number, dia: number, inicio: string, fin: string): HorarioPublicado {
  return { id, cancha_id: canchaId, dia_semana: dia, hora_inicio: inicio, hora_fin: fin, precio_total: 30000, precio_sena: 10000, activo: true };
}

export const PANEL: ClubPanel = {
  mi_rol: 'dueno',
  club: CLUB,
  canchas: [cancha(10, 'Cancha 1'), cancha(11, 'Cancha 2', { activa: false })],
  horarios: [horario(1, 10, 1, '18:00', '20:00')],
  pendientes: 0,
  pagos_informados: 0,
};

export const EQUIPO: Equipo = {
  miembros: [
    { user_id: 'u1', nombre: 'Facundo', email: 'facu@mail.com', rol: 'dueno', created_at: '2026-09-01T12:00:00.000Z', soy_yo: true },
    { user_id: 'u2', nombre: 'Ana Pérez', email: 'ana@mail.com', rol: 'encargado', created_at: '2026-09-10T12:00:00.000Z', soy_yo: false },
  ],
  invitaciones: [
    { id: 5, email: 'bruno@mail.com', rol: 'encargado', expira_at: '2026-10-05T12:00:00.000Z', created_at: '2026-09-28T12:00:00.000Z' },
  ],
};
