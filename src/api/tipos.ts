// Tipos de los datos que devuelven las RPC de Supabase (ver docs/arquitectura.md).
// Los instantes llegan como ISO 8601 y las fechas de calendario como YYYY-MM-DD.

import type { NivelPartido } from '@/lib/nivel';

export type RolClub = 'dueno' | 'encargado';
export type RolGlobal = 'jugador' | 'admin_cancha' | 'admin_global' | 'superadmin';

export type EstadoOperacion = {
  reservas_pausadas: boolean;
  motivo_pausa: string | null;
  requiere_lista_acceso: boolean;
  cuenta_habilitada: boolean;
  puede_reservar: boolean;
};

export type Perfil = {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  nivel: number | null;
  rol: RolGlobal;
  puntos: number;
  partidos_jugados: number;
  es_admin: boolean;
  es_superadmin: boolean;
  clubes: { id: number; nombre: string; slug: string; rol: RolClub }[];
};

// ---------------------------------------------------------------------------
// Catálogo público
// ---------------------------------------------------------------------------

export type Superficie = 'parquet' | 'sintetico' | 'cemento' | 'arena' | 'otro';

export type CanchaPublica = {
  id: number;
  club_id: number;
  titulo: string;
  descripcion: string | null;
  fotos: string[];
  precio_total: number;
  precio_sena: number;
  techada: boolean;
  superficie: Superficie | null;
  orden: number;
};

export type ClubPublico = {
  id: number;
  nombre: string;
  slug: string;
  direccion: string | null;
  zona: string | null;
  telefono: string | null;
  whatsapp: string | null;
  instagram: string | null;
  descripcion: string | null;
  latitud: number | null;
  longitud: number | null;
  politicas: string | null;
  confirmacion_automatica: boolean;
  anticipacion_minima_min: number;
  ventana_reserva_dias: number;
  cancelacion_horas: number;
  respuesta_horas: number;
  canchas: CanchaPublica[];
};

export type EstadoBloque = 'libre' | 'ocupado' | 'no_disponible' | 'mi_solicitud' | 'mi_reserva';

export type BloqueDisponible = {
  horario_id: number;
  cancha_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  inicio: string;
  fin: string;
  precio: number;
  sena: number;
  estado: EstadoBloque;
  ocupacion_id: number | null;
};

export type Disponibilidad = { desde: string; hasta: string; bloques: BloqueDisponible[] };

// ---------------------------------------------------------------------------
// Jugadores: reservas y partidos
// ---------------------------------------------------------------------------

export type EstadoOcupacion = 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada' | 'vencida';
export type EstadoPago = 'pendiente' | 'parcial' | 'pagado' | 'sin_cargo' | 'a_devolver';
export type OrigenOcupacion = 'app' | 'whatsapp' | 'telefono' | 'mostrador' | 'fijo' | 'otro';

export type ConfigPartido = {
  cupo_minimo: number;
  cupo_maximo: number;
  invitados: number;
  nivel_requerido: NivelPartido;
  visibilidad: 'publico' | 'enlace';
  requiere_aprobacion: boolean;
  descripcion?: string | null;
  precio_por_jugador?: number | null;
};

export type ResultadoSolicitud = {
  ocupacion_id: number;
  estado: 'pendiente' | 'confirmada';
  vence_at: string | null;
  partido_id: number | null;
  precio: number;
  sena: number;
  club: { id: number; nombre: string; whatsapp: string | null; alias_pago: string | null; titular_pago: string | null };
};

export type MiReserva = {
  id: number;
  inicio: string;
  fin: string;
  estado: EstadoOcupacion;
  origen: OrigenOcupacion;
  precio: number;
  sena: number;
  pagado: number;
  estado_pago: EstadoPago;
  vence_at: string | null;
  pago_informado_at: string | null;
  motivo_cancelacion: string | null;
  cancelada_por: 'club' | 'jugador' | 'sistema' | null;
  es_fijo: boolean;
  puede_cancelar: boolean;
  cancelacion_horas: number;
  club: {
    id: number; nombre: string; slug: string; direccion: string | null; telefono: string | null;
    whatsapp: string | null; alias_pago: string | null; titular_pago: string | null;
  };
  cancha: { id: number; titulo: string };
  partido: { id: number; estado: EstadoPartido } | null;
};

export type EstadoPartido = 'borrador' | 'pre_reservado' | 'abierto' | 'confirmado' | 'cancelado' | 'finalizado';
export type EstadoInscripcion = 'confirmado' | 'pendiente_aprobacion' | 'rechazado' | 'pendiente_pago';

export type ClubResumen = {
  id: number; nombre: string; slug: string; direccion: string | null; zona: string | null;
  latitud: number | null; longitud: number | null;
};

