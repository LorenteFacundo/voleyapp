import { supabase } from '@/lib/supabase';
import { rpc, rpcLista, traducirError } from './cliente';
import type {
  ClubAdmin, EstadoLead, EstadoOperacion, EventoAuditoria, LeadClub, ResumenAdmin, RolGlobal, UsuarioAdmin,
} from './tipos';

export const adminApi = {
  resumen: () => rpc<ResumenAdmin>('admin_resumen'),

  clubes: () => rpcLista<ClubAdmin>('admin_clubes'),

  crearClub: (datos: {
    nombre: string; zona?: string | null; direccion?: string | null; latitud?: number | null; longitud?: number | null;
    telefono?: string | null; whatsapp?: string | null;
  }) =>
    rpc<{ club_id: number; slug: string }>('admin_crear_club', {
      p_nombre: datos.nombre,
      p_zona: datos.zona || null,
      p_direccion: datos.direccion || null,
      p_latitud: datos.latitud ?? null,
      p_longitud: datos.longitud ?? null,
      p_telefono: datos.telefono || null,
      p_whatsapp: datos.whatsapp || null,
    }),

  usuarios: (busqueda?: string | null, limite = 50) =>
    rpcLista<UsuarioAdmin>('admin_usuarios', { p_busqueda: busqueda?.trim() || null, p_limite: limite }),

  actualizarRol: (usuarioId: string, rol: RolGlobal) =>
    rpc<void>('admin_actualizar_rol', { p_usuario_id: usuarioId, p_rol: rol }),

  configurarOperacion: (datos: { reservasPausadas: boolean; requiereListaAcceso: boolean; motivo?: string | null }) =>
    rpc<EstadoOperacion>('admin_configurar_operacion', {
      p_reservas_pausadas: datos.reservasPausadas,
      p_requiere_lista_acceso: datos.requiereListaAcceso,
      p_motivo: datos.motivo || null,
    }),

  definirAcceso: (usuarioId: string, habilitado: boolean) =>
    rpc<void>('admin_definir_acceso', { p_usuario_id: usuarioId, p_habilitado: habilitado }),

  auditoria: (limite = 200) => rpcLista<EventoAuditoria>('admin_auditoria', { p_limite: limite }),

  ejecutarTareas: () => rpc<Record<string, number>>('admin_ejecutar_tareas'),

  async leads(): Promise<LeadClub[]> {
    const { data, error } = await supabase
      .from('solicitudes_club')
      .select('id,club_nombre,localidad,contacto_nombre,contacto,cantidad_canchas,estado,notas,created_at')
      .order('created_at', { ascending: false });
    if (error) throw traducirError(error);
    return (data ?? []) as LeadClub[];
  },

  async actualizarLead(id: number, cambios: { estado?: EstadoLead; notas?: string | null }): Promise<void> {
    const { error } = await supabase.from('solicitudes_club').update(cambios).eq('id', id);
    if (error) throw traducirError(error);
  },
};
