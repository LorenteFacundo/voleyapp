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
};

export type Perfil = {
  id: string;
  nombre_completo: string | null;
  email: string;
  nivel_voley: number | null;
  rol: string | null;
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
