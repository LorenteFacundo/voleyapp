// Textos y reglas de la administración global.

import type { EstadoLead, RolGlobal } from '@/api/tipos';
import { fechaArgentina, formatDiaMes } from '@/lib/date';
import { enlaceWhatsApp, formatTelefono, normalizarTelefono } from '@/lib/telefono';

export const ROLES_GLOBALES: { valor: RolGlobal; etiqueta: string; descripcion: string }[] = [
  { valor: 'jugador', etiqueta: 'Jugador', descripcion: 'Usa la app para reservar y jugar. Puede ser parte del equipo de un club igual.' },
  {
    valor: 'admin_cancha',
    etiqueta: 'Admin de cancha (anterior)',
    descripcion: 'Rol de la versión anterior, sin permisos extra. Los clubes ahora se gestionan desde el equipo de cada club.',
  },
  {
    valor: 'admin_global',
    etiqueta: 'Administración',
    descripcion: 'Gestiona todos los clubes, usuarios, clubes interesados y la operación de VoleyApp.',
  },
  {
    valor: 'superadmin',
    etiqueta: 'Superadmin',
    descripcion: 'Igual que administración y, además, puede otorgar o quitar roles de administración.',
  },
];

export function etiquetaRolGlobal(rol: RolGlobal): string {
  return ROLES_GLOBALES.find((opcion) => opcion.valor === rol)?.etiqueta ?? rol;
}

const ROLES_ADMINISTRACION: RolGlobal[] = ['admin_global', 'superadmin'];

export function esRolAdministracion(rol: RolGlobal): boolean {
  return ROLES_ADMINISTRACION.includes(rol);
}

export type PermisoRol = { editable: boolean; motivo: string | null; bloqueados: RolGlobal[] };

/** Replica las reglas de admin_actualizar_rol para no ofrecer cambios que el servidor rechaza. */
export function permisoCambioRol(
  actor: { id: string; es_superadmin: boolean } | null, usuario: { id: string; rol: RolGlobal },
): PermisoRol {
  if (!actor) return { editable: false, motivo: null, bloqueados: [] };
  if (actor.id === usuario.id) return { editable: false, motivo: 'No podés cambiar tu propio rol.', bloqueados: [] };
  if (actor.es_superadmin) return { editable: true, motivo: null, bloqueados: [] };
  if (esRolAdministracion(usuario.rol)) {
    return { editable: false, motivo: 'Solo un superadmin puede cambiar el rol de otra persona de la administración.', bloqueados: [] };
  }
  return { editable: true, motivo: null, bloqueados: ROLES_ADMINISTRACION };
}

export const ESTADOS_LEAD: { valor: EstadoLead; etiqueta: string; plural: string }[] = [
  { valor: 'nuevo', etiqueta: 'Nuevo', plural: 'Nuevos' },
  { valor: 'contactado', etiqueta: 'Contactado', plural: 'Contactados' },
  { valor: 'en_preparacion', etiqueta: 'En preparación', plural: 'En preparación' },
  { valor: 'incorporado', etiqueta: 'Incorporado', plural: 'Incorporados' },
];

