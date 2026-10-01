import type { PGlite } from '@electric-sql/pglite';
import { crearUsuario, rpc, sql, type Actor } from './harness';

export type Usuario = Actor & { tipo: 'usuario'; id: string; email: string };

export type ClubDePrueba = {
  clubId: number;
  canchas: number[];
  dueno: Usuario;
  admin: Usuario;
};

/** Bloques publicados por defecto: todos los días, incluido uno que termina a medianoche. */
export const BLOQUES_POR_DEFECTO = [0, 1, 2, 3, 4, 5, 6].flatMap((dia) => [
  { dia_semana: dia, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 30000, precio_sena: 10000 },
  { dia_semana: dia, hora_inicio: '20:00', hora_fin: '22:00', precio_total: 36000, precio_sena: 12000 },
  { dia_semana: dia, hora_inicio: '22:00', hora_fin: '00:00', precio_total: 32000, precio_sena: 10000 },
]);

export async function nuevoUsuario(db: PGlite, datos: Parameters<typeof crearUsuario>[1] = {}): Promise<Usuario> {
  return (await crearUsuario(db, datos)) as Usuario;
}

/**
 * Crea un club completo usando las mismas RPC que la aplicación: el admin lo
 * da de alta, invita al dueño, el dueño acepta, carga canchas y horarios y lo
 * publica.
 */
export async function prepararClub(
  db: PGlite,
  opciones: { nombre?: string; canchas?: number; confirmacionAutomatica?: boolean; admin?: Usuario } = {},
): Promise<ClubDePrueba> {
  const admin = opciones.admin ?? await nuevoUsuario(db, { nombre: 'Admin VoleyApp', rol: 'superadmin' });
  const nombre = opciones.nombre ?? `Club ${Math.random().toString(36).slice(2, 7)}`;
  const { club_id: clubId } = await rpc<{ club_id: number }>(db, admin, 'admin_crear_club', {
    p_nombre: nombre, p_zona: 'Lanús', p_latitud: -34.7, p_longitud: -58.39,
  });
  const dueno = await nuevoUsuario(db, { nombre: 'Dueña del club' });
  const { token } = await rpc<{ token: string }>(db, admin, 'club_invitar', {
    p_club_id: clubId, p_email: dueno.email, p_rol: 'dueno',
  });
  await rpc(db, dueno, 'aceptar_invitacion_club', { p_token: token });

  const canchas: number[] = [];
  for (let indice = 1; indice <= (opciones.canchas ?? 2); indice += 1) {
    const cancha = await rpc<{ id: number }>(db, dueno, 'club_guardar_cancha', {
      p_club_id: clubId, p_titulo: `Cancha ${indice}`, p_precio_total: 30000, p_precio_sena: 10000, p_orden: indice,
    });
    await rpc(db, dueno, 'club_guardar_horarios', { p_cancha_id: cancha.id, p_bloques: BLOQUES_POR_DEFECTO });
    canchas.push(cancha.id);
  }
  await rpc(db, dueno, 'club_actualizar', {
    p_club_id: clubId,
    p_datos: {
      publicado: true, whatsapp: '5491122334455', alias_pago: 'club.voley.mp', titular_pago: 'Club SA',
      confirmacion_automatica: opciones.confirmacionAutomatica ?? false,
    },
  });
  return { clubId, canchas, dueno, admin };
}

/** Abre las reservas del piloto y habilita a los jugadores indicados. */
export async function abrirReservas(db: PGlite, admin: Usuario, jugadores: Usuario[]): Promise<void> {
  await rpc(db, admin, 'admin_configurar_operacion', { p_reservas_pausadas: false, p_requiere_lista_acceso: true });
  for (const jugador of jugadores) {
    await rpc(db, admin, 'admin_definir_acceso', { p_usuario_id: jugador.id, p_habilitado: true });
  }
}

/** Fecha (YYYY-MM-DD) del próximo día de la semana indicado, al menos `semanas` semanas adelante. */
export async function proximaFecha(db: PGlite, diaSemana: number, semanas = 1): Promise<string> {
  const [{ fecha }] = await sql<{ fecha: string }>(db,
    `select to_char(private.hoy_ar() + ((($1::int - extract(dow from private.hoy_ar())::int) + 7) % 7) + 7 * $2::int,
      'YYYY-MM-DD') as fecha`, [diaSemana, semanas]);
  return fecha;
}

/** Instante (ISO) de una fecha y hora de Buenos Aires. */
export async function instante(db: PGlite, fecha: string, hora: string): Promise<string> {
  const [{ valor }] = await sql<{ valor: string }>(db,
    `select to_char(private.instante_ar($1::date, $2::time) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as valor`,
    [fecha, hora]);
  return valor;
}

export async function horarioId(db: PGlite, canchaId: number, diaSemana: number, horaInicio: string): Promise<number> {
  const [fila] = await sql<{ id: number }>(db,
    `select id from public.horarios_semanales where cancha_id = $1 and dia_semana = $2 and hora_inicio = $3::time`,
    [canchaId, diaSemana, horaInicio]);
  if (!fila) throw new Error('Bloque no encontrado');
  return fila.id;
}

export async function notificacionesDe(db: PGlite, usuario: Usuario): Promise<{ tipo: string; titulo: string }[]> {
  return sql(db, `select tipo, titulo from public.notificaciones where usuario_id = $1 order by id`, [usuario.id]);
}
