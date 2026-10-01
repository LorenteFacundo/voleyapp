import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { postgis } from '@electric-sql/pglite-postgis';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const SHIM_PATH = join(ROOT, 'tests', 'db', 'supabase-shim.sql');
const CACHE_DIR = join(ROOT, 'node_modules', '.cache', 'voleyapp-db');

const extensions = { btree_gist, pgcrypto, unaccent, postgis };

export type Actor =
  | { tipo: 'anon' }
  | { tipo: 'usuario'; id: string; email?: string }
  | { tipo: 'servicio' }
  | { tipo: 'postgres' };

export const ANON: Actor = { tipo: 'anon' };
export const SERVICIO: Actor = { tipo: 'servicio' };
export const POSTGRES: Actor = { tipo: 'postgres' };

export function listarMigraciones(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort();
}

type Rango = { desde?: string; hasta?: string };

/** Migration file names within an inclusive version range (prefix match). */
function migracionesEnRango({ desde, hasta }: Rango): string[] {
  return listarMigraciones().filter((name) => {
    const version = name.slice(0, 14);
    return (!desde || version >= desde) && (!hasta || version <= hasta);
  });
}

function huellaEsquema(rango: Rango): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(SHIM_PATH));
  for (const name of migracionesEnRango(rango)) {
    hash.update(name);
    hash.update(readFileSync(join(MIGRATIONS_DIR, name)));
  }
  return hash.digest('hex').slice(0, 16);
}

export async function aplicarMigraciones(db: PGlite, rango: Rango = {}): Promise<void> {
  for (const name of migracionesEnRango(rango)) {
    const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falló la migración ${name}: ${message}`);
    }
  }
}

/** Builds an empty Supabase-like database and applies the requested migrations. */
export async function construirBase(rango: Rango = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions });
  await db.exec(readFileSync(SHIM_PATH, 'utf8'));
  await aplicarMigraciones(db, rango);
  return db;
}

/**
 * Returns a fresh database migrated up to `hasta` (default: every migration).
 * The migrated data directory is cached on disk and invalidated whenever one
 * of the involved migrations changes.
 */
export async function crearBaseDePruebas(opciones: { hasta?: string } = {}): Promise<PGlite> {
  const rango = { hasta: opciones.hasta };
  const cachePath = join(CACHE_DIR, `${huellaEsquema(rango)}.tar.gz`);
  if (existsSync(cachePath)) {
    const loadDataDir = new Blob([readFileSync(cachePath)]);
    const db = await PGlite.create({ extensions, loadDataDir });
    await db.exec(`set timezone to 'UTC'`);
    return db;
  }
  const db = await construirBase(rango);
  const dump = await db.dumpDataDir('gzip');
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, Buffer.from(await dump.arrayBuffer()));
  return db;
}

async function prepararActor(tx: Transaction, actor: Actor): Promise<void> {
  if (actor.tipo === 'postgres') return;
  const role = actor.tipo === 'anon' ? 'anon' : actor.tipo === 'servicio' ? 'service_role' : 'authenticated';
  const claims = actor.tipo === 'usuario'
    ? { sub: actor.id, role, email: actor.email ?? null }
    : { role };
  await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
  await tx.exec(`set local role ${role}`);
}

/** Runs one statement as the given actor inside its own transaction. */
export async function como<T = Record<string, unknown>>(
  db: PGlite, actor: Actor, sql: string, params: unknown[] = [],
): Promise<T[]> {
  return db.transaction(async (tx) => {
    await prepararActor(tx, actor);
    const result = await tx.query<T>(sql, params);
    return result.rows;
  });
}

function serializar(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return `{${value.map((item) => String(item)).join(',')}}`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

/**
 * Calls a function the way PostgREST does (named arguments) and returns every
 * row of the result. Scalar and json results come back as a one-item array.
 */
export async function rpcFilas<T = unknown>(
  db: PGlite, actor: Actor, fn: string, args: Record<string, unknown> = {},
): Promise<T[]> {
  const names = Object.keys(args);
  const placeholders = names.map((name, index) => `${name} => $${index + 1}`).join(', ');
  const rows = await como<{ resultado: T }>(
    db, actor, `select public.${fn}(${placeholders}) as resultado`, names.map((name) => serializar(args[name])),
  );
  return rows.map((row) => row.resultado);
}

export async function rpc<T = unknown>(
  db: PGlite, actor: Actor, fn: string, args: Record<string, unknown> = {},
): Promise<T> {
  const rows = await rpcFilas<T>(db, actor, fn, args);
  return rows[0] as T;
}

export async function crearUsuario(
  db: PGlite,
  datos: { nombre?: string; email?: string; rol?: string; nivel?: number; confirmado?: boolean } = {},
): Promise<Actor & { tipo: 'usuario' }> {
  const id = randomUUID();
  const email = datos.email ?? `${id.slice(0, 8)}@prueba.test`;
  await db.query(
    `insert into auth.users(id, email, raw_user_meta_data, email_confirmed_at)
     values ($1, $2, $3, case when $4 then now() end)`,
    [id, email, JSON.stringify({ nombre_completo: datos.nombre ?? 'Jugador de prueba', nivel_voley: datos.nivel ?? 5 }),
      datos.confirmado ?? true],
  );
  if (datos.rol) await db.query(`update public.usuarios set rol = $2 where id = $1`, [id, datos.rol]);
  return { tipo: 'usuario', id, email };
}

/** Raw query as the database owner, for arranging fixtures and asserting state. */
export async function sql<T = Record<string, unknown>>(db: PGlite, text: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query<T>(text, params);
  return result.rows;
}
