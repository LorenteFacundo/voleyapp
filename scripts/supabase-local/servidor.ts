// Supabase local sin Docker, para desarrollo y demos.
//
// Emula la parte de Supabase que usa VoleyApp: PostgREST (RPC y lecturas de
// tablas con embebidos), Auth por email y contraseña, Storage público y la
// Edge Function de captación. La base es PostgreSQL real (PGlite) con las
// mismas migraciones, roles, RLS y permisos que producción.
//
// Uso:  npm run dev:local        (servidor + Vite)
//       npm run supabase:local   (solo este servidor; --reset para recrear la base)

import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { postgis } from '@electric-sql/pglite-postgis';
import { sembrar } from './semilla.ts';

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const DIR_DATOS = join(RAIZ, 'supabase', '.local', 'db');
const DIR_ARCHIVOS = join(RAIZ, 'supabase', '.local', 'storage');
const PUERTO = Number(process.env.SUPABASE_LOCAL_PORT ?? 54321);
const SECRETO_JWT = 'voleyapp-local-solo-desarrollo';
const DURACION_SESION = 3600;

export const CLAVE_ANONIMA = 'voleyapp-local-anon';

type Rol = 'anon' | 'authenticated' | 'service_role';
type Identidad = { rol: Rol; usuarioId: string | null; email: string | null };

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------

async function abrirBase(reiniciar: boolean): Promise<PGlite> {
  if (reiniciar && existsSync(DIR_DATOS)) rmSync(DIR_DATOS, { recursive: true, force: true });
  const nueva = !existsSync(join(DIR_DATOS, 'PG_VERSION'));
  mkdirSync(DIR_DATOS, { recursive: true });
  const db = await PGlite.create({ dataDir: DIR_DATOS, extensions: { btree_gist, pgcrypto, unaccent, postgis } });
  if (nueva) {
    console.log('Creando la base local (la primera vez tarda unos segundos)…');
    await db.exec(readFileSync(join(RAIZ, 'tests', 'db', 'supabase-shim.sql'), 'utf8'));
    await db.exec(`
      alter table auth.users add column if not exists encrypted_password text;
      alter table auth.users add column if not exists updated_at timestamptz default now();
      create schema if not exists supabase_local;
      create table supabase_local.migraciones (version text primary key, aplicada_at timestamptz default now());
    `);
  }
  await db.exec(`set timezone to 'UTC'`);
  const aplicadas = new Set((await db.query<{ version: string }>('select version from supabase_local.migraciones')).rows.map((f) => f.version));
  const carpeta = join(RAIZ, 'supabase', 'migrations');
  const archivos = (await import('node:fs')).readdirSync(carpeta).filter((n) => n.endsWith('.sql')).sort();
  for (const archivo of archivos) {
    const version = archivo.slice(0, 14);
    if (aplicadas.has(version)) continue;
    await db.exec(readFileSync(join(carpeta, archivo), 'utf8'));
    await db.query('insert into supabase_local.migraciones(version) values ($1)', [version]);
    console.log(`  migración aplicada: ${archivo}`);
  }
  if (nueva) {
    console.log('Cargando datos de ejemplo…');
    await sembrar(db, crearUsuarioLocal);
  }
  return db;
}

// Una conexión: las operaciones se encolan para no mezclar transacciones.
let cola: Promise<unknown> = Promise.resolve();
function enCola<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.catch(() => undefined);
  return resultado;
}

async function comoIdentidad<T>(db: PGlite, identidad: Identidad, trabajo: (tx: Parameters<Parameters<PGlite['transaction']>[0]>[0]) => Promise<T>): Promise<T> {
  return enCola(() => db.transaction(async (tx) => {
    const claims = { sub: identidad.usuarioId, role: identidad.rol, email: identidad.email };
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await tx.exec(`set local role ${identidad.rol}`);
    return trabajo(tx);
  }));
}

// ---------------------------------------------------------------------------
// Tokens y contraseñas
// ---------------------------------------------------------------------------

function base64url(datos: Buffer | string): string {
  return Buffer.from(datos).toString('base64url');
}

