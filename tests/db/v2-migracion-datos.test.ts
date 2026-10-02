import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { aplicarMigraciones, como, crearBaseDePruebas, crearUsuario, rpc, sql } from './harness';
import type { Usuario } from './fixtures';

// Datos con el formato anterior (turnos + reservas + partidos) migrados al modelo v2.
const ANTES_DEL_MODELO_V2 = '20261001120000';
const MODELO_V2 = '20261001130000';

describe('modelo v2: migración de datos existentes', () => {
  let db: PGlite;
  let dueno: Usuario;
  let jugador: Usuario;
  let companero: Usuario;
  let clubId: number;
  let canchaId: number;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    db = await crearBaseDePruebas({ hasta: ANTES_DEL_MODELO_V2 });
    dueno = await crearUsuario(db, { nombre: 'Dueño histórico', rol: 'admin_cancha' }) as Usuario;
    jugador = await crearUsuario(db, { nombre: 'Jugador histórico' }) as Usuario;
    companero = await crearUsuario(db, { nombre: 'Compañero' }) as Usuario;

    [{ id: clubId }] = await sql<{ id: number }>(db,
      `insert into public.clubes(nombre, direccion, telefono, ubicacion)
       values ('Club Histórico Ñandú', 'Calle 1, Lanús', '1144445555', st_setsrid(st_makepoint(-58.39, -34.70), 4326))
       returning id`);
    [{ id: canchaId }] = await sql<{ id: number }>(db,
      `insert into public.canchas(club_id, nombre_identificador, titulo, precio_total, precio_sena)
       values ($1, 'C1', 'Cancha Central', 25000, 8000) returning id`, [clubId]);
    await sql(db, `insert into public.administradores_club(club_id, user_id) values ($1, $2)`, [clubId, dueno.id]);

    // Fechas relativas: la próxima semana y la anterior.
    const [{ lunes, martes, miercoles, pasado }] = await sql<Record<string, string>>(db, `
      select to_char(d + ((1 - extract(dow from d)::int + 7) % 7) + 7, 'YYYY-MM-DD') as lunes,
             to_char(d + ((2 - extract(dow from d)::int + 7) % 7) + 7, 'YYYY-MM-DD') as martes,
             to_char(d + ((3 - extract(dow from d)::int + 7) % 7) + 7, 'YYYY-MM-DD') as miercoles,
             to_char(d - 6, 'YYYY-MM-DD') as pasado
      from (select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d) x`);
    await sql(db, `insert into public.horarios_semanales(cancha_id, dia_semana, hora_inicio, hora_fin, precio_total, precio_sena)
      values ($1, 1, '18:00', '20:00', 30000, 10000)`, [canchaId]);

    const turno = async (fecha: string, desde: string, hasta: string, estado: string) => {
      const [fila] = await sql<{ id: number }>(db,
        `insert into public.disponibilidad_turnos(cancha_id, fecha, hora_inicio, hora_fin, estado)
         values ($1, $2, $3, $4, $5) returning id`, [canchaId, fecha, desde, hasta, estado]);
      return fila.id;
    };
    const reserva = async (turnoId: number, usuario: string, sena = 0) => {
      const [fila] = await sql<{ id: number }>(db,
        `insert into public.reservas(turno_id, usuario_id, monto_sena_pagado, estado_pago)
         values ($1, $2, $3, $4) returning id`, [turnoId, usuario, sena, sena > 0 ? 'aprobado' : 'pendiente']);
      return fila.id;
    };
    const partido = async (reservaId: number, visibilidad: string, estado: string) => {
      const [fila] = await sql<{ id: number }>(db,
        `insert into public.partidos(reserva_id, organizador_id, cupo_minimo, cupo_maximo, visibilidad, estado_partido, token_invitacion)
         values ($1, $2, 2, 10, $3, $4, null) returning id`, [reservaId, jugador.id, visibilidad, estado]);
      return fila.id;
    };

    ids.turnoReservado = await turno(lunes, '18:00', '20:00', 'reservado');
    ids.reservaConSena = await reserva(ids.turnoReservado, jugador.id, 10000);
    ids.partidoPublico = await partido(ids.reservaConSena, 'publico', 'abierto');
    await sql(db, `insert into public.participantes_partido(partido_id, usuario_id, estado_inscripcion)
      values ($1, $2, 'confirmado'), ($1, $3, 'pendiente_pago')`, [ids.partidoPublico, jugador.id, companero.id]);

    ids.turnoPreReservado = await turno(martes, '20:00', '22:00', 'pre_reservado');
    ids.partidoEnlace = await partido(await reserva(ids.turnoPreReservado, jugador.id), 'enlace', 'pre_reservado');

    ids.turnoBloqueado = await turno(miercoles, '10:00', '12:00', 'bloqueado_club');
    ids.turnoPasado = await turno(pasado, '18:00', '20:00', 'reservado');
    await reserva(ids.turnoPasado, companero.id);

    // Partido cuya reserva quedó sobre un turno libre: no tiene cancha vigente.
    ids.partidoHuerfano = await partido(await reserva(await turno(miercoles, '20:00', '22:00', 'disponible'), jugador.id), 'publico', 'abierto');

    await aplicarMigraciones(db, { desde: MODELO_V2 });
  });

  it('completa los datos del club y su equipo', async () => {
    const [club] = await sql<{ slug: string; publicado: boolean; latitud: number; longitud: number }>(db,
      `select slug, publicado, latitud, longitud from public.clubes where id = $1`, [clubId]);
    expect(club).toEqual({ slug: 'club-historico-nandu', publicado: true, latitud: -34.7, longitud: -58.39 });
    const equipo = await sql(db, `select user_id, rol from public.club_miembros where club_id = $1`, [clubId]);
    expect(equipo).toEqual([{ user_id: dueno.id, rol: 'dueno' }]);
  });

  it('convierte cada turno ocupado en una ocupación con su estado y cobros', async () => {
    const filas = await sql<{ legado_turno_id: number; tipo: string; estado: string; precio: string; pagado: string; cliente: string | null; vence: boolean }>(db, `
      select o.legado_turno_id, o.tipo, o.estado, o.precio, o.pagado, c.nombre as cliente, o.vence_at is not null as vence
      from public.ocupaciones o left join public.clientes_club c on c.id = o.cliente_id
      order by o.legado_turno_id`);
    const porTurno = Object.fromEntries(filas.map((fila) => [fila.legado_turno_id, fila]));
    expect(filas).toHaveLength(4);
    expect(porTurno[ids.turnoReservado]).toMatchObject({ tipo: 'reserva', estado: 'confirmada', cliente: 'Jugador histórico' });
    expect(Number(porTurno[ids.turnoReservado].precio)).toBe(30000);
    expect(Number(porTurno[ids.turnoReservado].pagado)).toBe(10000);
    expect(porTurno[ids.turnoPreReservado]).toMatchObject({ estado: 'pendiente', vence: true });
    expect(Number(porTurno[ids.turnoPreReservado].precio)).toBe(25000);
    expect(porTurno[ids.turnoBloqueado]).toMatchObject({ tipo: 'bloqueo', estado: 'confirmada' });
    expect(porTurno[ids.turnoPasado]).toMatchObject({ estado: 'confirmada', cliente: 'Compañero' });
  });

  it('vincula los partidos y normaliza sus estados e inscripciones', async () => {
    const partidos = await sql<{ id: number; estado_partido: string; con_ocupacion: boolean; token: string }>(db,
      `select id, estado_partido, ocupacion_id is not null as con_ocupacion, token_invitacion as token
       from public.partidos order by id`);
    const porId = Object.fromEntries(partidos.map((fila) => [fila.id, fila]));
    expect(porId[ids.partidoPublico]).toMatchObject({ estado_partido: 'abierto', con_ocupacion: true });
    expect(porId[ids.partidoEnlace]).toMatchObject({ estado_partido: 'borrador', con_ocupacion: true });
    expect(porId[ids.partidoHuerfano]).toMatchObject({ estado_partido: 'cancelado', con_ocupacion: false });
    expect(partidos.every((fila) => /^[a-f0-9]{32}$/.test(fila.token))).toBe(true);
    const [{ estado }] = await sql<{ estado: string }>(db,
      `select estado_inscripcion as estado from public.participantes_partido where usuario_id = $1`, [companero.id]);
    expect(estado).toBe('confirmado');
  });

  it('el dueño opera los datos migrados desde el panel', async () => {
    const [{ desde, hasta }] = await sql<{ desde: string; hasta: string }>(db,
      `select to_char(private.hoy_ar() - 7, 'YYYY-MM-DD') as desde, to_char(private.hoy_ar() + 14, 'YYYY-MM-DD') as hasta`);
    const agenda = await rpc<{ ocupaciones: { estado: string }[] }>(db, dueno, 'club_agenda', {
      p_club_id: clubId, p_desde: desde, p_hasta: hasta,
    });
    expect(agenda.ocupaciones).toHaveLength(4);
    const panel = await rpc<{ pendientes: number; mi_rol: string }>(db, dueno, 'club_panel', { p_club_id: clubId });
    expect(panel).toMatchObject({ pendientes: 1, mi_rol: 'dueno' });
  });

  it('las tablas anteriores quedan fuera de la API', async () => {
    for (const tabla of ['disponibilidad_turnos', 'reservas', 'administradores_club']) {
      await expect(como(db, jugador, `select 1 from public.${tabla}`), tabla).rejects.toThrow(/permission denied/);
    }
  });
});