export type PartidoExplorado = {
  id: number;
  inicio: string;
  fin: string;
  nivel_requerido: NivelPartido;
  cupo_minimo: number;
  cupo_maximo: number;
  ocupados: number;
  requiere_aprobacion: boolean;
  descripcion: string | null;
  precio_total: number;
  precio_por_jugador: number | null;
  organiza_club: boolean;
  organizador_nombre: string;
  club: ClubResumen;
  cancha: { id: number; titulo: string };
  mi_estado: EstadoInscripcion | null;
  soy_organizador: boolean;
  distancia_km: number | null;
};

export type ParticipantePartido = {
  usuario_id: string | null;
  nombre: string;
  nivel: number | null;
  estado: EstadoInscripcion;
  es_organizador: boolean;
  soy_yo: boolean;
};

export type PartidoDetalle = {
  id: number;
  estado_partido: EstadoPartido;
  visibilidad: 'publico' | 'enlace' | 'privado';
  nivel_requerido: NivelPartido;
  cupo_minimo: number;
  cupo_maximo: number;
  invitados: number;
  ocupados: number;
  requiere_aprobacion: boolean;
  descripcion: string | null;
  precio_total: number;
  precio_por_jugador: number | null;
  inicio: string;
  fin: string;
  estado_reserva: EstadoOcupacion;
  club: ClubResumen & { whatsapp: string | null };
  cancha: { id: number; titulo: string; techada: boolean; superficie: Superficie | null };
  organiza_club: boolean;
  organizador_nombre: string;
  soy_organizador: boolean;
  soy_staff: boolean;
  mi_estado: EstadoInscripcion | null;
  token: string | null;
  participantes: ParticipantePartido[];
};

export type MiPartido = {
  id: number;
  estado_partido: EstadoPartido;
  visibilidad: 'publico' | 'enlace' | 'privado';
  nivel_requerido: NivelPartido;
  cupo_minimo: number;
  cupo_maximo: number;
  ocupados: number;
  inicio: string;
  fin: string;
  estado_reserva: EstadoOcupacion;
  soy_organizador: boolean;
  mi_estado: EstadoInscripcion | null;
  club: { id: number; nombre: string; slug: string; zona: string | null };
  cancha: { id: number; titulo: string };
};

export type Mensaje = { id: number; texto: string; created_at: string; autor: string; es_mio: boolean };

export type Notificacion = {
  id: number;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  url: string | null;
  partido_id: number | null;
  leida: boolean;
  created_at: string;
};

export type Logro = { id: string; nombre: string; descripcion: string; icono: string; otorgado_at: string | null };
export type PosicionRanking = { posicion: number; nombre: string; nivel: number | null; puntos: number; soy_yo: boolean };

export type InvitacionClub = {
  valida: boolean;
  motivo: 'no_existe' | 'aceptada' | 'revocada' | 'vencida' | null;
  club_nombre?: string;
  rol?: RolClub;
  email?: string;
  expira_at?: string;
};

// ---------------------------------------------------------------------------
// Gestión del club
// ---------------------------------------------------------------------------

export type ClubConfig = {
  id: number;
  nombre: string;
  slug: string;
  direccion: string | null;
  zona: string | null;
  telefono: string | null;
  whatsapp: string | null;
  instagram: string | null;
  descripcion: string | null;
  alias_pago: string | null;
  titular_pago: string | null;
  latitud: number | null;
  longitud: number | null;
  publicado: boolean;
  confirmacion_automatica: boolean;
  anticipacion_minima_min: number;
  ventana_reserva_dias: number;
  cancelacion_horas: number;
  respuesta_horas: number;
  politicas: string | null;
};

export type CanchaGestion = CanchaPublica & { activa: boolean };

export type HorarioPublicado = {
  id: number;
  cancha_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  precio_total: number;
  precio_sena: number;
  activo: boolean;
};

export type ClubPanel = {
  mi_rol: RolClub;
  club: ClubConfig;
  canchas: CanchaGestion[];
  horarios: HorarioPublicado[];
  pendientes: number;
  pagos_informados: number;
};

export type ClienteResumen = {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  es_usuario_app: boolean;
};

export type Ocupacion = {
  id: number;
  cancha_id: number;
  inicio: string;
  fin: string;
  tipo: 'reserva' | 'bloqueo';
  estado: EstadoOcupacion;
  origen: OrigenOcupacion;
  titulo: string | null;
  precio: number;
  sena: number;
  pagado: number;
  estado_pago: EstadoPago;
  asistencia: 'jugaron' | 'no_vinieron' | null;
  notas: string | null;
  vence_at: string | null;
  pago_informado_at: string | null;
  motivo_cancelacion: string | null;
  cancelada_por: 'club' | 'jugador' | 'sistema' | null;
  serie_id: number | null;
  created_at: string;
  cliente: ClienteResumen | null;
  jugador: { nombre: string; email: string; telefono: string | null } | null;
  partido: {
    id: number; estado: EstadoPartido; ocupados: number; cupo_minimo: number; cupo_maximo: number; organiza_club: boolean;
  } | null;
};

export type Agenda = { desde: string; hasta: string; ocupaciones: Ocupacion[] };