function firmarJwt(carga: Record<string, unknown>): string {
  const cabecera = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = base64url(JSON.stringify(carga));
  const firma = createHmac('sha256', SECRETO_JWT).update(`${cabecera}.${cuerpo}`).digest('base64url');
  return `${cabecera}.${cuerpo}.${firma}`;
}

function verificarJwt(token: string): Record<string, unknown> | null {
  const [cabecera, cuerpo, firma] = token.split('.');
  if (!cabecera || !cuerpo || !firma) return null;
  const esperada = createHmac('sha256', SECRETO_JWT).update(`${cabecera}.${cuerpo}`).digest('base64url');
  if (esperada.length !== firma.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(firma))) return null;
  const carga = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as Record<string, unknown>;
  if (typeof carga.exp === 'number' && carga.exp < Date.now() / 1000) return null;
  return carga;
}

function hashClave(clave: string): string {
  const sal = randomBytes(16).toString('hex');
  return `${sal}:${scryptSync(clave, sal, 32).toString('hex')}`;
}

function claveValida(clave: string, guardada: string | null): boolean {
  if (!guardada) return false;
  const [sal, hash] = guardada.split(':');
  const calculado = scryptSync(clave, sal, 32);
  return timingSafeEqual(calculado, Buffer.from(hash, 'hex'));
}

const refreshTokens = new Map<string, string>();

type FilaUsuario = { id: string; email: string; raw_user_meta_data: Record<string, unknown>; email_confirmed_at: string | null; created_at: string };

function usuarioGoTrue(fila: FilaUsuario) {
  return {
    id: fila.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: fila.email,
    email_confirmed_at: fila.email_confirmed_at,
    confirmed_at: fila.email_confirmed_at,
    phone: '',
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: fila.raw_user_meta_data ?? {},
    identities: [],
    created_at: fila.created_at,
    updated_at: new Date().toISOString(),
  };
}

function crearSesion(fila: FilaUsuario) {
  const ahora = Math.floor(Date.now() / 1000);
  const access_token = firmarJwt({
    sub: fila.id, email: fila.email, role: 'authenticated', aud: 'authenticated',
    iat: ahora, exp: ahora + DURACION_SESION, session_id: randomUUID(),
  });
  const refresh_token = randomBytes(24).toString('hex');
  refreshTokens.set(refresh_token, fila.id);
  return {
    access_token, token_type: 'bearer', expires_in: DURACION_SESION, expires_at: ahora + DURACION_SESION,
    refresh_token, user: usuarioGoTrue(fila),
  };
}

