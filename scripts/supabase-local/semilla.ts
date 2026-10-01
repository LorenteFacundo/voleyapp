// Datos de ejemplo para el entorno local: dos clubes con canchas, horarios,
// equipo, clientes, fijos, reservas cargadas por WhatsApp, cobros, pedidos de
// la app, partidos y un bloqueo. Se crean con las mismas RPC que usa la app.
//
// Cuentas (solo locales, contraseña "voley1234"):
//   admin@voley.local       administración global (superadmin)
//   club@voley.local        dueña de Club Demo Sur
//   encargado@voley.local   encargado de Club Demo Sur
//   costanera@voley.local   dueño de Beach Vóley Demo
//   ana@ / beto@ / caro@ / dani@voley.local  jugadores habilitados

import type { PGlite } from '@electric-sql/pglite';

export const CLAVE_DEMO = 'voley1234';

type CrearUsuario = (db: PGlite, datos: { email: string; clave: string; nombre: string; nivel?: number; telefono?: string | null }) => Promise<string>;

async function llamar<T = unknown>(db: PGlite, usuario: string, funcion: string, argumentos: Record<string, unknown> = {}): Promise<T> {
  const tipos = Object.fromEntries((await db.query<{ nombre: string; tipo: string }>(
    `select unnest(p.proargnames) as nombre, unnest(p.proargtypes::regtype[]::text[]) as tipo
     from pg_proc p where p.proname = $1 and p.pronamespace = 'public'::regnamespace`, [funcion])).rows
    .map((fila) => [fila.nombre, fila.tipo]));
  const nombres = Object.keys(argumentos);
  const valores = nombres.map((nombre) => {
    const valor = argumentos[nombre];
    if (valor === null || valor === undefined) return null;
    if (tipos[nombre] === 'jsonb') return JSON.stringify(valor);
    if (Array.isArray(valor)) return `{${valor.join(',')}}`;
    return valor;
  });
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: 'authenticated' })]);
    await tx.exec('set local role authenticated');
    const resultado = await tx.query<{ r: T }>(
      `select public.${funcion}(${nombres.map((nombre, i) => `${nombre} => $${i + 1}::${tipos[nombre]}`).join(', ')}) as r`, valores);
    return resultado.rows[0]?.r as T;
  });
}

async function hoy(db: PGlite): Promise<string> {
  return (await db.query<{ d: string }>(`select to_char(private.hoy_ar(), 'YYYY-MM-DD') as d`)).rows[0].d;
}

async function mas(db: PGlite, fecha: string, dias: number): Promise<string> {
  return (await db.query<{ d: string }>(`select to_char($1::date + $2::int, 'YYYY-MM-DD') as d`, [fecha, dias])).rows[0].d;
}

async function diaSemana(db: PGlite, fecha: string): Promise<number> {
  return (await db.query<{ d: number }>(`select extract(dow from $1::date)::int as d`, [fecha])).rows[0].d;
}

async function instante(db: PGlite, fecha: string, hora: string): Promise<string> {
  return (await db.query<{ i: string }>(
    `select to_char(private.instante_ar($1::date, $2::time) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as i`, [fecha, hora])).rows[0].i;
}

function bloques(dias: number[], tramos: [string, string, number, number][]) {
  return dias.flatMap((dia) => tramos.map(([inicio, fin, precio, sena]) => ({
    dia_semana: dia, hora_inicio: inicio, hora_fin: fin, precio_total: precio, precio_sena: sena,
  })));
}

