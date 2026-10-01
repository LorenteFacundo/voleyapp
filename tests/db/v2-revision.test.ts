// Regresiones de la revisión adversarial del modelo v2: cada caso reproduce un
// problema encontrado y verifica su corrección.
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { ANON, como, crearBaseDePruebas, rpc, rpcFilas, sql } from './harness';
import {
  abrirReservas, horarioId, instante, nuevoUsuario, prepararClub, proximaFecha, type ClubDePrueba, type Usuario,
} from './fixtures';

describe('modelo v2: correcciones de la revisión', () => {
  let db: PGlite;
  let club: ClubDePrueba;
  let jugadores: Usuario[];

  beforeAll(async () => {
    db = await crearBaseDePruebas();
    club = await prepararClub(db, { nombre: 'Club Revisión' });
    jugadores = await Promise.all(['Uno', 'Dos', 'Tres'].map((nombre) => nuevoUsuario(db, { nombre, nivel: 6 })));
    await abrirReservas(db, club.admin, jugadores);
  });

  async function crearFijo(dia: number, hora: string, cancha = club.canchas[1], titulo = `Fijo ${dia} ${hora}`) {
    return rpc<{ serie_id: number; creadas: number }>(db, club.dueno, 'club_crear_serie', {
      p_club_id: club.clubId, p_cancha_id: cancha, p_titulo: titulo, p_dia_semana: dia, p_hora_inicio: hora,
      p_duracion_min: 60, p_desde: await proximaFecha(db, dia, 0), p_precio: 15000, p_cliente_nombre: titulo,
      p_omitir_conflictos: true,
    });
  }

  it('mover una fecha de un fijo no la duplica al regenerar', async () => {
    const serie = await crearFijo(2, '08:00');
    const [fecha] = await sql<{ id: number; serie_fecha: string; dia: string }>(db,
      `select id, serie_fecha::text, to_char(inicio at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') as dia
       from public.ocupaciones where serie_id = $1 order by inicio limit 1`, [serie.serie_id]);
    await rpc(db, club.dueno, 'club_mover_ocupacion', {
      p_ocupacion_id: fecha.id, p_cancha_id: club.canchas[1],
      p_inicio: await instante(db, fecha.dia, '11:00'), p_fin: await instante(db, fecha.dia, '12:00'),
    });
    await rpc(db, club.admin, 'admin_ejecutar_tareas', {});
    const [{ total }] = await sql<{ total: number }>(db,
      `select count(*)::int as total from public.ocupaciones where serie_id = $1 and serie_fecha = $2::date`,
      [serie.serie_id, fecha.serie_fecha]);
    expect(total).toBe(1);
  });

  it('las funciones nuevas y PostGIS no quedan ejecutables por anon', async () => {
    await sql(db, `create function public.funcion_nueva_de_prueba() returns int language sql as 'select 1'`);
    const [{ anon }] = await sql<{ anon: boolean }>(db,
      `select has_function_privilege('anon', 'public.funcion_nueva_de_prueba()', 'execute') as anon`);
    expect(anon).toBe(false);
    await sql(db, `drop function public.funcion_nueva_de_prueba()`);
    await expect(como(db, ANON, `select st_astext(st_makepoint(1, 1))`)).rejects.toThrow(/permission denied/);
    await expect(como(db, ANON, `select count(*) from public.spatial_ref_sys`)).rejects.toThrow(/permission denied/);
  });

  it('los partidos del club los gestiona el equipo actual, no quien los publicó', async () => {
    const encargado = await nuevoUsuario(db, { nombre: 'Encargado temporal' });
    const { token } = await rpc<{ token: string }>(db, club.dueno, 'club_invitar', {
      p_club_id: club.clubId, p_email: encargado.email, p_rol: 'encargado',
    });
    await rpc(db, encargado, 'aceptar_invitacion_club', { p_token: token });
    const fecha = await proximaFecha(db, 3, 2);
    const { partido_id: partido } = await rpc<{ partido_id: number }>(db, encargado, 'club_publicar_partido', {
      p_club_id: club.clubId, p_cancha_id: club.canchas[0], p_inicio: await instante(db, fecha, '09:00'),
      p_fin: await instante(db, fecha, '10:00'), p_cupo_minimo: 4, p_cupo_maximo: 8, p_nivel: 'recreativo',
      p_precio_por_jugador: 2000,
    });
    await rpc(db, club.dueno, 'club_cambiar_miembro', { p_club_id: club.clubId, p_user_id: encargado.id, p_rol: null });
    const cambios = { p_partido_id: partido, p_cupo_minimo: 4, p_cupo_maximo: 10, p_invitados: 0, p_nivel: 'recreativo',
      p_visibilidad: 'publico', p_requiere_aprobacion: false };
    await expect(rpc(db, encargado, 'partido_actualizar', cambios)).rejects.toThrow(/Solo quien organiza/);
    await expect(rpc(db, encargado, 'partido_cancelar', { p_partido_id: partido })).rejects.toThrow(/Solo quien organiza/);
    await rpc(db, club.dueno, 'partido_actualizar', cambios);
    const detalle = await rpc<{ soy_organizador: boolean; token: string | null }>(db, encargado, 'partido_detalle', { p_partido_id: partido });
    expect(detalle).toMatchObject({ soy_organizador: false, token: null });
  });

  it('el aviso de mínimo de jugadores sale una sola vez', async () => {
    const fecha = await proximaFecha(db, 4, 2);
    const { partido_id: partido } = await rpc<{ partido_id: number }>(db, club.dueno, 'club_publicar_partido', {
      p_club_id: club.clubId, p_cancha_id: club.canchas[0], p_inicio: await instante(db, fecha, '09:00'),
      p_fin: await instante(db, fecha, '10:00'), p_cupo_minimo: 2, p_cupo_maximo: 8, p_nivel: 'recreativo',
      p_precio_por_jugador: 2000,
    });
    await rpc(db, jugadores[0], 'partido_unirse', { p_partido_id: partido });
    for (let vuelta = 0; vuelta < 3; vuelta += 1) {
      await rpc(db, jugadores[1], 'partido_unirse', { p_partido_id: partido });
      await rpc(db, jugadores[1], 'partido_salir', { p_partido_id: partido });
    }
    const [{ avisos }] = await sql<{ avisos: number }>(db,
      `select count(*)::int as avisos from public.notificaciones where partido_id = $1 and tipo = 'partido_minimo'`, [partido]);
    expect(avisos).toBe(2);
  });

  it('limita los pedidos por día y las reservas activas por persona', async () => {
    const insistente = await nuevoUsuario(db, { nombre: 'Insistente' });
    await rpc(db, club.admin, 'admin_definir_acceso', { p_usuario_id: insistente.id, p_habilitado: true });
    await sql(db, `insert into public.ocupaciones (club_id, cancha_id, inicio, fin, estado, origen, usuario_id, titulo, created_at)
      select $1, $2, now() + make_interval(days => 20 + g), now() + make_interval(days => 20 + g) + interval '1 hour',
        'cancelada', 'app', $3, 'Pedido', now()
      from generate_series(1, 8) g`, [club.clubId, club.canchas[0], insistente.id]);
    const fecha = await proximaFecha(db, 5);
    await expect(rpc(db, insistente, 'solicitar_reserva', {
      p_horario_id: await horarioId(db, club.canchas[0], 5, '18:00'), p_fecha: fecha,
    })).rejects.toThrow(/muchos pedidos/);

    const automatico = await prepararClub(db, { nombre: 'Club Automático Rev', confirmacionAutomatica: true, admin: club.admin });
    const acaparador = jugadores[2];
    for (const [dia, hora] of [[1, '18:00'], [1, '20:00'], [2, '18:00'], [2, '20:00']] as const) {
      await rpc(db, acaparador, 'solicitar_reserva', {
        p_horario_id: await horarioId(db, automatico.canchas[0], dia, hora), p_fecha: await proximaFecha(db, dia),
      });
    }
    await expect(rpc(db, acaparador, 'solicitar_reserva', {
      p_horario_id: await horarioId(db, automatico.canchas[0], 3, '18:00'), p_fecha: await proximaFecha(db, 3),
    })).rejects.toThrow(/4 reservas activas/);
  });

  it('el saldo de un cliente incluye lo cobrado antes de asignarlo', async () => {
    const fecha = await proximaFecha(db, 6, 2);
    const reserva = await rpc<{ id: number }>(db, club.dueno, 'club_crear_reserva', {
      p_club_id: club.clubId, p_cancha_id: club.canchas[0], p_inicio: await instante(db, fecha, '08:00'),
      p_fin: await instante(db, fecha, '09:00'), p_titulo: 'Sin nombre', p_precio: 20000,
    });
    await rpc(db, club.dueno, 'club_registrar_pago', { p_club_id: club.clubId, p_ocupacion_id: reserva.id, p_monto: 20000, p_medio: 'efectivo' });
    const cliente = await rpc<{ id: number }>(db, club.dueno, 'club_guardar_cliente', { p_club_id: club.clubId, p_nombre: 'Asignado después' });
    await rpc(db, club.dueno, 'club_actualizar_ocupacion', { p_ocupacion_id: reserva.id, p_cambios: { cliente_id: cliente.id } });
    await sql(db, `update public.ocupaciones set inicio = now() - interval '2 hours', fin = now() - interval '1 hour' where id = $1`, [reserva.id]);
    const detalle = await rpc<{ saldo: number }>(db, club.dueno, 'club_cliente_detalle', { p_cliente_id: cliente.id });
    expect(detalle.saldo).toBe(0);
  });

  it('terminar un fijo desde hoy no cancela lo ya jugado ni extiende su fin', async () => {
    const serie = await crearFijo(0, '07:00', club.canchas[1], 'Domingos temprano');
    const [primera] = await sql<{ id: number }>(db,
      `select id from public.ocupaciones where serie_id = $1 order by inicio limit 1`, [serie.serie_id]);
    await sql(db, `update public.ocupaciones set inicio = now() - interval '2 hours', fin = now() - interval '1 hour' where id = $1`, [primera.id]);
    const [{ hoy }] = await sql<{ hoy: string }>(db, `select to_char(private.hoy_ar(), 'YYYY-MM-DD') as hoy`);
    await rpc(db, club.dueno, 'club_modificar_serie', {
      p_serie_id: serie.serie_id, p_desde_fecha: hoy, p_cancha_id: club.canchas[1], p_dia_semana: 0,
      p_hora_inicio: '07:00', p_duracion_min: 60, p_precio: 16000, p_hasta: await proximaFecha(db, 0, 3),
    });
    const [{ hasta }] = await sql<{ hasta: string }>(db, `select hasta::text from public.series where id = $1`, [serie.serie_id]);
    await rpc(db, club.dueno, 'club_modificar_serie', {
      p_serie_id: serie.serie_id, p_desde_fecha: hoy, p_cancha_id: club.canchas[1], p_dia_semana: 0,
      p_hora_inicio: '07:00', p_duracion_min: 60, p_precio: 17000,
    });
    await rpc(db, club.dueno, 'club_finalizar_serie', { p_serie_id: serie.serie_id, p_desde_fecha: await proximaFecha(db, 0, 8) });
    const [despues] = await sql<{ hasta: string }>(db, `select hasta::text from public.series where id = $1`, [serie.serie_id]);
    expect(despues.hasta).toBe(hasta);
    await rpc(db, club.dueno, 'club_finalizar_serie', { p_serie_id: serie.serie_id, p_desde_fecha: hoy });
    const [{ estado }] = await sql<{ estado: string }>(db, `select estado from public.ocupaciones where id = $1`, [primera.id]);
    expect(estado).toBe('confirmada');
  });

  it('valida datos de partidos, nombres, invitaciones, fotos y avisos de pago', async () => {
    const solicitud = await rpc<{ ocupacion_id: number; partido_id: number }>(db, jugadores[0], 'solicitar_reserva', {
      p_horario_id: await horarioId(db, club.canchas[1], 4, '20:00'), p_fecha: await proximaFecha(db, 4),
      p_partido: { cupo_minimo: 2, cupo_maximo: 8, visibilidad: 'publico' },
    });
    await expect(rpc(db, jugadores[0], 'partido_actualizar', {
      p_partido_id: solicitud.partido_id, p_cupo_minimo: 2, p_cupo_maximo: null, p_invitados: 0,
      p_nivel: null, p_visibilidad: null, p_requiere_aprobacion: false,
    })).rejects.toThrow(/Completá todos los datos/);
    const [{ antes }] = await sql<{ antes: string }>(db, `select token_invitacion as antes from public.partidos where id = $1`, [solicitud.partido_id]);
    await rpc(db, jugadores[0], 'partido_actualizar', {
      p_partido_id: solicitud.partido_id, p_cupo_minimo: 2, p_cupo_maximo: 8, p_invitados: 0,
      p_nivel: 'recreativo', p_visibilidad: 'enlace', p_requiere_aprobacion: false,
    });
    const [{ despues }] = await sql<{ despues: string }>(db, `select token_invitacion as despues from public.partidos where id = $1`, [solicitud.partido_id]);
    expect(despues).not.toBe(antes);

    await rpc(db, jugadores[0], 'informar_pago', { p_ocupacion_id: solicitud.ocupacion_id });
    await rpc(db, jugadores[0], 'informar_pago', { p_ocupacion_id: solicitud.ocupacion_id });
    const [{ avisos }] = await sql<{ avisos: number }>(db,
      `select count(*)::int as avisos from public.notificaciones where ocupacion_id = $1 and tipo = 'pago_informado'`, [solicitud.ocupacion_id]);
    expect(avisos).toBe(1);

    const sinNombre = await nuevoUsuario(db, { nombre: '  ' });
    expect((await rpc<{ nombre: string }>(db, sinNombre, 'mi_perfil', {})).nombre).toBe('Jugador');
    await sql(db, `insert into auth.users(id, email, raw_user_meta_data) values (gen_random_uuid(), 'raro@prueba.test', $1)`,
      [JSON.stringify({ nombre_completo: 'Juan\r\nBcc: otro@evil.test' })]);
    const [{ nombre }] = await sql<{ nombre: string }>(db, `select nombre_completo as nombre from public.usuarios where email = 'raro@prueba.test'`);
    expect(nombre).toBe('Juan Bcc: otro@evil.test');

    const sinConfirmar = await nuevoUsuario(db, { nombre: 'Sin confirmar', confirmado: false });
    const invitacion = await rpc<{ token: string }>(db, club.dueno, 'club_invitar', {
      p_club_id: club.clubId, p_email: sinConfirmar.email, p_rol: 'encargado',
    });
    await expect(rpc(db, sinConfirmar, 'aceptar_invitacion_club', { p_token: invitacion.token })).rejects.toThrow(/Confirmá tu email/);

    const base = { p_club_id: club.clubId, p_id: club.canchas[0], p_titulo: 'Cancha 1', p_precio_total: 30000, p_precio_sena: 10000 };
    await expect(rpc(db, club.dueno, 'club_guardar_cancha', {
      ...base, p_fotos: [`https://tracker.evil.test/storage/v1/object/public/canchas-fotos/club-${club.clubId}/a.jpg`],
    })).rejects.toThrow(/panel del club/);
    await rpc(db, club.dueno, 'club_guardar_cancha', {
      ...base, p_fotos: [`https://abcdefgh.supabase.co/storage/v1/object/public/canchas-fotos/club-${club.clubId}/a.jpg`],
    });
  });

  it('crea clubes con nombres largos o sin letras latinas', async () => {
    const largo = await rpc<{ slug: string }>(db, club.admin, 'admin_crear_club', { p_nombre: 'Club Atlético y Social de Vóley de la Ribera del Riachuelo Sur Oeste' });
    expect(largo.slug.length).toBeLessThanOrEqual(60);
    const chino = await rpc<{ slug: string }>(db, club.admin, 'admin_crear_club', { p_nombre: '排球俱乐部' });
    expect(chino.slug).toMatch(/^club-[a-f0-9]{6}$/);
  });

  it('mover la reserva de un partido avisa a quienes se anotaron', async () => {
    const solicitud = await rpc<{ ocupacion_id: number; partido_id: number }>(db, jugadores[1], 'solicitar_reserva', {
      p_horario_id: await horarioId(db, club.canchas[1], 6, '18:00'), p_fecha: await proximaFecha(db, 6),
      p_partido: { cupo_minimo: 4, cupo_maximo: 10, visibilidad: 'publico' },
    });
    await rpc(db, club.dueno, 'club_resolver_solicitud', { p_ocupacion_id: solicitud.ocupacion_id, p_confirmar: true });
    await rpc(db, jugadores[2], 'partido_unirse', { p_partido_id: solicitud.partido_id });
    const fecha = await proximaFecha(db, 6);
    await rpc(db, club.dueno, 'club_mover_ocupacion', {
      p_ocupacion_id: solicitud.ocupacion_id, p_cancha_id: club.canchas[1],
      p_inicio: await instante(db, fecha, '16:00'), p_fin: await instante(db, fecha, '18:00'),
    });
    const notas = await rpcFilas<{ tipo: string }>(db, jugadores[2], 'mis_notificaciones', {});
    expect(notas.map((n) => n.tipo)).toContain('reserva_movida');
  });
});
