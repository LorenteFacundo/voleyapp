import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { crearBaseDePruebas, rpc, rpcFilas, sql } from './harness';
import {
  abrirReservas, horarioId, instante, notificacionesDe, nuevoUsuario, prepararClub, proximaFecha,
  type ClubDePrueba, type Usuario,
} from './fixtures';

type Ocupacion = {
  id: number; estado: string; estado_pago: string; pagado: number; precio: number; inicio: string; fin: string;
  cliente: { id: number; nombre: string; telefono: string | null } | null;
};

describe('modelo v2: operación del club', () => {
  let db: PGlite;
  let club: ClubDePrueba;
  let jugadora: Usuario;

  beforeAll(async () => {
    db = await crearBaseDePruebas();
    club = await prepararClub(db, { nombre: 'Club Operación' });
    jugadora = await nuevoUsuario(db, { nombre: 'Jugadora App' });
    await abrirReservas(db, club.admin, [jugadora]);
  });

  async function reservaManual(fecha: string, desde: string, hasta: string, extra: Record<string, unknown> = {}) {
    return rpc<Ocupacion>(db, club.dueno, 'club_crear_reserva', {
      p_club_id: club.clubId, p_cancha_id: club.canchas[0],
      p_inicio: await instante(db, fecha, desde), p_fin: await instante(db, fecha, hasta), ...extra,
    });
  }

  describe('reservas cargadas por el club', () => {
    it('acepta cualquier horario, crea el cliente y lo reutiliza por teléfono', async () => {
      const fecha = await proximaFecha(db, 1);
      const primera = await reservaManual(fecha, '09:30', '11:00', {
        p_cliente_nombre: 'Grupo de los lunes', p_cliente_telefono: '+54 9 11 2233-4455', p_precio: 25000,
      });
      expect(primera).toMatchObject({ estado: 'confirmada', precio: 25000, cliente: { nombre: 'Grupo de los lunes', telefono: '5491122334455' } });
      const segunda = await reservaManual(fecha, '11:00', '12:00', { p_cliente_nombre: 'Otro nombre', p_cliente_telefono: '5491122334455' });
      expect(segunda.cliente!.id).toBe(primera.cliente!.id);
    });

    it('rechaza superposiciones y horarios fuera de grilla', async () => {
      const fecha = await proximaFecha(db, 1);
      await expect(reservaManual(fecha, '10:00', '10:30', { p_titulo: 'Clase' })).rejects.toThrow(/Se superpone/);
      await expect(reservaManual(fecha, '13:03', '14:00', { p_titulo: 'Clase' })).rejects.toThrow(/múltiplos de 5/);
      await expect(reservaManual(fecha, '14:00', '15:00')).rejects.toThrow(/Indicá el cliente/);
    });

    it('usa el precio del bloque publicado cuando no se indica', async () => {
      const fecha = await proximaFecha(db, 2);
      const reserva = await reservaManual(fecha, '20:00', '22:00', { p_titulo: 'Equipo B' });
      expect(reserva.precio).toBe(36000);
    });

    it('mueve una reserva y avisa a quien la hizo por la app', async () => {
      const fecha = await proximaFecha(db, 3);
      const solicitud = await rpc<{ ocupacion_id: number }>(db, jugadora, 'solicitar_reserva', {
        p_horario_id: await horarioId(db, club.canchas[0], 3, '18:00'), p_fecha: fecha,
      });
      await rpc(db, club.dueno, 'club_resolver_solicitud', { p_ocupacion_id: solicitud.ocupacion_id, p_confirmar: true });
      const movida = await rpc<Ocupacion>(db, club.dueno, 'club_mover_ocupacion', {
        p_ocupacion_id: solicitud.ocupacion_id, p_cancha_id: club.canchas[1],
        p_inicio: await instante(db, fecha, '19:00'), p_fin: await instante(db, fecha, '21:00'),
      });
      expect(movida.estado).toBe('confirmada');
      expect((await notificacionesDe(db, jugadora)).map((n) => n.tipo)).toContain('reserva_movida');
      // Moverla encima de la reserva del grupo de los lunes no está permitido.
      const lunes = await proximaFecha(db, 1);
      await expect(rpc(db, club.dueno, 'club_mover_ocupacion', {
        p_ocupacion_id: solicitud.ocupacion_id, p_cancha_id: club.canchas[0],
        p_inicio: await instante(db, lunes, '09:00'), p_fin: await instante(db, lunes, '10:00'),
      })).rejects.toThrow(/Se superpone/);
    });
  });

  describe('cobros', () => {
    it('registra señas y pagos, calcula saldo y permite anular', async () => {
      const fecha = await proximaFecha(db, 4);
      const reserva = await reservaManual(fecha, '18:00', '20:00', {
        p_cliente_nombre: 'Las Panteras', p_cliente_telefono: '1155556666', p_precio: 30000,
      });
      const sena = await rpc<{ pago_id: number; ocupacion: Ocupacion }>(db, club.dueno, 'club_registrar_pago', {
        p_club_id: club.clubId, p_ocupacion_id: reserva.id, p_monto: 10000, p_medio: 'transferencia',
      });
      expect(sena.ocupacion).toMatchObject({ pagado: 10000, estado_pago: 'parcial' });
      const resto = await rpc<{ pago_id: number; ocupacion: Ocupacion }>(db, club.dueno, 'club_registrar_pago', {
        p_club_id: club.clubId, p_ocupacion_id: reserva.id, p_monto: 20000, p_medio: 'efectivo',
      });
      expect(resto.ocupacion).toMatchObject({ pagado: 30000, estado_pago: 'pagado' });
      await rpc(db, club.dueno, 'club_anular_pago', { p_pago_id: resto.pago_id });
      const [{ pagado }] = await sql<{ pagado: string }>(db, `select pagado from public.ocupaciones where id = $1`, [reserva.id]);
      expect(Number(pagado)).toBe(10000);

      const hoy = await sql<{ hoy: string }>(db, `select to_char(private.hoy_ar(), 'YYYY-MM-DD') as hoy`);
      const caja = await rpc<{ totales: { total: number; por_medio: Record<string, number> } }>(db, club.dueno, 'club_caja', {
        p_club_id: club.clubId, p_desde: hoy[0].hoy, p_hasta: hoy[0].hoy,
      });
      expect(caja.totales.total).toBe(10000);
      expect(caja.totales.por_medio).toEqual({ transferencia: 10000 });
    });

    it('lista deudas de reservas ya jugadas', async () => {
      const cliente = await rpc<{ id: number }>(db, club.dueno, 'club_guardar_cliente', {
        p_club_id: club.clubId, p_nombre: 'Moroso FC', p_telefono: '1144443333',
      });
      const fecha = await proximaFecha(db, 5);
      const reserva = await reservaManual(fecha, '07:00', '08:00', { p_cliente_id: cliente.id, p_precio: 20000 });
      await sql(db, `update public.ocupaciones set inicio = now() - interval '3 days', fin = now() - interval '3 days' + interval '1 hour'
        where id = $1`, [reserva.id]);
      const deudas = await rpc<{ clientes: { cliente: { id: number }; saldo: number; impagas: number }[] }>(
        db, club.dueno, 'club_deudas', { p_club_id: club.clubId });
      expect(deudas.clientes.find((fila) => fila.cliente.id === cliente.id)).toMatchObject({ saldo: -20000, impagas: 1 });
      await rpc(db, club.dueno, 'club_registrar_pago', {
        p_club_id: club.clubId, p_cliente_id: cliente.id, p_monto: 20000, p_medio: 'efectivo', p_nota: 'Pagó todo',
      });
      const despues = await rpc<{ clientes: { cliente: { id: number } }[] }>(db, club.dueno, 'club_deudas', { p_club_id: club.clubId });
      expect(despues.clientes.find((fila) => fila.cliente.id === cliente.id)).toBeUndefined();
    });
  });

  describe('bloqueos', () => {
    it('exige confirmar si hay reservas y luego las cancela devolviendo los afectados', async () => {
      const fecha = await proximaFecha(db, 6);
      const solicitud = await rpc<{ ocupacion_id: number }>(db, jugadora, 'solicitar_reserva', {
        p_horario_id: await horarioId(db, club.canchas[0], 6, '20:00'), p_fecha: fecha,
      });
      await rpc(db, club.dueno, 'club_resolver_solicitud', { p_ocupacion_id: solicitud.ocupacion_id, p_confirmar: true });
      await rpc(db, club.dueno, 'club_registrar_pago', {
        p_club_id: club.clubId, p_ocupacion_id: solicitud.ocupacion_id, p_monto: 12000, p_medio: 'transferencia',
      });
      const manual = await reservaManual(fecha, '18:00', '20:00', { p_cliente_nombre: 'Sin app', p_cliente_telefono: '1133332222' });

      const args = {
        p_club_id: club.clubId, p_canchas: club.canchas, p_inicio: await instante(db, fecha, '08:00'),
        p_fin: await instante(db, fecha, '23:55'), p_motivo: 'Lluvia',
      };
      await expect(rpc(db, club.dueno, 'club_bloquear', args)).rejects.toThrow(/Hay 2 reserva/);
      const resultado = await rpc<{ bloqueos: number; canceladas: Ocupacion[] }>(db, club.dueno, 'club_bloquear', {
        ...args, p_cancelar_reservas: true,
      });
      expect(resultado.bloqueos).toBe(2);
      expect(resultado.canceladas.map((o) => o.id).sort()).toEqual([solicitud.ocupacion_id, manual.id].sort());
      expect(resultado.canceladas.find((o) => o.id === manual.id)!.cliente!.telefono).toBe('1133332222');
      expect((await notificacionesDe(db, jugadora)).map((n) => n.tipo)).toContain('reserva_cancelada_club');

      const hoy = await sql<{ desde: string; hasta: string }>(db,
        `select to_char(private.hoy_ar() - 1, 'YYYY-MM-DD') as desde, to_char(private.hoy_ar(), 'YYYY-MM-DD') as hasta`);
      const caja = await rpc<{ a_devolver: Ocupacion[] }>(db, club.dueno, 'club_caja', {
        p_club_id: club.clubId, p_desde: hoy[0].desde, p_hasta: hoy[0].hasta,
      });
      expect(caja.a_devolver.find((o) => o.id === solicitud.ocupacion_id)).toMatchObject({ estado_pago: 'a_devolver' });

      const disponibilidad = await rpc<{ bloques: { estado: string }[] }>(db, jugadora, 'disponibilidad', {
        p_club_id: club.clubId, p_desde: fecha, p_hasta: fecha,
      });
      expect(disponibilidad.bloques.every((b) => b.estado === 'ocupado')).toBe(true);
    });
  });

  describe('alquileres fijos', () => {
    it('previsualiza conflictos, los omite a pedido y materializa las fechas', async () => {
      const desde = await proximaFecha(db, 2, 1);
      const conflicto = await reservaManual(await proximaFecha(db, 2, 2), '21:00', '22:00', {
        p_titulo: 'Cumpleaños', p_cancha_id: club.canchas[1],
      });
      expect(conflicto.estado).toBe('confirmada');

      const vista = await rpc<{ fechas: number; conflictos: { fecha: string }[] }>(db, club.dueno, 'club_previsualizar_serie', {
        p_club_id: club.clubId, p_cancha_id: club.canchas[1], p_dia_semana: 2, p_hora_inicio: '20:30',
        p_duracion_min: 90, p_desde: desde,
      });
      expect(vista.fechas).toBeGreaterThanOrEqual(10);
      expect(vista.conflictos).toHaveLength(1);

      const base = {
        p_club_id: club.clubId, p_cancha_id: club.canchas[1], p_titulo: 'Martes de Juli', p_dia_semana: 2,
        p_hora_inicio: '20:30', p_duracion_min: 90, p_desde: desde, p_precio: 28000,
        p_cliente_nombre: 'Juli', p_cliente_telefono: '1177778888',
      };
      await expect(rpc(db, club.dueno, 'club_crear_serie', base)).rejects.toThrow(/ya está ocupada/);
      const serie = await rpc<{ serie_id: number; creadas: number; conflictos: string[] }>(db, club.dueno, 'club_crear_serie', {
        ...base, p_omitir_conflictos: true,
      });
      expect(serie.creadas).toBe(vista.fechas - 1);
      expect(serie.conflictos).toHaveLength(1);

      const fechas = await sql<{ dia: number; hora: string; minutos: number }>(db, `
        select extract(dow from inicio at time zone 'America/Argentina/Buenos_Aires')::int as dia,
          to_char(inicio at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI') as hora,
          extract(epoch from fin - inicio)::int / 60 as minutos
        from public.ocupaciones where serie_id = $1`, [serie.serie_id]);
      expect(fechas.every((f) => f.dia === 2 && f.hora === '20:30' && f.minutos === 90)).toBe(true);

      // Liberar una fecha puntual no la vuelve a generar.
      const [primera] = await sql<{ id: number }>(db,
        `select id from public.ocupaciones where serie_id = $1 order by inicio limit 1`, [serie.serie_id]);
      await rpc(db, club.dueno, 'club_cancelar_ocupacion', { p_ocupacion_id: primera.id, p_motivo: 'No vienen' });
      await rpc(db, club.admin, 'admin_ejecutar_tareas', {});
      const [{ activas }] = await sql<{ activas: number }>(db,
        `select count(*)::int as activas from public.ocupaciones where serie_id = $1 and estado = 'confirmada'`, [serie.serie_id]);
      expect(activas).toBe(serie.creadas - 1);

      // Un cambio de precio actualiza las fechas futuras sin cobrar.
      await rpc(db, club.dueno, 'club_modificar_serie', {
        p_serie_id: serie.serie_id, p_desde_fecha: desde, p_cancha_id: club.canchas[1], p_dia_semana: 2,
        p_hora_inicio: '20:30', p_duracion_min: 90, p_precio: 30000,
      });
      const precios = await sql<{ precio: string }>(db,
        `select distinct precio from public.ocupaciones where serie_id = $1 and estado = 'confirmada'`, [serie.serie_id]);
      expect(precios.map((p) => Number(p.precio))).toEqual([30000]);

      // Cambiar el horario divide la serie.
      const nueva = await rpc<{ serie_id: number; canceladas: number; creadas: number }>(db, club.dueno, 'club_modificar_serie', {
        p_serie_id: serie.serie_id, p_desde_fecha: await proximaFecha(db, 2, 4), p_cancha_id: club.canchas[1],
        p_dia_semana: 4, p_hora_inicio: '19:00', p_duracion_min: 60, p_precio: 30000, p_omitir_conflictos: true,
      });
      expect(nueva.serie_id).not.toBe(serie.serie_id);
      expect(nueva.canceladas).toBeGreaterThan(0);
      expect(nueva.creadas).toBeGreaterThan(0);

      const series = await rpcFilas<{ id: number; vigente: boolean }>(db, club.dueno, 'club_series', { p_club_id: club.clubId });
      expect(series.map((s) => s.id)).toEqual(expect.arrayContaining([serie.serie_id, nueva.serie_id]));

      const fin = await rpc<{ canceladas: number }>(db, club.dueno, 'club_finalizar_serie', {
        p_serie_id: nueva.serie_id, p_desde_fecha: await proximaFecha(db, 4, 6),
      });
      expect(fin.canceladas).toBeGreaterThan(0);
    });

    it('no reprograma fechas ya cobradas', async () => {
      const desde = await proximaFecha(db, 5, 1);
      const serie = await rpc<{ serie_id: number }>(db, club.dueno, 'club_crear_serie', {
        p_club_id: club.clubId, p_cancha_id: club.canchas[1], p_titulo: 'Viernes', p_dia_semana: 5,
        p_hora_inicio: '10:00', p_duracion_min: 60, p_desde: desde, p_precio: 20000, p_cliente_nombre: 'Viernes FC',
        p_omitir_conflictos: true,
      });
      const [primera] = await sql<{ id: number }>(db,
        `select id from public.ocupaciones where serie_id = $1 order by inicio limit 1`, [serie.serie_id]);
      await rpc(db, club.dueno, 'club_registrar_pago', {
        p_club_id: club.clubId, p_ocupacion_id: primera.id, p_monto: 20000, p_medio: 'efectivo',
      });
      await expect(rpc(db, club.dueno, 'club_finalizar_serie', { p_serie_id: serie.serie_id, p_desde_fecha: desde }))
        .rejects.toThrow(/ya cobradas/);
    });
  });

  describe('configuración', () => {
    it('valida horarios superpuestos, incluso cruzando días', async () => {
      const cancha = club.canchas[1];
      const guardar = (bloques: unknown[]) => rpc(db, club.dueno, 'club_guardar_horarios', { p_cancha_id: cancha, p_bloques: bloques });
      await expect(guardar([
        { dia_semana: 1, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 1, precio_sena: 0 },
        { dia_semana: 1, hora_inicio: '19:00', hora_fin: '21:00', precio_total: 1, precio_sena: 0 },
      ])).rejects.toThrow(/superpuestos/);
      await expect(guardar([
        { dia_semana: 6, hora_inicio: '23:00', hora_fin: '01:00', precio_total: 1, precio_sena: 0 },
        { dia_semana: 0, hora_inicio: '00:30', hora_fin: '02:00', precio_total: 1, precio_sena: 0 },
      ])).rejects.toThrow(/superpuestos/);
      await expect(guardar([
        { dia_semana: 1, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 1000, precio_sena: 2000 },
      ])).rejects.toThrow(/seña/);
      expect(await guardar([
        { dia_semana: 5, hora_inicio: '23:00', hora_fin: '01:00', precio_total: 1, precio_sena: 0 },
        { dia_semana: 6, hora_inicio: '01:00', hora_fin: '03:00', precio_total: 1, precio_sena: 0 },
      ])).toBe(2);
      await guardar(Array.from({ length: 7 }, (_, dia) => ({ dia_semana: dia, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 30000, precio_sena: 10000 })));
    });

    it('valida los datos públicos del club', async () => {
      const otro = await prepararClub(db, { nombre: 'Club Slug', admin: club.admin, canchas: 1 });
      const [{ slug }] = await sql<{ slug: string }>(db, `select slug from public.clubes where id = $1`, [club.clubId]);
      await expect(rpc(db, otro.dueno, 'club_actualizar', { p_club_id: otro.clubId, p_datos: { slug } }))
        .rejects.toThrow(/ya está en uso/);
      await expect(rpc(db, otro.dueno, 'club_actualizar', { p_club_id: otro.clubId, p_datos: { whatsapp: '1234' } }))
        .rejects.toThrow(/dígitos|código de país/);
      const actualizado = await rpc<{ slug: string; instagram: string }>(db, otro.dueno, 'club_actualizar', {
        p_club_id: otro.clubId, p_datos: { slug: 'Voley Sur Lanús', instagram: '@voley.sur' },
      });
      expect(actualizado).toMatchObject({ slug: 'voley-sur-lanus', instagram: 'voley.sur' });
      const nuevo = await rpc<{ club_id: number }>(db, club.admin, 'admin_crear_club', { p_nombre: 'Sin canchas' });
      await expect(rpc(db, club.admin, 'club_actualizar', { p_club_id: nuevo.club_id, p_datos: { publicado: true } }))
        .rejects.toThrow(/al menos una cancha/);
    });

    it('gestiona el equipo con invitaciones y protege al último dueño', async () => {
      const persona = await nuevoUsuario(db, { nombre: 'Encargada' });
      const intrusa = await nuevoUsuario(db, { nombre: 'Intrusa' });
      const invitacion = await rpc<{ token: string }>(db, club.dueno, 'club_invitar', {
        p_club_id: club.clubId, p_email: persona.email, p_rol: 'encargado',
      });
      expect(await rpc(db, intrusa, 'ver_invitacion_club', { p_token: invitacion.token })).toMatchObject({ valida: true, rol: 'encargado' });
      await expect(rpc(db, intrusa, 'aceptar_invitacion_club', { p_token: invitacion.token })).rejects.toThrow(/otra dirección/);
      await rpc(db, persona, 'aceptar_invitacion_club', { p_token: invitacion.token });
      await expect(rpc(db, persona, 'aceptar_invitacion_club', { p_token: invitacion.token })).rejects.toThrow(/ya fue usada/);
      const perfil = await rpc<{ clubes: { id: number; rol: string }[] }>(db, persona, 'mi_perfil', {});
      expect(perfil.clubes).toEqual([expect.objectContaining({ id: club.clubId, rol: 'encargado' })]);
      await expect(rpc(db, club.dueno, 'club_cambiar_miembro', { p_club_id: club.clubId, p_user_id: club.dueno.id, p_rol: null }))
        .rejects.toThrow(/al menos un dueño/);
      await rpc(db, club.dueno, 'club_cambiar_miembro', { p_club_id: club.clubId, p_user_id: persona.id, p_rol: null });
      await expect(rpc(db, persona, 'club_panel', { p_club_id: club.clubId })).rejects.toThrow(/No tenés permiso/);
    });
  });

  it('reporta ocupación, cobros y auditoría', async () => {
    const [{ desde, hasta }] = await sql<{ desde: string; hasta: string }>(db,
      `select to_char(private.hoy_ar() - 7, 'YYYY-MM-DD') as desde, to_char(private.hoy_ar() + 21, 'YYYY-MM-DD') as hasta`);
    const reporte = await rpc<{ minutos_disponibles: number; minutos_reservados: number; reservas: number; calor: unknown[]; por_cancha: unknown[] }>(
      db, club.dueno, 'club_reporte', { p_club_id: club.clubId, p_desde: desde, p_hasta: hasta });
    expect(reporte.minutos_disponibles).toBeGreaterThan(0);
    expect(reporte.minutos_reservados).toBeGreaterThan(0);
    expect(reporte.reservas).toBeGreaterThan(0);
    expect(reporte.calor.length).toBeGreaterThan(0);
    expect(reporte.por_cancha).toHaveLength(2);
    const auditoria = await rpcFilas<{ accion: string }>(db, club.dueno, 'club_auditoria', { p_club_id: club.clubId });
    expect(auditoria.map((a) => a.accion)).toEqual(expect.arrayContaining(['reserva.crear', 'pago.registrar', 'agenda.bloquear']));
  });

  it('publica partidos abiertos del club que aparecen en la búsqueda', async () => {
    const fecha = await proximaFecha(db, 0, 2);
    const publicado = await rpc<{ partido_id: number }>(db, club.dueno, 'club_publicar_partido', {
      p_club_id: club.clubId, p_cancha_id: club.canchas[0], p_inicio: await instante(db, fecha, '10:00'),
      p_fin: await instante(db, fecha, '12:00'), p_cupo_minimo: 6, p_cupo_maximo: 12, p_nivel: 'recreativo',
      p_precio_por_jugador: 4000,
    });
    const encontrados = await rpcFilas<{ id: number; organiza_club: boolean; organizador_nombre: string }>(
      db, jugadora, 'explorar_partidos', {});
    expect(encontrados.find((p) => p.id === publicado.partido_id)).toMatchObject({ organiza_club: true, organizador_nombre: 'Club Operación' });
    expect(await rpc(db, jugadora, 'partido_unirse', { p_partido_id: publicado.partido_id })).toEqual({ estado_inscripcion: 'confirmado' });
  });
});
