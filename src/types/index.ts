export type Club = {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
};

export type Court = {
  id: number;
  club_id: number | null;
  nombre_identificador: string;
  titulo: string;
  descripcion: string | null;
  fotos: string[];
  precio_total: number;
  precio_sena: number;
  clubes?: Club | null;
};

export type Turno = {
  id: number;
  cancha_id: number | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'disponible' | 'pre_reservado' | 'reservado' | 'bloqueado_club';
  canchas?: Court | null;
};

export type PartidoPublico = {
  id: number;
  organizador_id: string;
  estado_partido: string;
  cupo_minimo: number;
  cupo_maximo: number;
  cantidad_invitados_anonimos: number;
  nivel_requerido: 'recreativo' | 'intermedio' | 'competitivo';
  requiere_aprobacion: boolean;
  expira_pre_reserva_at: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cancha_nombre: string;
  precio_total: number;
  precio_sena: number;
  club_nombre: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  jugadores_confirmados: number;
  mi_estado_inscripcion: string | null;
};

export type Perfil = {
  id: string;
  nombre_completo: string | null;
  email: string;
  nivel_voley: number | null;
  rol: string | null;
  puntos_total: number | null;
  partidos_jugados: number | null;
};

export type ClubPublico = {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
};

export type CanchaDetalle = {
  id: number;
  club_id: number | null;
  nombre_identificador: string;
  titulo: string;
  descripcion: string | null;
  fotos: string[];
  precio_total: number;
  precio_sena: number;
};

export const TURNO_ESTADO_LABEL: Record<Turno['estado'], string> = {
  disponible: 'Disponible',
  pre_reservado: 'Pre-reservado',
  reservado: 'Ocupado',
  bloqueado_club: 'Bloqueado',
};

export type Participante = {
  usuario_id: string;
  nombre: string | null;
  estado_inscripcion: string;
  created_at: string;
};

export type PartidoDetalle = PartidoPublico & {
  organizador_id: string;
  reserva_id: number;
  reserva_expira_at: string | null;
  turno_id: number;
  cancha_id: number;
  club_id: number;
  participantes: Participante[] | null;
  mi_estado_inscripcion: string | null;
  token_invitacion: string | null;
};

// Admin types
export type ClubAdmin = {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  latitud: number;
  longitud: number;
  created_at: string;
  canchas_count: number;
};

export type CanchaAdmin = {
  id: number;
  club_id: number;
  club_nombre: string;
  titulo: string;
  nombre_identificador: string | null;
  descripcion: string | null;
  precio_total: number;
  precio_sena: number;
  fotos: string[];
  turnos_count: number;
};

export type TurnoAdmin = {
  id: number;
  cancha_id: number;
  cancha_titulo: string;
  club_nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
};

export type ReservaAdmin = {
  id: number;
  turno_id: number;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string;
  cancha_titulo: string;
  club_nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  monto_sena_pagado: number;
  estado_pago: string;
  created_at: string;
};

export type PartidoAdmin = {
  id: number;
  organizador_id: string;
  organizador_nombre: string;
  organizador_email: string;
  cancha_titulo: string;
  club_nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  nivel_requerido: string;
  estado_partido: string;
  cupo_minimo: number;
  cupo_maximo: number;
  jugadores_confirmados: number;
  requiere_aprobacion: boolean;
};

export type UsuarioAdmin = {
  id: string;
  nombre_completo: string | null;
  email: string;
  nivel_voley: number | null;
  rol: string;
  created_at: string;
};

// Horarios semanales
export type HorarioSemanal = {
  id: number;
  cancha_id: number;
  dia_semana: number; // 0=Dom, 1=Lun, ..., 6=Sáb
  hora_inicio: string;
  hora_fin: string;
  precio_total: number;
  precio_sena: number;
  activo: boolean;
};

export const DIA_SEMANA_LABEL: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export const DIA_SEMANA_CORTO: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

// Turno virtual (generado dinámicamente desde horarios_semanales)
export type TurnoVirtual = {
  id: number | null; // null si es virtual (no reservado aún)
  cancha_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'disponible' | 'pre_reservado' | 'reservado' | 'bloqueado_club';
  precio_total: number;
  precio_sena: number;
  horario_semanal_id: number;
};

// Fase 3: Social
export type MensajePartido = {
  id: number;
  partido_id: number;
  usuario_id: string;
  texto: string;
  created_at: string;
  nombre?: string;
};

export type BadgeCatalogo = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
};

export type UsuarioBadge = BadgeCatalogo & {
  otorgado_at: string;
};

export type RankingEntry = {
  id: string;
  nombre_completo: string | null;
  nivel_voley: number | null;
  puntos_total: number;
  posicion: number;
};

// Fase 2: Notificaciones
export type Notificacion = {
  id: number;
  tipo: string;
  titulo: string;
  partido_id: number | null;
  leida: boolean;
  created_at: string;
};
