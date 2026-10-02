import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  ANON, SERVICIO, aplicarMigraciones, como, crearBaseDePruebas, crearUsuario, rpc, rpcFilas, sql,
} from './harness';

// Estado previo al cierre: la base tal como estaba el 29/09, con datos.
const ULTIMA_PREVIA = '20260929145033';
const CIERRE = '20261001120000';

describe('cierre de seguridad urgente', () => {
  let db: PGlite;
  let jugador: Awaited<ReturnType<typeof crearUsuario>>;
  let adminGlobal: Awaited<ReturnType<typeof crearUsuario>>;
  let superadmin: Awaited<ReturnType<typeof crearUsuario>>;
  let canchaId: number;

  beforeAll(async () => {
    db = await crearBaseDePruebas({ hasta: ULTIMA_PREVIA });
    jugador = await crearUsuario(db, { nombre: 'Jugadora' });
    adminGlobal = await crearUsuario(db, { nombre: 'Admin', rol: 'admin_global' });
    superadmin = await crearUsuario(db, { nombre: 'Super', rol: 'superadmin' });
    const [club] = await sql<{ id: number }>(db,
      `insert into public.clubes(nombre, direccion, ubicacion)
       values ('Club Sur', 'Calle 1', st_setsrid(st_makepoint(-58.4, -34.6), 4326)) returning id`);
    const [cancha] = await sql<{ id: number }>(db,
      `insert into public.canchas(club_id, nombre_identificador, titulo, precio_total, precio_sena)
       values ($1, 'C1', 'Cancha 1', 30000, 10000) returning id`, [club.id]);
    canchaId = cancha.id;
    for (const [visibilidad, token] of [['enlace', 'token-viejo-enlace'], ['publico', 'token-publico']]) {
      const [turno] = await sql<{ id: number }>(db,
        `insert into public.disponibilidad_turnos(cancha_id, fecha, hora_inicio, hora_fin, estado)
         values ($1, current_date + 3, $2, $3, 'reservado') returning id`,
        [canchaId, visibilidad === 'enlace' ? '18:00' : '20:00', visibilidad === 'enlace' ? '20:00' : '22:00']);
      const [reserva] = await sql<{ id: number }>(db,
        `insert into public.reservas(turno_id, usuario_id) values ($1, $2) returning id`, [turno.id, adminGlobal.id]);
      await sql(db,
        `insert into public.partidos(reserva_id, organizador_id, cupo_minimo, cupo_maximo, visibilidad, estado_partido, token_invitacion)
         values ($1, $2, 2, 10, $3, 'abierto', $4)`, [reserva.id, adminGlobal.id, visibilidad, token]);
    }
    await sql(db, `insert into public.disponibilidad_turnos(cancha_id, fecha, hora_inicio, hora_fin, estado)
      values ($1, current_date + 4, '18:00', '20:00', 'disponible')`, [canchaId]);
    await aplicarMigraciones(db, { desde: CIERRE, hasta: CIERRE });
  });

  it('impide escribir clubes a través de clubes_publicos, sin cortar la lectura', async () => {
    await expect(como(db, ANON, `update public.clubes_publicos set nombre = 'HACKEADO'`)).rejects.toThrow(/permission denied/);
    await expect(como(db, ANON, `insert into public.clubes_publicos(nombre) values ('Falso')`)).rejects.toThrow(/permission denied/);
    await expect(como(db, jugador, `delete from public.clubes_publicos`)).rejects.toThrow(/permission denied/);
    const filas = await como(db, ANON, `select nombre, latitud from public.clubes_publicos`);
    expect(filas).toEqual([{ nombre: 'Club Sur', latitud: -34.6 }]);
  });

  it('ningún cliente puede escribir a través de vistas', async () => {
    const vistas = await sql<{ vista: string }>(db, `
      select c.relname as vista from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v'
        and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
        and (has_table_privilege('anon', c.oid, 'insert,update,delete')
          or has_table_privilege('authenticated', c.oid, 'insert,update,delete'))`);
    expect(vistas).toEqual([]);
  });

  it('cierra las RPC que permitían ocupar o bloquear turnos ajenos', async () => {
    await expect(rpc(db, jugador, 'reservar_turno_rango', {
      p_cancha_id: canchaId, p_fecha: '2030-01-01', p_hora_inicio: '18:00', p_hora_fin: '20:00', p_estado_final: 'bloqueado_club',
    })).rejects.toThrow(/permission denied/);
    await expect(rpc(db, jugador, 'reservar_turno_virtual', {
      p_cancha_id: canchaId, p_fecha: '2030-01-01', p_hora_inicio: '18:00', p_hora_fin: '20:00', p_precio_total: 1, p_precio_sena: 0,
    })).rejects.toThrow(/permission denied/);
    await expect(rpc(db, jugador, 'unirse_a_partido', { p_partido_id: 1 })).rejects.toThrow(/permission denied/);
    await expect(rpc(db, adminGlobal, 'admin_eliminar_turno', { p_turno_id: 1 })).rejects.toThrow(/permission denied/);
    const [{ ocupados }] = await sql<{ ocupados: number }>(db,
      `select count(*)::int as ocupados from public.disponibilidad_turnos where estado = 'bloqueado_club'`);
    expect(ocupados).toBe(0);
  });

  it('la búsqueda exige sesión y solo devuelve partidos públicos', async () => {
    await expect(rpc(db, ANON, 'buscar_partidos', {})).rejects.toThrow(/permission denied/);
    const resultados = await rpcFilas<{ id: number }>(db, jugador, 'buscar_partidos', {});
    const [publico] = await sql<{ id: number }>(db, `select id from public.partidos where visibilidad = 'publico'`);
    expect(resultados.map((partido) => partido.id)).toEqual([publico.id]);
  });

  it('regenera los tokens de partidos no públicos', async () => {
    const filas = await sql<{ visibilidad: string; token_invitacion: string }>(db,
      `select visibilidad, token_invitacion from public.partidos order by visibilidad`);
    const enlace = filas.find((fila) => fila.visibilidad === 'enlace')!;
    expect(enlace.token_invitacion).not.toBe('token-viejo-enlace');
    expect(enlace.token_invitacion).toMatch(/^[a-f0-9]{32}$/);
    expect(filas.find((fila) => fila.visibilidad === 'publico')!.token_invitacion).toBe('token-publico');
  });

  it('nadie crea perfiles ni lee roles sin sesión', async () => {
    await expect(como(db, jugador,
      `insert into public.usuarios(id, email, rol) values (gen_random_uuid(), 'x@x.test', 'superadmin')`))
      .rejects.toThrow(/permission denied/);
    await expect(como(db, ANON, `select rol from public.usuarios`)).rejects.toThrow(/permission denied/);
    expect(await como(db, ANON, `select nombre_completo from public.usuarios where id = $1`, [jugador.id]))
      .toEqual([{ nombre_completo: 'Jugadora' }]);
  });

  it('limita los cambios de rol', async () => {
    await expect(rpc(db, adminGlobal, 'admin_actualizar_rol', { p_usuario_id: adminGlobal.id, p_rol: 'superadmin' }))
      .rejects.toThrow(/propio rol/);
    await expect(rpc(db, adminGlobal, 'admin_actualizar_rol', { p_usuario_id: jugador.id, p_rol: 'admin_global' }))
      .rejects.toThrow(/superadmin/);
    await expect(rpc(db, jugador, 'admin_actualizar_rol', { p_usuario_id: jugador.id, p_rol: 'admin_global' }))
      .rejects.toThrow(/No autorizado/);
    await rpc(db, adminGlobal, 'admin_actualizar_rol', { p_usuario_id: jugador.id, p_rol: 'admin_cancha' });
    await rpc(db, superadmin, 'admin_actualizar_rol', { p_usuario_id: jugador.id, p_rol: 'jugador' });
    const [{ rol }] = await sql<{ rol: string }>(db, `select rol from public.usuarios where id = $1`, [jugador.id]);
    expect(rol).toBe('jugador');
  });

  it('el formulario de clubes solo entra por la Edge Function, con límite por origen', async () => {
    await expect(como(db, ANON, `insert into public.solicitudes_club(club_nombre, localidad, contacto_nombre, contacto, cantidad_canchas)
      values ('Club', 'Lanús', 'Ana', 'ana@club.test', 2)`)).rejects.toThrow(/permission denied/);
    const huella = 'a'.repeat(64);
    await expect(rpc(db, ANON, 'captacion_registrar_intento', { p_huella: huella })).rejects.toThrow(/permission denied/);
    const resultados: boolean[] = [];
    for (let intento = 0; intento < 6; intento += 1) {
      resultados.push(await rpc<boolean>(db, SERVICIO, 'captacion_registrar_intento', { p_huella: huella }));
    }
    expect(resultados).toEqual([true, true, true, true, true, false]);
  });

  it('toda función SECURITY DEFINER propia fija su search_path', async () => {
    const sinRuta = await sql<{ firma: string }>(db, `
      select p.oid::regprocedure::text as firma from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef and p.proconfig is null
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`);
    expect(sinRuta).toEqual([]);
  });
});