export type ContactoLead =
  | { tipo: 'email'; texto: string; href: string }
  | { tipo: 'whatsapp'; texto: string; href: string; numero: string }
  | { tipo: 'texto'; texto: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Interpreta el "Email o WhatsApp" que dejaron en el formulario de la landing. */
export function contactoLead(contacto: string, club = ''): ContactoLead {
  const limpio = contacto.trim();
  if (EMAIL.test(limpio)) return { tipo: 'email', texto: limpio, href: `mailto:${limpio}` };
  if (/^[+\d\s().-]+$/.test(limpio)) {
    const numero = normalizarTelefono(limpio);
    if (numero && numero.length >= 10) {
      const saludo = `¡Hola! Te escribo de VoleyApp por tu consulta${club ? ` para sumar ${club}` : ''}.`;
      return { tipo: 'whatsapp', texto: formatTelefono(numero), href: enlaceWhatsApp(numero, saludo), numero };
    }
  }
  return { tipo: 'texto', texto: limpio };
}

const CATEGORIAS: Record<string, string> = {
  reserva: 'Reservas',
  agenda: 'Agenda',
  pago: 'Cobros',
  cliente: 'Clientes',
  fijo: 'Fijos',
  club: 'Club',
  cancha: 'Canchas',
  horarios: 'Horarios',
  equipo: 'Equipo',
  partido: 'Partidos',
  operacion: 'Operación',
  acceso: 'Acceso al piloto',
};

const ACCIONES: Record<string, string> = {
  'reserva.solicitar': 'Pedido de reserva desde la app',
  'reserva.crear': 'Reserva cargada por el club',
  'reserva.confirmar': 'Pedido confirmado',
  'reserva.rechazar': 'Pedido rechazado',
  'reserva.cancelar_club': 'Reserva cancelada por el club',
  'reserva.cancelar_jugador': 'Reserva cancelada por el jugador',
  'reserva.mover': 'Reserva movida',
  'reserva.editar': 'Reserva editada',
  'agenda.bloquear': 'Horario bloqueado',
  'agenda.desbloquear': 'Bloqueo quitado',
  'pago.registrar': 'Cobro registrado',
  'pago.anular': 'Cobro anulado',
  'cliente.crear': 'Cliente creado',
  'cliente.editar': 'Cliente editado',
  'fijo.crear': 'Alquiler fijo creado',
  'fijo.editar': 'Alquiler fijo editado',
  'fijo.reprogramar': 'Alquiler fijo reprogramado',
  'fijo.finalizar': 'Alquiler fijo finalizado',
  'club.crear': 'Club creado',
  'club.configurar': 'Ajustes del club modificados',
  'cancha.crear': 'Cancha creada',
  'cancha.editar': 'Cancha editada',
  'horarios.guardar': 'Horarios publicados actualizados',
  'equipo.invitar': 'Invitación al equipo creada',
  'equipo.revocar_invitacion': 'Invitación al equipo anulada',
  'equipo.aceptar_invitacion': 'Invitación al equipo aceptada',
  'equipo.cambiar_rol': 'Rol en el equipo cambiado',
  'equipo.quitar': 'Persona quitada del equipo',
  'partido.publicar': 'Partido abierto publicado',
  'operacion.configurar': 'Operación de la app modificada',
  'acceso.habilitar': 'Cuenta habilitada para el piloto',
  'acceso.quitar': 'Acceso al piloto retirado',
};

export function categoriaAccion(accion: string): string {
  return accion.split('.')[0];
}

export function etiquetaCategoria(categoria: string): string {
  return CATEGORIAS[categoria] ?? categoria.charAt(0).toUpperCase() + categoria.slice(1);
}

/** "reserva.confirmar" → "Pedido confirmado" (o una versión legible si no se conoce). */
export function etiquetaAccion(accion: string): string {
  if (ACCIONES[accion]) return ACCIONES[accion];
  const [categoria, ...resto] = accion.split('.');
  const detalle = resto.join(' ').replace(/_/g, ' ');
  return detalle ? `${etiquetaCategoria(categoria)}: ${detalle}` : etiquetaCategoria(categoria);
}

export const TAREAS_PROGRAMADAS: Record<string, string> = {
  vencidas: 'Pedidos vencidos sin respuesta',
  partidos_finalizados: 'Partidos jugados cerrados',
  recordatorios: 'Recordatorios enviados a la cola',
  fijos_generados: 'Fechas de fijos generadas',
};

/** "6 oct" (o "6 oct 2025" si no es de este año), en hora argentina. */
export function fechaCorta(instante: string, hoy = new Date()): string {
  const fecha = fechaArgentina(instante);
  const anio = fecha.slice(0, 4);
  return anio === fechaArgentina(hoy).slice(0, 4) ? formatDiaMes(fecha) : `${formatDiaMes(fecha)} ${anio}`;
}

/** Minúsculas y sin acentos, para buscar. */
export function textoBuscable(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
