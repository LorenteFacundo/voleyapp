import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { ANON, como, crearBaseDePruebas, rpc, rpcFilas, sql } from './harness';
import { instante, nuevoUsuario, prepararClub, proximaFecha, type ClubDePrueba, type Usuario } from './fixtures';

// RPC que cualquier visitante puede invocar; todo lo demás exige sesión.
const API_ANONIMA = [
  'buscar_partido_por_token', 'disponibilidad', 'estado_operacion', 'explorar_partidos',
  'partido_detalle', 'ranking', 'ver_invitacion_club',
];

describe('modelo v2: permisos', () => {
  let db: PGlite;
  let clubA: ClubDePrueba;
  let clubB: ClubDePrueba;
  let jugador: Usuario;
  let encargado: Usuario;

  beforeAll(async () => {
    db = await crearBaseDePruebas();
    clubA = await prepararClub(db, { nombre: 'Club A' });
    clubB = await prepararClub(db, { nombre: 'Club B', admin: clubA.admin });
    jugador = await nuevoUsuario(db, { nombre: 'Jugador' });
    encargado = await nuevoUsuario(db, { nombre: 'Encargado' });
    const { token } = await rpc<{ token: string }>(db, clubA.dueno, 'club_invitar', {
      p_club_id: clubA.clubId, p_email: encargado.email, p_rol: 'encargado',
    });
    await rpc(db, encargado, 'aceptar_invitacion_club', { p_token: token });
  });

  it('anon solo ejecuta las RPC públicas', async () => {
    const filas = await sql<{ nombre: string }>(db, `
      select distinct p.proname as nombre from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      order by 1`);
    expect(filas.map((fila) => fila.nombre)).toEqual(API_ANONIMA);
  });

  it('ninguna función interna ni de sistema es ejecutable por usuarios', async () => {
    const filas = await sql<{ nombre: string }>(db, `
      select n.nspname || '.' || p.proname as nombre from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname = 'private' or p.proname like 'sistema\\_%' or p.proname = 'captacion_registrar_intento')
        and has_function_privilege('authenticated', p.oid, 'execute')
      order by 1`);
    expect(filas.map((fila) => fila.nombre)).toEqual([
      'private.club_de_ruta_foto', 'private.is_admin_global', 'private.rol_en_club',
    ]);
  });

  it('RLS activo en todas las tablas y sin privilegios de escritura para clientes', async () => {
    const sinRls = await sql<{ tabla: string }>(db, `
      select c.relname as tabla from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
        and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')`);
    expect(sinRls).toEqual([]);
    const escritura = await sql<{ tabla: string }>(db, `
      select c.relname as tabla from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'v')
        and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
        and (has_table_privilege('anon', c.oid, 'insert,update,delete,truncate')
          or has_table_privilege('authenticated', c.oid, 'insert,delete,truncate'))`);
    expect(escritura).toEqual([]);
  });

  it('las tablas operativas no se pueden leer directamente', async () => {
    for (const tabla of ['ocupaciones', 'pagos', 'clientes_club', 'series', 'auditoria', 'club_miembros',
      'club_invitaciones', 'usuarios', 'partidos', 'participantes_partido', 'notificaciones', 'mensajes_partido',
      'envios_notificacion', 'app_config', 'acceso_piloto', 'reservas', 'disponibilidad_turnos']) {
      await expect(como(db, jugador, `select 1 from public.${tabla} limit 1`), tabla).rejects.toThrow(/permission denied/);
    }
  });

  it('toda función SECURITY DEFINER fija search_path', async () => {
    const filas = await sql(db, `
      select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef and p.proconfig is null
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`);
    expect(filas).toEqual([]);
  });

  it('el catálogo público solo muestra clubes publicados y sin datos privados', async () => {
    await rpc(db, clubB.dueno, 'club_actualizar', { p_club_id: clubB.clubId, p_datos: { publicado: false } });
    const visibles = await como<{ nombre: string }>(db, ANON, `select nombre from public.clubes order by nombre`);
    expect(visibles.map((club) => club.nombre)).toEqual(['Club A']);
    await expect(como(db, ANON, `select alias_pago from public.clubes`)).rejects.toThrow(/permission denied/);
    await expect(como(db, ANON, `select * from public.clubes`)).rejects.toThrow(/permission denied/);
    const canchas = await como(db, ANON, `select id from public.canchas where club_id = $1`, [clubB.clubId]);
    expect(canchas).toEqual([]);
    await rpc(db, clubB.dueno, 'club_actualizar', { p_club_id: clubB.clubId, p_datos: { publicado: true } });
  });

  it('aísla la gestión entre clubes y roles', async () => {
    await expect(rpc(db, jugador, 'club_agenda', { p_club_id: clubA.clubId, p_desde: '2030-01-01', p_hasta: '2030-01-07' }))
      .rejects.toThrow(/No tenés permiso/);
    await expect(rpc(db, clubA.dueno, 'club_agenda', { p_club_id: clubB.clubId, p_desde: '2030-01-01', p_hasta: '2030-01-07' }))
      .rejects.toThrow(/No tenés permiso/);
    await expect(rpc(db, clubA.dueno, 'club_guardar_horarios', { p_cancha_id: clubB.canchas[0], p_bloques: [] }))
      .rejects.toThrow(/No tenés permiso/);
    await expect(rpc(db, ANON, 'club_panel', { p_club_id: clubA.clubId })).rejects.toThrow(/permission denied/);

    // El encargado opera la agenda pero no la configuración, la caja ni los reportes.
    const agenda = await rpc<{ ocupaciones: unknown[] }>(db, encargado, 'club_agenda', {
      p_club_id: clubA.clubId, p_desde: '2030-01-01', p_hasta: '2030-01-07',
    });
    expect(agenda.ocupaciones).toEqual([]);
    for (const [fn, args] of [
      ['club_actualizar', { p_club_id: clubA.clubId, p_datos: { nombre: 'Otro' } }],
      ['club_caja', { p_club_id: clubA.clubId, p_desde: '2030-01-01', p_hasta: '2030-01-07' }],
      ['club_reporte', { p_club_id: clubA.clubId, p_desde: '2030-01-01', p_hasta: '2030-01-07' }],
      ['club_equipo', { p_club_id: clubA.clubId }],
    ] as const) {
      await expect(rpc(db, encargado, fn, args), fn).rejects.toThrow(/Solo el dueño/);
    }
  });

  it('un cliente de otro club no se puede asociar a una reserva', async () => {
    const cliente = await rpc<{ id: number }>(db, clubB.dueno, 'club_guardar_cliente', {
      p_club_id: clubB.clubId, p_nombre: 'Cliente de B',
    });
    const fecha = await proximaFecha(db, 2);
    await expect(rpc(db, clubA.dueno, 'club_crear_reserva', {
      p_club_id: clubA.clubId, p_cancha_id: clubA.canchas[0], p_inicio: await instante(db, fecha, '10:00'),
      p_fin: await instante(db, fecha, '11:00'), p_cliente_id: cliente.id,
    })).rejects.toThrow(/no pertenece a este club/);
  });

  it('las funciones de administración global exigen ese rol', async () => {
    for (const fn of ['admin_resumen', 'admin_clubes', 'admin_usuarios', 'admin_auditoria', 'admin_ejecutar_tareas']) {
      await expect(rpcFilas(db, clubA.dueno, fn, {}), fn).rejects.toThrow(/administración/);
    }
    const resumen = await rpc<{ clubes: number }>(db, clubA.admin, 'admin_resumen', {});
    expect(resumen.clubes).toBe(2);
  });
});