export async function crearUsuarioLocal(
  db: PGlite, datos: { email: string; clave: string; nombre: string; nivel?: number; telefono?: string | null },
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into auth.users(id, email, raw_user_meta_data, email_confirmed_at, encrypted_password)
     values ($1, $2, $3, now(), $4)`,
    [id, datos.email.toLowerCase(), JSON.stringify({ nombre_completo: datos.nombre, nivel_voley: datos.nivel ?? 5, telefono: datos.telefono ?? null }), hashClave(datos.clave)],
  );
  return id;
}

// ---------------------------------------------------------------------------
// Utilidades HTTP
// ---------------------------------------------------------------------------

function cors(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*');
  res.setHeader('Access-Control-Expose-Headers', 'content-range, content-profile');
}

function responder(res: ServerResponse, estado: number, cuerpo?: unknown, tipo = 'application/json'): void {
  res.statusCode = estado;
  if (cuerpo === undefined) { res.end(); return; }
  res.setHeader('Content-Type', tipo);
  res.end(typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo));
}

async function leerCuerpo(req: IncomingMessage): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of req) partes.push(parte as Buffer);
  return Buffer.concat(partes);
}

async function leerJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const cuerpo = await leerCuerpo(req);
  if (!cuerpo.length) return {};
  return JSON.parse(cuerpo.toString('utf8')) as Record<string, unknown>;
}

function identidadDe(req: IncomingMessage): Identidad {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const carga = token && token !== CLAVE_ANONIMA ? verificarJwt(token) : null;
  if (carga?.role === 'authenticated' && typeof carga.sub === 'string') {
    return { rol: 'authenticated', usuarioId: carga.sub, email: (carga.email as string) ?? null };
  }
  return { rol: 'anon', usuarioId: null, email: null };
}

type ErrorPg = { code?: string; message?: string; detail?: string; hint?: string };

function errorPostgrest(res: ServerResponse, error: unknown, identidad: Identidad): void {
  const { code = 'XX000', message = 'Error', detail, hint } = error as ErrorPg;
  const estado = code === '42501' ? (identidad.rol === 'anon' ? 401 : 403)
    : code === 'P0002' || code === '42883' ? 404
      : code === '23505' || code === '23P01' ? 409
        : 400;
  responder(res, estado, { code, message, details: detail ?? null, hint: hint ?? null });
}

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;
function identificador(nombre: string): string {
  if (!IDENTIFICADOR.test(nombre)) throw Object.assign(new Error(`Identificador inválido: ${nombre}`), { code: '42601' });
  return `"${nombre}"`;
}

// ---------------------------------------------------------------------------
// PostgREST: RPC
// ---------------------------------------------------------------------------

type Firma = { tipos: Record<string, string>; devuelveConjunto: boolean };
const firmas = new Map<string, Firma>();

async function firmaDe(db: PGlite, funcion: string): Promise<Firma | null> {
  if (firmas.has(funcion)) return firmas.get(funcion)!;
  const filas = await enCola(() => db.query<{ nombres: string[] | null; tipos: string[]; conjunto: boolean }>(
    `select p.proargnames as nombres, p.proargtypes::regtype[]::text[] as tipos, p.proretset as conjunto
     from pg_proc p where p.proname = $1 and p.pronamespace = 'public'::regnamespace limit 1`, [funcion]));
  const fila = filas.rows[0];
  if (!fila) return null;
  const tipos: Record<string, string> = {};
  (fila.nombres ?? []).forEach((nombre, indice) => { if (fila.tipos[indice]) tipos[nombre] = fila.tipos[indice]; });
  const firma = { tipos, devuelveConjunto: fila.conjunto };
  firmas.set(funcion, firma);
  return firma;
}

function valorParametro(valor: unknown, tipo: string): unknown {
  if (valor === null || valor === undefined) return null;
  if (tipo === 'jsonb' || tipo === 'json') return JSON.stringify(valor);
  if (tipo.endsWith('[]') && Array.isArray(valor)) {
    return `{${valor.map((item) => `"${String(item).replace(/(["\\])/g, '\\$1')}"`).join(',')}}`;
  }
  return valor;
}

async function rpc(db: PGlite, req: IncomingMessage, res: ServerResponse, funcion: string): Promise<void> {
  const identidad = identidadDe(req);
  try {
    const firma = await firmaDe(db, funcion);
    if (!firma) {
      responder(res, 404, { code: 'PGRST202', message: `Could not find the function public.${funcion}`, details: null, hint: null });
      return;
    }
    const argumentos = req.method === 'GET'
      ? Object.fromEntries(new URL(req.url ?? '', 'http://x').searchParams)
      : await leerJson(req);
    const nombres = Object.keys(argumentos).filter((nombre) => nombre in firma.tipos);
    const sql = `select public.${identificador(funcion)}(${nombres
      .map((nombre, i) => `${identificador(nombre)} => $${i + 1}::${firma.tipos[nombre]}`).join(', ')}) as r`;
    const filas = await comoIdentidad(db, identidad, (tx) =>
      tx.query<{ r: unknown }>(sql, nombres.map((nombre) => valorParametro(argumentos[nombre], firma.tipos[nombre]))));
    const datos = firma.devuelveConjunto ? filas.rows.map((fila) => fila.r) : filas.rows[0]?.r ?? null;
    responder(res, 200, JSON.stringify(datos));
  } catch (error) {
    errorPostgrest(res, error, identidad);
  }
}

// ---------------------------------------------------------------------------
// PostgREST: lecturas y actualizaciones de tablas (subconjunto)
// ---------------------------------------------------------------------------

type NodoSelect = { columnas: string[]; embebidos: { tabla: string; nodo: NodoSelect }[] };

function parsearSelect(texto: string): NodoSelect {
  const nodo: NodoSelect = { columnas: [], embebidos: [] };
  let profundidad = 0;
  let actual = '';
  const partes: string[] = [];
  for (const caracter of texto.replace(/\s+/g, '')) {
    if (caracter === '(') profundidad += 1;
    if (caracter === ')') profundidad -= 1;
    if (caracter === ',' && profundidad === 0) { partes.push(actual); actual = ''; } else actual += caracter;
  }
  if (actual) partes.push(actual);
  for (const parte of partes) {
    const embebido = /^([a-z_][a-z0-9_]*)\((.*)\)$/.exec(parte);
    if (embebido) nodo.embebidos.push({ tabla: embebido[1], nodo: parsearSelect(embebido[2]) });
    else nodo.columnas.push(parte);
  }
  return nodo;
}

type Relacion = { tipo: 'hijos' | 'padre'; columnaHija: string; columnaPadre: string };

async function relacion(db: PGlite, base: string, embebida: string): Promise<Relacion> {
  const filas = await enCola(() => db.query<{ origen: string; destino: string; col_origen: string; col_destino: string }>(`
    select c.conrelid::regclass::text as origen, c.confrelid::regclass::text as destino,
      a.attname as col_origen, af.attname as col_destino
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.contype = 'f' and array_length(c.conkey, 1) = 1
      and ((c.conrelid = $1::regclass and c.confrelid = $2::regclass) or (c.conrelid = $2::regclass and c.confrelid = $1::regclass))`,
  [`public.${base}`, `public.${embebida}`]));
  const fila = filas.rows[0];
  if (!fila) throw Object.assign(new Error(`Sin relación entre ${base} y ${embebida}`), { code: 'PGRST200' });
  return fila.origen.replace(/^public\./, '') === embebida
    ? { tipo: 'hijos', columnaHija: fila.col_origen, columnaPadre: fila.col_destino }
    : { tipo: 'padre', columnaHija: fila.col_origen, columnaPadre: fila.col_destino };
}

async function proyeccion(db: PGlite, tabla: string, alias: string, nodo: NodoSelect, profundidad = 0): Promise<string> {
  const pares: string[] = [];
  for (const columna of nodo.columnas) {
    if (columna === '*') throw Object.assign(new Error('Indicá las columnas explícitamente'), { code: '42501' });
    pares.push(`'${columna}', ${alias}.${identificador(columna)}`);
  }
  for (const { tabla: embebida, nodo: hijo } of nodo.embebidos) {
    const rel = await relacion(db, tabla, embebida);
    const aliasHijo = `e${profundidad + 1}`;
    const objeto = await proyeccion(db, embebida, aliasHijo, hijo, profundidad + 1);
    pares.push(rel.tipo === 'hijos'
      ? `'${embebida}', coalesce((select json_agg(${objeto}) from public.${identificador(embebida)} ${aliasHijo} where ${aliasHijo}.${identificador(rel.columnaHija)} = ${alias}.${identificador(rel.columnaPadre)}), '[]'::json)`
      : `'${embebida}', (select ${objeto} from public.${identificador(embebida)} ${aliasHijo} where ${aliasHijo}.${identificador(rel.columnaPadre)} = ${alias}.${identificador(rel.columnaHija)})`);
  }
  return `json_build_object(${pares.join(', ')})`;
}

const OPERADORES: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };

function filtros(parametros: URLSearchParams, alias: string, valores: unknown[]): string[] {
  const condiciones: string[] = [];
  for (const [clave, valor] of parametros) {
    if (['select', 'order', 'limit', 'offset'].includes(clave)) continue;
    const [operador, ...resto] = valor.split('.');
    const dato = resto.join('.');
    const columna = `${alias}.${identificador(clave)}`;
    if (operador === 'is') condiciones.push(`${columna} is ${dato === 'null' ? 'null' : dato === 'true' ? 'true' : 'false'}`);
    else if (operador === 'in') {
      const lista = dato.replace(/^\(|\)$/g, '').split(',');
      condiciones.push(`${columna} in (${lista.map((item) => { valores.push(item); return `$${valores.length}`; }).join(', ')})`);
    } else if (OPERADORES[operador]) {
      valores.push(operador.endsWith('like') ? dato.replace(/\*/g, '%') : dato);
      condiciones.push(`${columna}::text ${OPERADORES[operador]} $${valores.length}`);
    }
  }
  return condiciones;
}

async function tabla(db: PGlite, req: IncomingMessage, res: ServerResponse, nombre: string): Promise<void> {
  const identidad = identidadDe(req);
  const url = new URL(req.url ?? '', 'http://x');
  try {
    identificador(nombre);
    const valores: unknown[] = [];
    const condiciones = filtros(url.searchParams, 't', valores);
    const donde = condiciones.length ? `where ${condiciones.join(' and ')}` : '';
    if (req.method === 'PATCH') {
      const cambios = await leerJson(req);
      const asignaciones = Object.keys(cambios).map((columna) => {
        valores.push(cambios[columna]);
        return `${identificador(columna)} = $${valores.length}`;
      });
      await comoIdentidad(db, identidad, (tx) =>
        tx.query(`update public.${identificador(nombre)} t set ${asignaciones.join(', ')} ${donde}`, valores));
      responder(res, 204);
      return;
    }
    const nodo = parsearSelect(url.searchParams.get('select') ?? '');
    const objeto = await proyeccion(db, nombre, 't', nodo);
    const orden = (url.searchParams.get('order') ?? '').split(',').filter(Boolean).map((parte) => {
      const [columna, direccion = 'asc', nulos] = parte.split('.');
      return `t.${identificador(columna)} ${direccion === 'desc' ? 'desc' : 'asc'}${nulos === 'nullslast' ? ' nulls last' : nulos === 'nullsfirst' ? ' nulls first' : ''}`;
    });
    const limite = url.searchParams.get('limit');
    const sql = `select ${objeto} as fila from public.${identificador(nombre)} t ${donde}
      ${orden.length ? `order by ${orden.join(', ')}` : ''} ${limite ? `limit ${Number(limite)}` : ''}`;
    const filas = await comoIdentidad(db, identidad, (tx) => tx.query<{ fila: unknown }>(sql, valores));
    const datos = filas.rows.map((fila) => fila.fila);
    if (String(req.headers.accept ?? '').includes('vnd.pgrst.object')) {
      if (datos.length !== 1) {
        responder(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null });
        return;
      }
      responder(res, 200, JSON.stringify(datos[0]));
      return;
    }
    res.setHeader('Content-Range', `0-${Math.max(datos.length - 1, 0)}/*`);
    responder(res, 200, JSON.stringify(datos));
  } catch (error) {
    errorPostgrest(res, error, identidad);
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function usuarioPorEmail(db: PGlite, email: string): Promise<(FilaUsuario & { encrypted_password: string | null }) | null> {
  const filas = await enCola(() => db.query<FilaUsuario & { encrypted_password: string | null }>(
    `select id, email, raw_user_meta_data, email_confirmed_at, created_at, encrypted_password from auth.users where lower(email) = lower($1)`, [email]));
  return filas.rows[0] ?? null;
}

async function usuarioPorId(db: PGlite, id: string): Promise<FilaUsuario | null> {
  const filas = await enCola(() => db.query<FilaUsuario>(
    `select id, email, raw_user_meta_data, email_confirmed_at, created_at from auth.users where id = $1`, [id]));
  return filas.rows[0] ?? null;
}

function errorAuth(res: ServerResponse, estado: number, mensaje: string, codigo = 'validation_failed'): void {
  responder(res, estado, { code: estado, error_code: codigo, msg: mensaje, error: codigo, error_description: mensaje });
}

async function auth(db: PGlite, req: IncomingMessage, res: ServerResponse, ruta: string): Promise<void> {
  const url = new URL(req.url ?? '', 'http://x');
  if (ruta === 'signup' && req.method === 'POST') {
    const { email, password, data } = await leerJson(req) as { email?: string; password?: string; data?: Record<string, unknown> };
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errorAuth(res, 400, 'Unable to validate email address: invalid format'); return; }
    if (!password || password.length < 8) { errorAuth(res, 422, 'Password should be at least 8 characters.', 'weak_password'); return; }
    if (await usuarioPorEmail(db, email)) { errorAuth(res, 422, 'User already registered', 'user_already_exists'); return; }
    const id = await enCola(() => crearUsuarioLocal(db, {
      email, clave: password, nombre: String(data?.nombre_completo ?? ''), nivel: Number(data?.nivel_voley ?? 5),
      telefono: (data?.telefono as string | null) ?? null,
    }));
    responder(res, 200, crearSesion((await usuarioPorId(db, id))!));
    return;
  }
  if (ruta === 'token' && req.method === 'POST') {
    const tipo = url.searchParams.get('grant_type');
    const cuerpo = await leerJson(req) as { email?: string; password?: string; refresh_token?: string };
    if (tipo === 'password') {
      const usuario = await usuarioPorEmail(db, cuerpo.email ?? '');
      if (!usuario || !claveValida(cuerpo.password ?? '', usuario.encrypted_password)) {
        errorAuth(res, 400, 'Invalid login credentials', 'invalid_credentials');
        return;
      }
      responder(res, 200, crearSesion(usuario));
      return;
    }
    if (tipo === 'refresh_token') {
      const id = refreshTokens.get(cuerpo.refresh_token ?? '');
      const usuario = id ? await usuarioPorId(db, id) : null;
      if (!usuario) { errorAuth(res, 400, 'Invalid Refresh Token', 'refresh_token_not_found'); return; }
      refreshTokens.delete(cuerpo.refresh_token!);
      responder(res, 200, crearSesion(usuario));
      return;
    }
  }
  const identidad = identidadDe(req);
  if (ruta === 'user' && (req.method === 'GET' || req.method === 'PUT')) {
    if (!identidad.usuarioId) { errorAuth(res, 401, 'Invalid JWT', 'bad_jwt'); return; }
    if (req.method === 'PUT') {
      const { password, data } = await leerJson(req) as { password?: string; data?: Record<string, unknown> };
      if (password !== undefined && password.length < 8) { errorAuth(res, 422, 'Password should be at least 8 characters.', 'weak_password'); return; }
      await enCola(async () => {
        if (password) await db.query('update auth.users set encrypted_password = $2, updated_at = now() where id = $1', [identidad.usuarioId, hashClave(password)]);
        if (data) await db.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb where id = $1`, [identidad.usuarioId, JSON.stringify(data)]);
      });
    }
    const usuario = await usuarioPorId(db, identidad.usuarioId);
    if (!usuario) { errorAuth(res, 404, 'User not found', 'user_not_found'); return; }
    responder(res, 200, usuarioGoTrue(usuario));
    return;
  }
  if (ruta === 'logout') { responder(res, 204); return; }
  if (ruta === 'recover' && req.method === 'POST') {
    const { email } = await leerJson(req) as { email?: string };
    const usuario = email ? await usuarioPorEmail(db, email) : null;
    if (usuario) {
      const sesion = crearSesion(usuario);
      const destino = url.searchParams.get('redirect_to') ?? 'http://localhost:5173/perfil';
      console.log(`\n✉️  Enlace de recuperación para ${email}:\n${destino}#access_token=${sesion.access_token}&refresh_token=${sesion.refresh_token}&expires_in=${DURACION_SESION}&token_type=bearer&type=recovery\n`);
    }
    responder(res, 200, {});
    return;
  }
  if (ruta === 'settings') {
    responder(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });
    return;
  }
  errorAuth(res, 404, 'Ruta de Auth no soportada en el entorno local', 'not_found');
}

// ---------------------------------------------------------------------------
// Storage y funciones
// ---------------------------------------------------------------------------

async function storage(db: PGlite, req: IncomingMessage, res: ServerResponse, ruta: string): Promise<void> {
  const publico = /^object\/public\/([a-z0-9-]+)\/(.+)$/.exec(ruta);
  if (publico && req.method === 'GET') {
    const archivo = normalize(join(DIR_ARCHIVOS, publico[1], decodeURIComponent(publico[2])));
    if (!archivo.startsWith(DIR_ARCHIVOS) || !existsSync(archivo)) { responder(res, 404, { message: 'Not found' }); return; }
    const tipo = archivo.endsWith('.png') ? 'image/png' : archivo.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    responder(res, 200, readFileSync(archivo), tipo);
    return;
  }
  const subida = /^object\/([a-z0-9-]+)\/(.+)$/.exec(ruta);
  if (subida && req.method === 'POST') {
    const identidad = identidadDe(req);
    const [, bucket, nombre] = subida;
    const cuerpo = await leerCuerpo(req);
    let contenido = cuerpo;
    if (String(req.headers['content-type'] ?? '').startsWith('multipart/form-data')) {
      const formulario = await new Request('http://local/', {
        method: 'POST', headers: { 'content-type': String(req.headers['content-type']) }, body: cuerpo,
      }).formData();
      const archivo = [...formulario.values()].find((valor): valor is File => typeof valor !== 'string');
      contenido = archivo ? Buffer.from(await archivo.arrayBuffer()) : Buffer.alloc(0);
    }
    try {
      await comoIdentidad(db, identidad, (tx) =>
        tx.query('insert into storage.objects(bucket_id, name, owner) values ($1, $2, $3)', [bucket, decodeURIComponent(nombre), identidad.usuarioId]));
      const destino = normalize(join(DIR_ARCHIVOS, bucket, decodeURIComponent(nombre)));
      if (!destino.startsWith(DIR_ARCHIVOS)) throw Object.assign(new Error('Ruta inválida'), { code: '42501' });
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, contenido);
      responder(res, 200, { Key: `${bucket}/${nombre}`, Id: randomUUID() });
    } catch (error) {
      const { message = 'Error' } = error as ErrorPg;
      responder(res, 403, { statusCode: '403', error: 'Unauthorized', message: /row-level|permission/i.test(message) ? 'new row violates row-level security policy' : message });
    }
    return;
  }
  responder(res, 404, { message: 'Ruta de Storage no soportada en el entorno local' });
}

async function funcion(db: PGlite, req: IncomingMessage, res: ServerResponse, nombre: string): Promise<void> {
  if (nombre !== 'submit-club-lead') { responder(res, 404, { error: 'Función no disponible en el entorno local' }); return; }
  const cuerpo = await leerJson(req) as Record<string, string | number>;
  if (cuerpo.website) { responder(res, 200, { ok: true }); return; }
  try {
    await enCola(() => db.query(
      `insert into public.solicitudes_club(club_nombre, localidad, contacto_nombre, contacto, cantidad_canchas)
       values ($1, $2, $3, $4, $5)`,
      [cuerpo.club_nombre, cuerpo.localidad, cuerpo.contacto_nombre, cuerpo.contacto, Number(cuerpo.cantidad_canchas)]));
    responder(res, 200, { ok: true });
  } catch {
    responder(res, 400, { error: 'Revisá los datos ingresados' });
  }
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

export async function iniciar(opciones: { reiniciar?: boolean } = {}): Promise<void> {
  const db = await abrirBase(!!opciones.reiniciar);
  const servidor = createServer(async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') { responder(res, 204); return; }
    const ruta = new URL(req.url ?? '/', 'http://x').pathname;
    try {
      if (ruta.startsWith('/rest/v1/rpc/')) await rpc(db, req, res, ruta.slice('/rest/v1/rpc/'.length));
      else if (ruta.startsWith('/rest/v1/')) await tabla(db, req, res, ruta.slice('/rest/v1/'.length));
      else if (ruta.startsWith('/auth/v1/')) await auth(db, req, res, ruta.slice('/auth/v1/'.length));
      else if (ruta.startsWith('/storage/v1/')) await storage(db, req, res, ruta.slice('/storage/v1/'.length));
      else if (ruta.startsWith('/functions/v1/')) await funcion(db, req, res, ruta.slice('/functions/v1/'.length));
      else if (ruta === '/salud') responder(res, 200, { ok: true });
      else responder(res, 404, { message: 'No encontrado' });
    } catch (error) {
      console.error(error);
      if (!res.headersSent) responder(res, 500, { message: 'Error interno del entorno local' });
    }
  });
  await new Promise<void>((listo) => servidor.listen(PUERTO, listo));
  console.log(`\nSupabase local listo en http://localhost:${PUERTO}`);
  console.log(`Huella de la base: ${createHash('sha1').update(DIR_DATOS).digest('hex').slice(0, 8)} (${DIR_DATOS})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  iniciar({ reiniciar: process.argv.includes('--reset') }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
