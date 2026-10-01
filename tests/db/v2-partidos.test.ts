import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { ANON, crearBaseDePruebas, rpc, rpcFilas, sql } from './harness';
import {
  abrirReservas, horarioId, notificacionesDe, nuevoUsuario, prepararClub, proximaFecha,
  type ClubDePrueba, type Usuario,
} from './fixtures';

type Detalle = {
  id: number; estado_partido: string; ocupados: number; token: string | null; soy_organizador: boolean;
  mi_estado: string | null; participantes: { nombre: string; estado: string; usuario_id: string | null }[];
};

describe('modelo v2: partidos', () => {
  let db: PGlite;
  let club: ClubDePrueba;
  let organizadora: Usuario;
  let jugadores: Usuario[];

  beforeAll(async () => {
    db = await crearBaseDePruebas();
    club = await prepararClub(db, { nombre: 'Club Partidos' });
    organizadora = await nuevoUsuario(db, { nombre: 'Organizadora', nivel: 8 });
    jugadores = await Promise.all(['Ana', 'Beto', 'Caro', 'Dani'].map((nombre, indice) =>
      nuevoUsuario(db, { nombre, nivel: indice === 3 ? 2 : 6 })));
    await abrirReservas(db, club.admin, [organizadora, ...jugadores]);
  });

  async function crearPartido(dia: number, hora: string, partido: Record<string, unknown>, confirmar = true) {
    const solicitud = await rpc<{ ocupacion_id: number; partido_id: number }>(db, organizadora, 'solicitar_reserva', {
      p_horario_id: await horarioId(db, club.canchas[0], dia, hora), p_fecha: await proximaFecha(db, dia), p_partido: partido,
    });
    if (confirmar) {
      await rpc(db, club.dueno, 'club_resolver_solicitud', { p_ocupacion_id: solicitud.ocupacion_id, p_confirmar: true });
    }
    return solicitud;
  }

  it('un partido se publica recién cuando el club confirma la cancha', async () => {
    const solicitud = await crearPartido(1, '18:00', { cupo_minimo: 4, cupo_maximo: 8, nivel_requerido: 'recreativo' }, false);
    const antes = await rpcFilas<{ id: number }>(db, ANON, 'explorar_partidos', {});
    expect(antes.map((p) => p.id)).not.toContain(solicitud.partido_id);
    await expect(rpc(db, jugadores[0], 'partido_unirse', { p_partido_id: solicitud.partido_id })).rejects.toThrow(/no está recibiendo/);
    await rpc(db, club.dueno, 'club_resolver_solicitud', { p_ocupacion_id: solicitud.ocupacion_id, p_confirmar: true });
    const despues = await rpcFilas<{ id: number; ocupados: number }>(db, ANON, 'explorar_partidos', { p_nivel: 'recreativo' });
    expect(despues.find((p) => p.id === solicitud.partido_id)).toMatchObject({ ocupados: 1 });
  });

  it('respeta el cupo contando invitados y el nivel requerido', async () => {
    const { partido_id: id } = await crearPartido(2, '18:00', { cupo_minimo: 3, cupo_maximo: 3, invitados: 1, nivel_requerido: 'intermedio' });
    await expect(rpc(db, jugadores[3], 'partido_unirse', { p_partido_id: id })).rejects.toThrow(/nivel intermedio/);
    expect(await rpc(db, jugadores[0], 'partido_unirse', { p_partido_id: id })).toEqual({ estado_inscripcion: 'confirmado' });
    await expect(rpc(db, jugadores[1], 'partido_unirse', { p_partido_id: id })).rejects.toThrow(/completo/);
    await expect(rpc(db, jugadores[0], 'partido_unirse', { p_partido_id: id })).rejects.toThrow(/Ya estás anotado/);
    // Al llegar al mínimo se avisa a quienes juegan.
    expect((await notificacionesDe(db, organizadora)).map((n) => n.tipo)).toContain('partido_minimo');
  });

  it('los partidos por enlace exigen el token y solo lo ven quienes participan', async () => {
    const { partido_id: id } = await crearPartido(3, '18:00', { cupo_minimo: 2, cupo_maximo: 10, visibilidad: 'enlace' });
    await expect(rpc(db, jugadores[0], 'partido_detalle', { p_partido_id: id })).rejects.toThrow(/no encontrado/);
    await expect(rpc(db, jugadores[0], 'partido_unirse', { p_partido_id: id })).rejects.toThrow(/no encontrado/);
    const propio = await rpc<Detalle>(db, organizadora, 'partido_detalle', { p_partido_id: id });
    expect(propio.token).toMatch(/^[a-f0-9]{32}$/);
    expect(await rpc(db, ANON, 'buscar_partido_por_token', { p_token: propio.token })).toBe(id);
    const conToken = await rpc<Detalle>(db, ANON, 'partido_detalle', { p_partido_id: id, p_token: propio.token });
    expect(conToken.token).toBeNull();
    expect(conToken.participantes.every((p) => p.usuario_id === null)).toBe(true);
    await rpc(db, jugadores[0], 'partido_unirse', { p_partido_id: id, p_token: propio.token });
    const comoParticipante = await rpc<Detalle>(db, jugadores[0], 'partido_detalle', { p_partido_id: id });
    expect(comoParticipante.mi_estado).toBe('confirmado');
    expect(comoParticipante.token).toBe(propio.token);
    const explorados = await rpcFilas<{ id: number }>(db, ANON, 'explorar_partidos', {});
    expect(explorados.map((p) => p.id)).not.toContain(id);
  });

  it('con aprobación, la organizadora acepta o rechaza y quien fue rechazado no reingresa', async () => {
    const { partido_id: id } = await crearPartido(4, '18:00', { cupo_minimo: 2, cupo_maximo: 10, requiere_aprobacion: true });
    expect(await rpc(db, jugadores[0], 'partido_unirse', { p_partido_id: id })).toEqual({ estado_inscripcion: 'pendiente_aprobacion' });
    expect(await rpc(db, jugadores[1], 'partido_unirse', { p_partido_id: id })).toEqual({ estado_inscripcion: 'pendiente_aprobacion' });
    await expect(rpc(db, jugadores[2], 'partido_resolver_inscripcion', { p_partido_id: id, p_usuario_id: jugadores[0].id, p_aprobar: true }))
      .rejects.toThrow(/Solo quien organiza/);
    await rpc(db, organizadora, 'partido_resolver_inscripcion', { p_partido_id: id, p_usuario_id: jugadores[0].id, p_aprobar: true });
    await rpc(db, organizadora, 'partido_resolver_inscripcion', { p_partido_id: id, p_usuario_id: jugadores[1].id, p_aprobar: false });
    await expect(rpc(db, jugadores[1], 'partido_unirse', { p_partido_id: id })).rejects.toThrow(/no aceptó/);
    await expect(rpc(db, jugadores[1], 'partido_salir', { p_partido_id: id })).rejects.toThrow(/No estás anotado/);
    const detalle = await rpc<Detalle>(db, jugadores[2], 'partido_detalle', { p_partido_id: id });
    expect(detalle.participantes.map((p) => p.estado)).toEqual(['confirmado', 'confirmado']);
  });

  it('la organizadora transfiere antes de bajarse y puede cancelar avisando a todos', async () => {
    const { partido_id: id, ocupacion_id: ocupacion } = await crearPartido(5, '18:00', { cupo_minimo: 2, cupo_maximo: 10 });
    await rpc(db, jugadores[0], 'partido_unirse', { p_partido_id: id });
    await rpc(db, jugadores[2], 'partido_unirse', { p_partido_id: id });
    await expect(rpc(db, organizadora, 'partido_salir', { p_partido_id: id })).rejects.toThrow(/transferí/);
    await expect(rpc(db, organizadora, 'partido_transferir', { p_partido_id: id, p_usuario_id: jugadores[1].id }))
      .rejects.toThrow(/confirmado/);
    await rpc(db, organizadora, 'partido_transferir', { p_partido_id: id, p_usuario_id: jugadores[0].id });
    await rpc(db, organizadora, 'partido_salir', { p_partido_id: id });
    await rpc(db, jugadores[0], 'partido_cancelar', { p_partido_id: id, p_motivo: 'Lesión' });
    expect((await notificacionesDe(db, jugadores[2])).map((n) => n.tipo)).toContain('partido_cancelado');
    // La reserva de la cancha sigue vigente: es de quien la pidió.
    const [{ estado }] = await sql<{ estado: string }>(db, `select estado from public.ocupaciones where id = $1`, [ocupacion]);
    expect(estado).toBe('confirmada');
  });

  it('el chat es solo para quienes juegan', async () => {
    const { partido_id: id } = await crearPartido(6, '18:00', { cupo_minimo: 2, cupo_maximo: 10 });
    await rpc(db, jugadores[0], 'partido_unirse', { p_partido_id: id });
    await rpc(db, jugadores[0], 'enviar_mensaje', { p_partido_id: id, p_texto: '¿Llevo pelota?' });
    await rpc(db, organizadora, 'enviar_mensaje', { p_partido_id: id, p_texto: 'Sí, dale' });
    await expect(rpc(db, jugadores[1], 'enviar_mensaje', { p_partido_id: id, p_texto: 'Hola' })).rejects.toThrow(/confirmadas/);
    await expect(rpcFilas(db, jugadores[1], 'mensajes_partido', { p_partido_id: id })).rejects.toThrow(/confirmadas/);
    const mensajes = await rpcFilas<{ texto: string; es_mio: boolean }>(db, jugadores[0], 'mensajes_partido', { p_partido_id: id });
    expect(mensajes.map((m) => m.texto)).toEqual(['Sí, dale', '¿Llevo pelota?']);
    expect(mensajes.map((m) => m.es_mio)).toEqual([false, true]);
  });

  it('al terminar el partido se suman puntos, partidos jugados y logros una sola vez', async () => {
    const { partido_id: id, ocupacion_id: ocupacion } = await crearPartido(0, '18:00', { cupo_minimo: 2, cupo_maximo: 10 });
    await rpc(db, jugadores[2], 'partido_unirse', { p_partido_id: id });
    await sql(db, `update public.ocupaciones set inicio = now() - interval '3 hours', fin = now() - interval '1 hour' where id = $1`, [ocupacion]);
    await rpc(db, club.admin, 'admin_ejecutar_tareas', {});
    await rpc(db, club.admin, 'admin_ejecutar_tareas', {});
    const [partido] = await sql<{ estado_partido: string }>(db, `select estado_partido from public.partidos where id = $1`, [id]);
    expect(partido.estado_partido).toBe('finalizado');
    const perfil = await rpc<{ puntos: number; partidos_jugados: number }>(db, jugadores[2], 'mi_perfil', {});
    expect(perfil).toMatchObject({ puntos: 10, partidos_jugados: 1 });
    const organizadoraPerfil = await rpc<{ puntos: number }>(db, organizadora, 'mi_perfil', {});
    expect(organizadoraPerfil.puntos).toBe(15);
    const logros = await rpcFilas<{ id: string; otorgado_at: string | null }>(db, jugadores[2], 'mis_logros', {});
    expect(logros.find((l) => l.id === 'primer_partido')!.otorgado_at).not.toBeNull();
    const ranking = await rpcFilas<{ nombre: string; puntos: number }>(db, ANON, 'ranking', {});
    expect(ranking[0]).toMatchObject({ nombre: 'Organizadora', puntos: 15 });
  });

  it('mis partidos incluye los privados propios y las notificaciones se marcan leídas', async () => {
    const mios = await rpcFilas<{ id: number; visibilidad: string }>(db, jugadores[0], 'mis_partidos', {});
    expect(mios.some((p) => p.visibilidad === 'enlace')).toBe(true);
    expect(await rpc(db, jugadores[0], 'notificaciones_sin_leer', {})).toBeGreaterThan(0);
    await rpc(db, jugadores[0], 'marcar_todas_leidas', {});
    expect(await rpc(db, jugadores[0], 'notificaciones_sin_leer', {})).toBe(0);
  });
});