export async function sembrar(db: PGlite, crearUsuario: CrearUsuario): Promise<void> {
  const clave = CLAVE_DEMO;
  const admin = await crearUsuario(db, { email: 'admin@voley.local', clave, nombre: 'Admin VoleyApp', nivel: 5 });
  await db.query(`update public.usuarios set rol = 'superadmin' where id = $1`, [admin]);
  const duena = await crearUsuario(db, { email: 'club@voley.local', clave, nombre: 'Laura Gómez', telefono: '5491100000001' });
  const encargado = await crearUsuario(db, { email: 'encargado@voley.local', clave, nombre: 'Martín Ríos', telefono: '5491100000002' });
  const costanera = await crearUsuario(db, { email: 'costanera@voley.local', clave, nombre: 'Diego Sosa', telefono: '5491100000003' });
  const ana = await crearUsuario(db, { email: 'ana@voley.local', clave, nombre: 'Ana Pereyra', nivel: 5, telefono: '5491155550001' });
  const beto = await crearUsuario(db, { email: 'beto@voley.local', clave, nombre: 'Beto Fernández', nivel: 8, telefono: '5491155550002' });
  const caro = await crearUsuario(db, { email: 'caro@voley.local', clave, nombre: 'Caro Medina', nivel: 2, telefono: '5491155550003' });
  const dani = await crearUsuario(db, { email: 'dani@voley.local', clave, nombre: 'Dani Acosta', nivel: 5, telefono: '5491155550004' });

  await llamar(db, admin, 'admin_configurar_operacion', { p_reservas_pausadas: false, p_requiere_lista_acceso: true });
  for (const jugador of [ana, beto, caro, dani]) {
    await llamar(db, admin, 'admin_definir_acceso', { p_usuario_id: jugador, p_habilitado: true });
  }

  // --- Club Demo Sur -----------------------------------------------------
  const { club_id: lanus } = await llamar<{ club_id: number }>(db, admin, 'admin_crear_club', {
    p_nombre: 'Club Demo Sur', p_zona: 'Lanús', p_direccion: 'Calle Falsa 123, Lanús',
    p_latitud: -34.7000, p_longitud: -58.3900, p_telefono: '1100000001', p_whatsapp: '5491100000001',
  });
  const invitarDuena = await llamar<{ token: string }>(db, admin, 'club_invitar', { p_club_id: lanus, p_email: 'club@voley.local', p_rol: 'dueno' });
  await llamar(db, duena, 'aceptar_invitacion_club', { p_token: invitarDuena.token });
  const invitarEncargado = await llamar<{ token: string }>(db, duena, 'club_invitar', { p_club_id: lanus, p_email: 'encargado@voley.local', p_rol: 'encargado' });
  await llamar(db, encargado, 'aceptar_invitacion_club', { p_token: invitarEncargado.token });

  const semana = [1, 2, 3, 4, 5];
  const finde = [6, 0];
  const canchas: number[] = [];
  for (const [indice, datos] of [
    { titulo: 'Cancha 1', superficie: 'parquet', techada: true },
    { titulo: 'Cancha 2', superficie: 'parquet', techada: true },
    { titulo: 'Cancha Beach', superficie: 'arena', techada: false },
  ].entries()) {
    const cancha = await llamar<{ id: number }>(db, duena, 'club_guardar_cancha', {
      p_club_id: lanus, p_titulo: datos.titulo, p_precio_total: 30000, p_precio_sena: 10000,
      p_techada: datos.techada, p_superficie: datos.superficie, p_orden: indice + 1,
      p_descripcion: datos.techada ? 'Piso de parquet flotante, red reglamentaria y vestuarios.' : 'Arena fina, ideal para vóley playa 2 vs 2 o 4 vs 4.',
    });
    canchas.push(cancha.id);
    const horarios = datos.techada
      ? [
        ...bloques(semana, [['17:00', '18:30', 25000, 8000], ['18:30', '20:00', 30000, 10000], ['20:00', '21:30', 34000, 10000], ['21:30', '23:00', 34000, 10000], ['23:00', '00:30', 28000, 8000]]),
        ...bloques(finde, [['10:00', '12:00', 30000, 10000], ['12:00', '14:00', 30000, 10000], ['16:00', '18:00', 32000, 10000], ['18:00', '20:00', 32000, 10000]]),
      ]
      : [
        ...bloques([5], [['18:00', '20:00', 26000, 8000], ['20:00', '22:00', 26000, 8000]]),
        ...bloques(finde, [['10:00', '12:00', 24000, 8000], ['12:00', '14:00', 24000, 8000], ['15:00', '17:00', 26000, 8000], ['17:00', '19:00', 26000, 8000]]),
      ];
    await llamar(db, duena, 'club_guardar_horarios', { p_cancha_id: cancha.id, p_bloques: horarios });
  }
  await llamar(db, duena, 'club_actualizar', {
    p_club_id: lanus,
    p_datos: {
      publicado: true, instagram: 'clubdemosur', alias_pago: 'club.demo.sur', titular_pago: 'Club Demo Sur',
      descripcion: 'Club de barrio con dos canchas techadas de parquet y una de beach. Vestuarios, buffet y estacionamiento.',
      politicas: 'Se confirma con seña. Cancelaciones sin cargo hasta 24 h antes. Llegá 10 minutos antes para armar la red.',
      respuesta_horas: 6,
    },
  });

  const clientes: Record<string, number> = {};
  for (const [nombre, telefono, notas] of [
    ['Las Panteras (Sofi)', '5491161110001', 'Equipo femenino, juegan torneo los sábados.'],
    ['Martes Mixto (Nico)', '5491161110002', null],
    ['Veteranos del Sur', '5491161110003', 'Pagan por mes, el primer lunes.'],
    ['Escuelita Juvenil (Prof. Vale)', '5491161110004', 'Clases para chicos de 12 a 16 años.'],
    ['Grupo Facultad (Tomi)', '5491161110005', null],
    ['Vóley Amigas (Juli)', '5491161110006', null],
    ['Los Pibes del Jueves', '5491161110007', 'Suelen pedir red alta.'],
    ['Hernán (Lunes)', '5491161110008', null],
  ] as const) {
    const cliente = await llamar<{ id: number }>(db, duena, 'club_guardar_cliente', {
      p_club_id: lanus, p_nombre: nombre, p_telefono: telefono, p_notas: notas,
    });
    clientes[nombre] = cliente.id;
  }

  const fecha = await hoy(db);
  const haceUnaSemana = await mas(db, fecha, -7);
  // Fijos semanales (generan sus fechas hasta 12 semanas adelante).
  for (const [titulo, cliente, cancha, dia, hora, duracion, precio] of [
    ['Martes Mixto', 'Martes Mixto (Nico)', 0, 2, '20:00', 90, 34000],
    ['Veteranos del Sur', 'Veteranos del Sur', 1, 1, '21:30', 90, 32000],
    ['Escuelita Juvenil', 'Escuelita Juvenil (Prof. Vale)', 1, 3, '17:00', 90, 22000],
    ['Los Pibes del Jueves', 'Los Pibes del Jueves', 0, 4, '21:30', 90, 34000],
    ['Las Panteras', 'Las Panteras (Sofi)', 0, 6, '10:00', 120, 30000],
  ] as const) {
    await llamar(db, duena, 'club_crear_serie', {
      p_club_id: lanus, p_cancha_id: canchas[cancha], p_titulo: titulo, p_dia_semana: dia, p_hora_inicio: hora,
      p_duracion_min: duracion, p_desde: haceUnaSemana, p_precio: precio, p_cliente_id: clientes[cliente],
      p_omitir_conflictos: true,
    });
  }

  // Reservas de los últimos días cargadas por WhatsApp/teléfono, con cobros parciales.
  const pasadas: [number, string, string, number, string, string, number][] = [
    [-6, '18:30', '20:00', 0, 'Grupo Facultad (Tomi)', 'whatsapp', 30000],
    [-5, '20:00', '21:30', 1, 'Vóley Amigas (Juli)', 'whatsapp', 34000],
    [-4, '18:30', '20:00', 1, 'Hernán (Lunes)', 'telefono', 30000],
    [-3, '20:00', '21:30', 1, 'Grupo Facultad (Tomi)', 'whatsapp', 34000],
    [-2, '18:30', '20:00', 0, 'Vóley Amigas (Juli)', 'mostrador', 30000],
    [-1, '20:00', '21:30', 1, 'Hernán (Lunes)', 'whatsapp', 34000],
  ];
  for (const [dias, desde, hasta, cancha, cliente, origen, precio] of pasadas) {
    const dia = await mas(db, fecha, dias);
    try {
      const reserva = await llamar<{ id: number }>(db, encargado, 'club_crear_reserva', {
        p_club_id: lanus, p_cancha_id: canchas[cancha], p_inicio: await instante(db, dia, desde),
        p_fin: await instante(db, dia, hasta), p_cliente_id: clientes[cliente], p_origen: origen, p_precio: precio,
      });
      // Algunas quedan pagas, otras con seña y otras impagas (para ver deudas).
      if (dias % 3 === 0) {
        await llamar(db, encargado, 'club_registrar_pago', { p_club_id: lanus, p_ocupacion_id: reserva.id, p_monto: precio, p_medio: 'efectivo', p_fecha: dia });
      } else if (dias % 2 === 0) {
        await llamar(db, encargado, 'club_registrar_pago', { p_club_id: lanus, p_ocupacion_id: reserva.id, p_monto: 10000, p_medio: 'transferencia', p_fecha: dia });
      }
    } catch {
      // Si choca con un fijo de ejemplo, se omite.
    }
  }

  // Próximos días: reservas por WhatsApp, pedidos desde la app y un partido.
  const manana = await mas(db, fecha, 1);
  const pasado = await mas(db, fecha, 2);
  for (const [dia, desde, hasta, cancha, nombre, telefono] of [
    [manana, '18:30', '20:00', 1, 'Cumple de Mica', '5491170001111'],
    [pasado, '20:00', '21:30', 1, 'Equipo Remedios de Escalada', '5491170002222'],
  ] as const) {
    try {
      await llamar(db, duena, 'club_crear_reserva', {
        p_club_id: lanus, p_cancha_id: canchas[cancha], p_inicio: await instante(db, dia, desde),
        p_fin: await instante(db, dia, hasta), p_cliente_nombre: nombre, p_cliente_telefono: telefono, p_origen: 'whatsapp',
      });
    } catch {
      // Horario ocupado por un fijo: se omite.
    }
  }

  const bloqueDe = async (cancha: number, fechaBloque: string, hora: string) => (await db.query<{ id: number }>(
    `select id from public.horarios_semanales where cancha_id = $1 and dia_semana = extract(dow from $2::date)::int and hora_inicio = $3::time`,
    [canchas[cancha], fechaBloque, hora])).rows[0]?.id;
  const pedir = async (jugador: string, cancha: number, dias: number, hora: string, partido: Record<string, unknown> | null = null) => {
    let dia = await mas(db, fecha, dias);
    // Busca el próximo día hábil con ese bloque libre.
    for (let intento = 0; intento < 7; intento += 1) {
      const horario = await bloqueDe(cancha, dia, hora);
      if (horario) {
        try {
          return await llamar<{ ocupacion_id: number; partido_id: number | null }>(db, jugador, 'solicitar_reserva', {
            p_horario_id: horario, p_fecha: dia, p_partido: partido,
          });
        } catch { /* ocupado: probar el día siguiente */ }
      }
      dia = await mas(db, dia, 1);
    }
    return null;
  };

  const pedidoAna = await pedir(ana, 0, 2, '18:30');
  if (pedidoAna) await llamar(db, ana, 'informar_pago', { p_ocupacion_id: pedidoAna.ocupacion_id });
  await pedir(dani, 1, 3, '20:00');
  const conPartido = await pedir(beto, 1, 1, '21:30', {
    cupo_minimo: 8, cupo_maximo: 12, invitados: 2, nivel_requerido: 'intermedio', visibilidad: 'publico',
    requiere_aprobacion: false, descripcion: 'Partido mixto 6 vs 6, buena onda. Traigan agua.', precio_por_jugador: 3000,
  });
  if (conPartido) {
    await llamar(db, duena, 'club_resolver_solicitud', { p_ocupacion_id: conPartido.ocupacion_id, p_confirmar: true });
    if (conPartido.partido_id) {
      for (const jugador of [ana, dani]) await llamar(db, jugador, 'partido_unirse', { p_partido_id: conPartido.partido_id });
    }
  }
  const confirmadaDani = await pedir(dani, 0, 4, '17:00');
  if (confirmadaDani) await llamar(db, duena, 'club_resolver_solicitud', { p_ocupacion_id: confirmadaDani.ocupacion_id, p_confirmar: true });

  // Partido abierto organizado por el club para llenar un horario valle.
  for (let dias = 1; dias <= 6; dias += 1) {
    const dia = await mas(db, fecha, dias);
    if (![1, 2, 3, 4, 5].includes(await diaSemana(db, dia))) continue;
    try {
      const abierto = await llamar<{ partido_id: number }>(db, duena, 'club_publicar_partido', {
        p_club_id: lanus, p_cancha_id: canchas[0], p_inicio: await instante(db, dia, '17:00'), p_fin: await instante(db, dia, '18:30'),
        p_cupo_minimo: 8, p_cupo_maximo: 14, p_nivel: 'recreativo', p_precio_por_jugador: 2500,
        p_descripcion: 'Partido abierto del club: vení solo o con amigos, armamos equipos en el momento.',
      });
      await llamar(db, caro, 'partido_unirse', { p_partido_id: abierto.partido_id });
      break;
    } catch { /* horario ocupado: probar otro día */ }
  }

  // Bloqueo del próximo sábado a la mañana por torneo interno.
  let sabado = await mas(db, fecha, 1);
  while (await diaSemana(db, sabado) !== 6) sabado = await mas(db, sabado, 1);
  try {
    await llamar(db, duena, 'club_bloquear', {
      p_club_id: lanus, p_canchas: [canchas[1], canchas[2]], p_inicio: await instante(db, sabado, '12:00'),
      p_fin: await instante(db, sabado, '14:00'), p_motivo: 'Torneo interno sub-16', p_cancelar_reservas: true,
    });
  } catch { /* ya ocupado */ }

  // --- Beach Vóley Demo (confirmación automática) -------------------------
  const { club_id: playa } = await llamar<{ club_id: number }>(db, admin, 'admin_crear_club', {
    p_nombre: 'Beach Vóley Demo', p_zona: 'Zona Norte, CABA', p_direccion: 'Avenida Ficticia 456, CABA',
    p_latitud: -34.5600, p_longitud: -58.4000, p_whatsapp: '5491100000003',
  });
  const invitarCostanera = await llamar<{ token: string }>(db, admin, 'club_invitar', { p_club_id: playa, p_email: 'costanera@voley.local', p_rol: 'dueno' });
  await llamar(db, costanera, 'aceptar_invitacion_club', { p_token: invitarCostanera.token });
  for (const titulo of ['Arena 1', 'Arena 2']) {
    const cancha = await llamar<{ id: number }>(db, costanera, 'club_guardar_cancha', {
      p_club_id: playa, p_titulo: titulo, p_precio_total: 28000, p_precio_sena: 0, p_techada: false, p_superficie: 'arena',
    });
    await llamar(db, costanera, 'club_guardar_horarios', {
      p_cancha_id: cancha.id,
      p_bloques: bloques([0, 1, 2, 3, 4, 5, 6], [['09:00', '11:00', 22000, 0], ['11:00', '13:00', 24000, 0], ['16:00', '18:00', 26000, 0], ['18:00', '20:00', 28000, 0], ['20:00', '22:00', 28000, 0]]),
    });
  }
  await llamar(db, costanera, 'club_actualizar', {
    p_club_id: playa,
    p_datos: {
      publicado: true, confirmacion_automatica: true, instagram: 'beachdemo', alias_pago: 'beach.demo',
      descripcion: 'Canchas de arena frente al río. Alquiler de pelotas y duchas.',
    },
  });

  // Consultas de clubes interesados (formulario de la landing).
  await db.query(`insert into public.solicitudes_club(club_nombre, localidad, contacto_nombre, contacto, cantidad_canchas)
    values ('Club Atlético Banfield (vóley)', 'Banfield', 'Paula Ortiz', 'paula.ortiz@ejemplo.com', 2),
           ('Polideportivo Quilmes Oeste', 'Quilmes', 'Jorge Benítez', '11 4567-8910', 3)`);
}
