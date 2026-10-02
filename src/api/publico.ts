import { supabase } from '@/lib/supabase';
import { ApiError, rpc, rpcLista, traducirError } from './cliente';
import type {
  ClubPublico, Disponibilidad, EstadoOperacion, InvitacionClub, PartidoDetalle, PartidoExplorado, PosicionRanking,
} from './tipos';

const COLUMNAS_CANCHA = 'id,club_id,titulo,descripcion,fotos,precio_total,precio_sena,techada,superficie,orden';
const COLUMNAS_CLUB = 'id,nombre,slug,direccion,zona,telefono,whatsapp,instagram,descripcion,latitud,longitud,'
  + 'politicas,confirmacion_automatica,anticipacion_minima_min,ventana_reserva_dias,cancelacion_horas,respuesta_horas';

/** Datos del formulario "Sumá tu cancha" de la landing. */
export type InteresClub = {
  club_nombre: string;
  localidad: string;
  contacto_nombre: string;
  contacto: string;
  cantidad_canchas: number;
  /** Campo trampa para bots: siempre vacío para personas. */
  website: string;
};

const ERROR_INTERES = 'No pudimos enviar tu consulta. Intentá de nuevo en un momento.';

/** Mensaje que devuelve la Edge Function (ya está en español) o uno genérico. */
async function mensajeDeFuncion(error: unknown): Promise<string> {
  const respuesta = (error as { context?: unknown } | null)?.context;
  if (respuesta instanceof Response) {
    try {
      const cuerpo = (await respuesta.clone().json()) as { error?: unknown };
      if (typeof cuerpo.error === 'string' && cuerpo.error.trim()) return cuerpo.error;
    } catch {
      // Sin cuerpo JSON: se usa el mensaje genérico.
    }
  }
  return ERROR_INTERES;
}

function ordenarCanchas(club: ClubPublico): ClubPublico {
  return {
    ...club,
    canchas: [...(club.canchas ?? [])].sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo)),
  };
}

export const publicoApi = {
  estadoOperacion: () => rpc<EstadoOperacion>('estado_operacion'),

  /** Clubes publicados con sus canchas activas. */
  async clubes(): Promise<ClubPublico[]> {
    const { data, error } = await supabase
      .from('clubes')
      .select(`${COLUMNAS_CLUB},canchas(${COLUMNAS_CANCHA})`)
      .order('nombre');
    if (error) throw traducirError(error);
    return ((data ?? []) as unknown as ClubPublico[]).map(ordenarCanchas);
  },

  async club(slug: string): Promise<ClubPublico | null> {
    const { data, error } = await supabase
      .from('clubes')
      .select(`${COLUMNAS_CLUB},canchas(${COLUMNAS_CANCHA})`)
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw traducirError(error);
    return data ? ordenarCanchas(data as unknown as ClubPublico) : null;
  },

  /** Para enlaces viejos /cancha/:id: devuelve el slug del club de la cancha. */
  async slugDeCancha(canchaId: number): Promise<string | null> {
    const { data, error } = await supabase
      .from('canchas')
      .select('id,clubes(slug)')
      .eq('id', canchaId)
      .maybeSingle();
    if (error) throw traducirError(error);
    const club = (data as { clubes?: { slug: string } | null } | null)?.clubes;
    return club?.slug ?? null;
  },

  disponibilidad: (params: { clubId?: number; canchaId?: number; desde: string; hasta: string }) =>
    rpc<Disponibilidad>('disponibilidad', {
      p_club_id: params.clubId ?? null,
      p_cancha_id: params.canchaId ?? null,
      p_desde: params.desde,
      p_hasta: params.hasta,
    }),

  explorarPartidos: (filtros: { nivel?: string | null; texto?: string | null; lat?: number | null; lng?: number | null; radioKm?: number | null } = {}) =>
    rpcLista<PartidoExplorado>('explorar_partidos', {
      p_nivel: filtros.nivel || null,
      p_texto: filtros.texto?.trim() || null,
      p_lat: filtros.radioKm ? filtros.lat ?? null : null,
      p_lng: filtros.radioKm ? filtros.lng ?? null : null,
      p_radio_km: filtros.radioKm || null,
    }),

  partidoDetalle: (id: number, token?: string | null) =>
    rpc<PartidoDetalle>('partido_detalle', { p_partido_id: id, p_token: token || null }),

  buscarPartidoPorToken: (token: string) => rpc<number | null>('buscar_partido_por_token', { p_token: token }),

  ranking: (limite = 10) => rpcLista<PosicionRanking>('ranking', { p_limite: limite }),

  verInvitacionClub: (token: string) => rpc<InvitacionClub>('ver_invitacion_club', { p_token: token }),

  /** Envía el formulario de clubes interesados (Edge Function submit-club-lead, con límite de envíos). */
  async enviarInteresClub(datos: InteresClub): Promise<void> {
    let error: unknown;
    try {
      ({ error } = await supabase.functions.invoke('submit-club-lead', { body: datos }));
    } catch {
      throw new ApiError(ERROR_INTERES);
    }
    if (error) throw new ApiError(await mensajeDeFuncion(error));
  },
};
