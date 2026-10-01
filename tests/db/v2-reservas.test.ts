import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { ANON, crearBaseDePruebas, rpc, rpcFilas, sql } from './harness';
import {
  abrirReservas, horarioId, notificacionesDe, nuevoUsuario, prepararClub, proximaFecha,
  type ClubDePrueba, type Usuario,
} from './fixtures';

type Bloque = { horario_id: number; cancha_id: number; fecha: string; hora_inicio: string; inicio: string; fin: string; estado: string };
type Disponibilidad = { bloques: Bloque[] };
type Solicitud = { ocupacion_id: number; estado: string; vence_at: string | null; club: { alias_pago: string } };

describe('modelo v2: reservas de jugadores', () => {
  let db: PGlite;
  let club: ClubDePrueba;
  let jugadora: Usuario;
  let otro: Usuario;

  beforeAll(async () => {
    db = await crearBaseDePruebas();
    club = await prepararClub(db, { nombre: 'Club Reservas' });
    jugadora = await nuevoUsuario(db, { nombre: 'Jugadora' });
    otro = await nuevoUsuario(db, { nombre: 'Otro jugador' });
  });

  async function pedir(actor: Usuario, dia: number, hora: string, cancha = club.canchas[0], semanas = 1) {
    const fecha = await proximaFecha(db, dia, semanas);
    return rpc<Solicitud>(db, actor, 'solicitar_reserva', {
      p_horario_id: await horarioId(db, cancha, dia, hora), p_fecha: fecha,
    });
  }

  it('la disponibilidad es pública y refleja los bloques publicados', async () => {
    const fecha = await proximaFecha(db, 3);
    const disponibilidad = await rpc<Disponibilidad>(db, ANON, 'disponibilidad', {
      p_club_id: club.clubId, p_desde: fecha, p_hasta: fecha,
    });
    expect(disponibilidad.bloques).toHaveLength(6);
    expect(disponibilidad.bloques.every((bloque) => bloque.estado === 'libre')).toBe(true);
    const nocturno = disponibilidad.bloques.find((bloque) => bloque.hora_inicio === '22:00')!;
    expect(new Date(nocturno.fin).getTime() - new Date(nocturno.inicio).getTime()).toBe(2 * 3600_000);
    expect(new Date(nocturno.fin).toISOString().slice(11, 16)).toBe('03:00');
  });

  it('con las reservas pausadas nadie puede pedir', async () => {
    await expect(pedir(jugadora, 1, '18:00')).rejects.toThrow(/piloto/);
  });

  it('durante el piloto solo piden las cuentas habilitadas con email confirmado', async () => {
    await abrirReservas(db, club.admin, [jugadora, otro]);
    const sinAcceso = await nuevoUsuario(db, { nombre: 'Sin acceso' });
    await expect(pedir(sinAcceso, 1, '18:00')).rejects.toThrow(/no está habilitada/);
    const sinConfirmar = await nuevoUsuario(db, { nombre: 'Sin confirmar', confirmado: false });
    await rpc(db, club.admin, 'admin_definir_acceso', { p_usuario_id: sinConfirmar.id, p_habilitado: true });
    await expect(pedir(sinConfirmar, 1, '18:00')).rejects.toThrow(/Confirmá tu email/);
  });

  it('un pedido queda pendiente, avisa al club y reserva el horario', async () => {
    const solicitud = await pedir(jugadora, 1, '18:00');
    expect(solicitud.estado).toBe('pendiente');
    expect(solicitud.vence_at).not.toBeNull();
    expect(solicitud.club.alias_pago).toBe('club.voley.mp');

    expect((await notificacionesDe(db, club.dueno)).map((n) => n.tipo)).toContain('solicitud_nueva');
    const envios = await sql(db, `select destino from public.envios_notificacion where destino = $1`, [club.dueno.email]);
    expect(envios.length).toBeGreaterThan(0);

    const fecha = await proximaFecha(db, 1);
    const propia = await rpc<Disponibilidad>(db, jugadora, 'disponibilidad', { p_cancha_id: club.canchas[0], p_desde: fecha, p_hasta: fecha });
    const ajena = await rpc<Disponibilidad>(db, otro, 'disponibilidad', { p_cancha_id: club.canchas[0], p_desde: fecha, p_hasta: fecha });
    expect(propia.bloques.find((b) => b.hora_inicio === '18:00')!.estado).toBe('mi_solicitud');
    expect(ajena.bloques.find((b) => b.hora_inicio === '18:00')!.estado).toBe('ocupado');

    await expect(pedir(otro, 1, '18:00')).rejects.toThrow(/acaba de ser tomado/);

    const reservas = await rpcFilas<{ id: number; estado: string; club: { alias_pago: string } }>(db, jugadora, 'mis_reservas', {});
    expect(reservas.find((r) => r.id === solicitud.ocupacion_id)).toMatchObject({ estado: 'pendiente', club: { alias_pago: 'club.voley.mp' } });
  });

  it('el club confirma o rechaza y la persona recibe el aviso', async () => {
    const confirmada = await pedir(jugadora, 2, '18:00');
    expect(await rpc(db, club.dueno, 'club_resolver_solicitud', { p_ocupacion_id: confirmada.ocupacion_id, p_confirmar: true }))
      .toEqual({ estado: 'confirmada' });
    const rechazada = await pedir(otro, 2, '20:00');
    await rpc(db, club.dueno, 'club_resolver_solicitud', {
      p_ocupacion_id: rechazada.ocupacion_id, p_confirmar: false, p_motivo: 'Torneo interno',
    });
    expect((await notificacionesDe(db, jugadora)).map((n) => n.tipo)).toContain('reserva_confirmada');
    expect((await notificacionesDe(db, otro)).map((n) => n.tipo)).toContain('reserva_rechazada');
    await expect(rpc(db, club.dueno, 'club_resolver_solicitud', { p_ocupacion_id: rechazada.ocupacion_id, p_confirmar: true }))
      .rejects.toThrow(/ya fue resuelta/);
    // El rechazo libera el horario.
    expect((await pedir(jugadora, 2, '20:00')).estado).toBe('pendiente');
  });

  it('un pedido vencido libera el horario y avisa', async () => {
    const solicitud = await pedir(jugadora, 3, '20:00');
    await sql(db, `update public.ocupaciones set vence_at = now() - interval '1 minute' where id = $1`, [solicitud.ocupacion_id]);
    expect(await rpc(db, club.dueno, 'club_resolver_solicitud', { p_ocupacion_id: solicitud.ocupacion_id, p_confirmar: true }))
      .toEqual({ estado: 'vencida' });
    expect((await notificacionesDe(db, jugadora)).map((n) => n.tipo)).toContain('reserva_vencida');
    expect((await pedir(otro, 3, '20:00')).estado).toBe('pendiente');
  });

  it('con confirmación automática la reserva queda confirmada al instante', async () => {
    const automatico = await prepararClub(db, { nombre: 'Club Automático', confirmacionAutomatica: true, admin: club.admin });
    const fecha = await proximaFecha(db, 4);
    const reserva = await rpc<Solicitud>(db, otro, 'solicitar_reserva', {
      p_horario_id: await horarioId(db, automatico.canchas[0], 4, '18:00'), p_fecha: fecha,
    });
    expect(reserva.estado).toBe('confirmada');
    expect(reserva.vence_at).toBeNull();
  });

  it('respeta el plazo de cancelación del club', async () => {
    const pendiente = await pedir(jugadora, 5, '18:00');
    expect(await rpc(db, jugadora, 'cancelar_mi_reserva', { p_ocupacion_id: pendiente.ocupacion_id }))
      .toMatchObject({ estado: 'cancelada' });

    const reserva = await pedir(jugadora, 5, '20:00');
    await rpc(db, club.dueno, 'club_resolver_solicitud', { p_ocupacion_id: reserva.ocupacion_id, p_confirmar: true });
    await sql(db, `update public.ocupaciones set inicio = now() + interval '3 hours', fin = now() + interval '5 hours' where id = $1`,
      [reserva.ocupacion_id]);
    await expect(rpc(db, jugadora, 'cancelar_mi_reserva', { p_ocupacion_id: reserva.ocupacion_id }))
      .rejects.toThrow(/escribile al club/);
    await expect(rpc(db, otro, 'cancelar_mi_reserva', { p_ocupacion_id: reserva.ocupacion_id }))
      .rejects.toThrow(/no encontrada/);
  });

  it('limita los pedidos sin respuesta por persona', async () => {
    const nueva = await nuevoUsuario(db, { nombre: 'Insistente' });
    await rpc(db, club.admin, 'admin_definir_acceso', { p_usuario_id: nueva.id, p_habilitado: true });
    await pedir(nueva, 6, '18:00', club.canchas[1]);
    await pedir(nueva, 6, '20:00', club.canchas[1]);
    await pedir(nueva, 6, '22:00', club.canchas[1]);
    await expect(pedir(nueva, 0, '18:00', club.canchas[1])).rejects.toThrow(/3 pedidos/);
  });

  it('respeta la ventana y la anticipación configuradas por el club', async () => {
    await rpc(db, club.dueno, 'club_actualizar', { p_club_id: club.clubId, p_datos: { ventana_reserva_dias: 1 } });
    await expect(pedir(otro, 0, '20:00', club.canchas[1])).rejects.toThrow(/hasta 1 días antes/);
    await rpc(db, club.dueno, 'club_actualizar', {
      p_club_id: club.clubId, p_datos: { ventana_reserva_dias: 21, anticipacion_minima_min: 10080 },
    });
    const [{ manana, dia }] = await sql<{ manana: string; dia: number }>(db,
      `select to_char(private.hoy_ar() + 1, 'YYYY-MM-DD') as manana, extract(dow from private.hoy_ar() + 1)::int as dia`);
    await expect(rpc(db, otro, 'solicitar_reserva', {
      p_horario_id: await horarioId(db, club.canchas[1], dia, '18:00'), p_fecha: manana,
    })).rejects.toThrow(/Escribile al club/);
    await rpc(db, club.dueno, 'club_actualizar', { p_club_id: club.clubId, p_datos: { anticipacion_minima_min: 60 } });
  });

  it('un turno que cruza la medianoche termina al día siguiente', async () => {
    const reserva = await pedir(otro, 0, '22:00', club.canchas[0], 2);
    const [fila] = await sql<{ horas: number; fin_local: string }>(db,
      `select extract(epoch from fin - inicio) / 3600 as horas,
              to_char(fin at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') as fin_local
       from public.ocupaciones where id = $1`, [reserva.ocupacion_id]);
    expect(Number(fila.horas)).toBe(2);
    expect(fila.fin_local).toBe('00:00');
  });

  it('avisar la transferencia notifica al club', async () => {
    const reserva = await pedir(otro, 4, '22:00', club.canchas[1], 2);
    await rpc(db, otro, 'informar_pago', { p_ocupacion_id: reserva.ocupacion_id });
    expect((await notificacionesDe(db, club.dueno)).map((n) => n.tipo)).toContain('pago_informado');
    const panel = await rpc<{ pagos_informados: number }>(db, club.dueno, 'club_panel', { p_club_id: club.clubId });
    expect(panel.pagos_informados).toBeGreaterThanOrEqual(1);
  });
});