export type Cliente = ClienteResumen & { notas: string | null; archivado: boolean; created_at: string };

export type ClienteListado = Cliente & {
  saldo: number;
  reservas: number;
  ultima: string | null;
  proxima: string | null;
  fijos: number;
};

export type MedioPago = 'efectivo' | 'transferencia' | 'mercadopago' | 'tarjeta' | 'otro';

export type PagoDeCliente = {
  id: number; fecha: string; monto: number; medio: MedioPago; nota: string | null; anulado: boolean; ocupacion_id: number | null;
};

export type ClienteDetalle = {
  cliente: Cliente;
  saldo: number;
  ocupaciones: Ocupacion[];
  pagos: PagoDeCliente[];
  series: { id: number; titulo: string; dia_semana: number; hora_inicio: string; duracion_min: number; activa: boolean }[];
};

export type Serie = {
  id: number;
  titulo: string;
  cliente: { id: number; nombre: string; telefono: string | null } | null;
  cancha: { id: number; titulo: string };
  dia_semana: number;
  hora_inicio: string;
  duracion_min: number;
  desde: string;
  hasta: string | null;
  precio: number;
  notas: string | null;
  vigente: boolean;
  proxima: string | null;
  fechas_futuras: number;
  deuda: number;
};

export type VistaPreviaSerie = {
  fechas: number;
  primera: string | null;
  horizonte: string;
  conflictos: { fecha: string; detalle: string }[];
};

export type ResultadoSerie = { serie_id: number; creadas: number; conflictos: string[]; canceladas?: number };

export type PagoCaja = {
  id: number;
  fecha: string;
  monto: number;
  medio: MedioPago;
  nota: string | null;
  anulado: boolean;
  created_at: string;
  cliente: { id: number; nombre: string } | null;
  ocupacion: { id: number; inicio: string; cancha: string; titulo: string | null } | null;
  registrado_por: string;
};

export type Caja = {
  pagos: PagoCaja[];
  totales: { total: number; ingresos: number; devoluciones: number; por_medio: Partial<Record<MedioPago, number>> };
  a_devolver: Ocupacion[];
};

export type Deudas = {
  clientes: { cliente: Cliente; saldo: number; impagas: number }[];
  sin_cliente: Ocupacion[];
};

export type Reporte = {
  desde: string;
  hasta: string;
  minutos_disponibles: number;
  minutos_reservados: number;
  reservas: number;
  facturado: number;
  cobrado: number;
  por_origen: Partial<Record<OrigenOcupacion, number>>;
  canceladas: Partial<Record<'club' | 'jugador' | 'sistema' | 'otro', number>>;
  no_vinieron: number;
  por_cancha: { cancha_id: number; titulo: string; minutos_disponibles: number; minutos_reservados: number }[];
  calor: { dia: number; hora: number; ocupados: number; disponibles: number }[];
  top_clientes: { cliente_id: number; nombre: string; reservas: number; monto: number }[];
};

export type Equipo = {
  miembros: { user_id: string; nombre: string; email: string; rol: RolClub; created_at: string; soy_yo: boolean }[];
  invitaciones: { id: number; email: string; rol: RolClub; expira_at: string; created_at: string }[];
};

export type InvitacionCreada = { id: number; token: string; email: string; rol: RolClub; expira_at: string };

export type EventoAuditoria = {
  id: number;
  created_at: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalle: Record<string, unknown>;
  actor: string;
  club?: string | null;
};

export type BloqueHorario = {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  precio_total: number;
  precio_sena: number;
};

// ---------------------------------------------------------------------------
// Administración global
// ---------------------------------------------------------------------------

export type ResumenAdmin = {
  clubes: number;
  clubes_publicados: number;
  canchas: number;
  usuarios: number;
  usuarios_semana: number;
  reservas_semana: number;
  reservas_app_semana: number;
  pendientes: number;
  vencidas_semana: number;
  leads_nuevos: number;
  envios_con_error: number;
  operacion: EstadoOperacion;
};

export type ClubAdmin = {
  id: number;
  nombre: string;
  slug: string;
  zona: string | null;
  direccion: string | null;
  publicado: boolean;
  created_at: string;
  canchas: number;
  reservas_proximas: number;
  equipo: { nombre: string; email: string; rol: RolClub }[];
};

export type UsuarioAdmin = {
  id: string;
  nombre: string;
  email: string;
  rol: RolGlobal;
  nivel: number | null;
  telefono: string | null;
  created_at: string;
  habilitado: boolean;
  clubes: { id: number; nombre: string; rol: RolClub }[];
};

export type EstadoLead = 'nuevo' | 'contactado' | 'en_preparacion' | 'incorporado';

export type LeadClub = {
  id: number;
  club_nombre: string;
  localidad: string;
  contacto_nombre: string;
  contacto: string;
  cantidad_canchas: number;
  estado: EstadoLead;
  notas: string | null;
  created_at: string;
};
