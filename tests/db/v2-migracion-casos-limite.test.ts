// Datos atípicos que existían con el modelo anterior: la migración no debe
// abortar, ni inventar deudas, ni sumar puntos dos veces.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { aplicarMigraciones, crearBaseDePruebas, crearUsuario, rpc, sql } from './harness';
import type { Usuario } from './fixtures';

describe('modelo v2: migración de casos límite', () => {
  let db: PGlite;
  let dueno: Usuario;
  let jugador: Usuario;
  let clubId: number;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    db = await crearBaseDePruebas({ hasta: '20261001120000' });
    dueno = await crearUsuario(db, { nombre: 'Dueño' }) as Usuario;
    jugador = await crearUsuario(db, { nombre: 'Jugador' }) as Usuario;
    await sql(db, `update public.usuarios set partidos_jugados = 1 where id = $1`, [jugador.id]);

    [{ id: clubId }] = await sql<{ id: number }>(db,
      `insert into public.clubes(nombre) values ($1) returning id`,
      ['Club Atlético Social y Deportivo de Vóley de la Ribera del Riachuelo Sur Oeste']);
    const [{ id: cancha }] = await sql<{ id: number }>(db,
      `insert into public.canchas(club_id, nombre_identificador, titulo, precio_total, precio_sena)
       values ($1, '2', '2', 25000, 5000) returning id`, [clubId]);
    await sql(db, `insert into public.administradores_club(club_id, user_id) values ($1, $2)`, [clubId, dueno.id]);

    const turno = async (dias: number, desde: string, hasta: string, estado: string) => (await sql<{ id: number }>(db,
      `insert into public.disponibilidad_turnos(cancha_id, fecha, hora_inicio, hora_fin, estado)
       values ($1, ((now() at time zone 'America/Argentina/Buenos_Aires')::date + $2::int), $3, $4, $5) returning id`,
      [cancha, dias, desde, hasta, estado]))[0].id;
    const reservaYPartido = async (turnoId: number, estadoPartido: string, invitados = 0) => {
      const [{ id: reserva }] = await sql<{ id: number }>(db,
        `insert into public.reservas(turno_id, usuario_id, estado_pago) values ($1, $2, 'expirado') returning id`, [turnoId, jugador.id]);
      const [{ id: partido }] = await sql<{ id: number }>(db,
        `insert into public.partidos(reserva_id, organizador_id, cupo_minimo, cupo_maximo, cantidad_invitados_anonimos, visibilidad, estado_partido)
         values ($1, $2, 2, 6, $3, 'publico', $4) returning id`, [reserva, jugador.id, invitados, estadoPartido]);
      await sql(db, `insert into public.participantes_partido(partido_id, usuario_id, estado_inscripcion) values ($1, $2, 'confirmado')`,
        [partido, jugador.id]);
      return partido;
    };

    ids.preReservaVieja = await turno(-20, '18:00', '20:00', 'pre_reservado');
    ids.partidoViejoSinConfirmar = await reservaYPartido(ids.preReservaVieja, 'pre_reservado');
    ids.reservadoJugado = await turno(-10, '18:00', '20:00', 'reservado');
    ids.partidoJugado = await reservaYPartido(ids.reservadoJugado, 'abierto', 6);
    ids.turnoLargo = await turno(3, '08:00', '23:00', 'reservado');

    await aplicarMigraciones(db, { desde: '20261001130000' });
  });

  it('no aborta y normaliza nombres, títulos y cupos', async () => {
    const [club] = await sql<{ slug: string }>(db, `select slug from public.clubes where id = $1`, [clubId]);
    expect(club.slug.length).toBeLessThanOrEqual(50);
    expect(club.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const [cancha] = await sql<{ titulo: string }>(db, `select titulo from public.canchas where club_id = $1`, [clubId]);
    expect(cancha.titulo).toBe('Cancha 2');
    const [partido] = await sql<{ invitados: number }>(db,
      `select cantidad_invitados_anonimos as invitados from public.partidos where id = $1`, [ids.partidoJugado]);
    expect(partido.invitados).toBe(5);
  });

  it('registra los turnos que no se pudieron trasladar', async () => {
    const omitidos = await sql<{ turno_id: number }>(db, `select turno_id from private.migracion_omitidos`);
    expect(omitidos.map((fila) => fila.turno_id)).toEqual([ids.turnoLargo]);
  });

  it('el historial no se convierte en deuda ni vuelve a sumar puntos', async () => {
    const [vieja] = await sql<{ estado: string }>(db,
      `select estado from public.ocupaciones where legado_turno_id = $1`, [ids.preReservaVieja]);
    expect(vieja.estado).toBe('vencida');
    const partidos = await sql<{ id: number; estado_partido: string }>(db,
      `select id, estado_partido from public.partidos where id = any($1::bigint[])`,
      [`{${ids.partidoViejoSinConfirmar},${ids.partidoJugado}}`]);
    expect(Object.fromEntries(partidos.map((p) => [p.id, p.estado_partido]))).toEqual({
      [ids.partidoViejoSinConfirmar]: 'cancelado',
      [ids.partidoJugado]: 'finalizado',
    });

    const admin = await crearUsuario(db, { nombre: 'Admin', rol: 'superadmin' });
    await rpc(db, admin, 'admin_ejecutar_tareas', {});
    const [perfil] = await sql<{ partidos_jugados: number; puntos_total: number }>(db,
      `select partidos_jugados, puntos_total from public.usuarios where id = $1`, [jugador.id]);
    expect(perfil).toEqual({ partidos_jugados: 1, puntos_total: 0 });

    const deudas = await rpc<{ clientes: unknown[]; sin_cliente: unknown[] }>(db, dueno, 'club_deudas', { p_club_id: clubId });
    expect(deudas).toEqual({ clientes: [], sin_cliente: [] });
  });
});
