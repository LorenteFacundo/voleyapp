import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { crearBaseDePruebas, sql } from './harness';

// Contrato entre el frontend y la base: cada RPC, tabla y bucket que usa el
// código de src/ tiene que existir en la base migrada, con los mismos nombres
// de parámetros (PostgREST los resuelve por nombre) y permisos para el rol que
// la llama. Un renombre en cualquiera de los dos lados rompe esta prueba.

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');

type LlamadaRpc = { archivo: string; funcion: string | null; argumentos: string[] | null };
type AccesoTabla = { archivo: string; tabla: string; metodo: string; seleccion: string | null };
type UsoBucket = { archivo: string; bucket: string };
type Seleccion = { tabla: string; columnas: string[]; embebidos: Seleccion[] };

function archivosFuente(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosFuente(ruta);
    return /\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name) ? [ruta] : [];
  });
}

/** Evalúa expresiones de texto armadas con literales, constantes, `+` y plantillas. */
function evaluarTexto(nodo: ts.Expression, constantes: Map<string, string>): string | null {
  if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) return nodo.text;
  if (ts.isParenthesizedExpression(nodo)) return evaluarTexto(nodo.expression, constantes);
  if (ts.isIdentifier(nodo)) return constantes.get(nodo.text) ?? null;
  if (ts.isBinaryExpression(nodo) && nodo.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const izquierda = evaluarTexto(nodo.left, constantes);
    const derecha = evaluarTexto(nodo.right, constantes);
    return izquierda !== null && derecha !== null ? izquierda + derecha : null;
  }
  if (ts.isTemplateExpression(nodo)) {
    let texto = nodo.head.text;
    for (const tramo of nodo.templateSpans) {
      const valor = evaluarTexto(tramo.expression, constantes);
      if (valor === null) return null;
      texto += valor + tramo.literal.text;
    }
    return texto;
  }
  return null;
}

/** Nombres de las propiedades de un objeto literal; null si no se pueden conocer. */
function clavesDeObjeto(nodo: ts.Expression | undefined): string[] | null {
  if (!nodo) return [];
  if (!ts.isObjectLiteralExpression(nodo)) return null;
  const claves: string[] = [];
  for (const propiedad of nodo.properties) {
    if (!ts.isPropertyAssignment(propiedad) && !ts.isShorthandPropertyAssignment(propiedad)) return null;
    if (!ts.isIdentifier(propiedad.name) && !ts.isStringLiteral(propiedad.name)) return null;
    claves.push(propiedad.name.text);
  }
  return claves;
}

function esIdentificador(nodo: ts.Expression, nombre: string): boolean {
  return ts.isIdentifier(nodo) && nodo.text === nombre;
}

function analizarFuente() {
  const rpcs: LlamadaRpc[] = [];
  const tablas: AccesoTabla[] = [];
  const buckets: UsoBucket[] = [];

  for (const ruta of archivosFuente(SRC)) {
    const archivo = relative(ROOT, ruta).replace(/\\/g, '/');
    const fuente = ts.createSourceFile(ruta, readFileSync(ruta, 'utf8'), ts.ScriptTarget.Latest, true,
      ruta.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const constantes = new Map<string, string>();

    const visitar = (nodo: ts.Node): void => {
      if (ts.isVariableDeclaration(nodo) && ts.isIdentifier(nodo.name) && nodo.initializer) {
        const valor = evaluarTexto(nodo.initializer, constantes);
        if (valor !== null) constantes.set(nodo.name.text, valor);
      }
      if (ts.isCallExpression(nodo)) {
        const llamado = nodo.expression;
        const [primero, segundo] = nodo.arguments;
        const esRpcPropia = ts.isIdentifier(llamado) && (llamado.text === 'rpc' || llamado.text === 'rpcLista');
        const esRpcCliente = ts.isPropertyAccessExpression(llamado) && llamado.name.text === 'rpc'
          && esIdentificador(llamado.expression, 'supabase');
        if (esRpcPropia || esRpcCliente) {
          rpcs.push({
            archivo,
            funcion: primero ? evaluarTexto(primero, constantes) : null,
            argumentos: clavesDeObjeto(segundo),
          });
        }
        if (ts.isPropertyAccessExpression(llamado) && llamado.name.text === 'from' && primero) {
          const nombre = evaluarTexto(primero, constantes);
          const esStorage = ts.isPropertyAccessExpression(llamado.expression) && llamado.expression.name.text === 'storage';
          if (esStorage && nombre) buckets.push({ archivo, bucket: nombre });
          if (esIdentificador(llamado.expression, 'supabase') && nombre) {
            const acceso = nodo.parent;
            const metodo = ts.isPropertyAccessExpression(acceso) ? acceso.name.text : '?';
            const llamadaMetodo = ts.isPropertyAccessExpression(acceso) && ts.isCallExpression(acceso.parent)
              ? acceso.parent : null;
            const argumento = llamadaMetodo?.arguments[0];
            tablas.push({
              archivo,
              tabla: nombre,
              metodo,
              seleccion: metodo === 'select' ? (argumento ? evaluarTexto(argumento, constantes) : '*') : null,
            });
          }
        }
      }
      ts.forEachChild(nodo, visitar);
    };
    visitar(fuente);
  }
  return { rpcs, tablas, buckets };
}

function partirNivelSuperior(texto: string): string[] {
  const partes: string[] = [];
  let profundidad = 0;
  let actual = '';
  for (const caracter of texto) {
    if (caracter === '(') profundidad += 1;
    if (caracter === ')') profundidad -= 1;
    if (caracter === ',' && profundidad === 0) {
      partes.push(actual);
      actual = '';
      continue;
    }
    actual += caracter;
  }
  if (actual) partes.push(actual);
  return partes;
}

/** Interpreta un select de PostgREST: columnas (con alias o cast) y tablas embebidas. */
function parsearSeleccion(tabla: string, texto: string): Seleccion {
  const seleccion: Seleccion = { tabla, columnas: [], embebidos: [] };
  for (const parte of partirNivelSuperior(texto.replace(/\s+/g, ''))) {
    const abre = parte.indexOf('(');
    if (abre >= 0) {
      const nombre = parte.slice(0, abre).split('!')[0].split(':').pop() ?? '';
      seleccion.embebidos.push(parsearSeleccion(nombre, parte.slice(abre + 1, -1)));
    } else if (parte !== '*') {
      seleccion.columnas.push(parte.split('::')[0].split(':').pop() ?? '');
    }
  }
  return seleccion;
}

function aplanar(seleccion: Seleccion, padre: string | null = null): Array<Seleccion & { padre: string | null }> {
  return [{ ...seleccion, padre }, ...seleccion.embebidos.flatMap((hijo) => aplanar(hijo, seleccion.tabla))];
}

// Lo que se lee en publico.ts también lo leen visitantes sin sesión.
function rolesQueLeen(archivo: string): string[] {
  return archivo === 'src/api/publico.ts' ? ['anon', 'authenticated'] : ['authenticated'];
}

const PRIVILEGIO_POR_METODO: Record<string, string> = {
  insert: 'INSERT', upsert: 'INSERT', update: 'UPDATE', delete: 'DELETE',
};

describe('contrato entre el frontend y la base', () => {
  const { rpcs, tablas, buckets } = analizarFuente();
  let db: PGlite;

  beforeAll(async () => {
    db = await crearBaseDePruebas();
  });

  it('encuentra las llamadas del frontend', () => {
    expect(rpcs.filter((llamada) => llamada.funcion).length).toBeGreaterThan(50);
    expect(tablas.length).toBeGreaterThan(0);
  });

  it('solo src/api habla con la base', () => {
    const fuera = [...rpcs, ...tablas, ...buckets]
      .map((uso) => uso.archivo)
      .filter((archivo) => !archivo.startsWith('src/api/'));
    expect([...new Set(fuera)]).toEqual([]);
    // El único nombre de RPC no literal es el del envoltorio genérico.
    const dinamicas = rpcs.filter((llamada) => !llamada.funcion).map((llamada) => llamada.archivo);
    expect([...new Set(dinamicas)]).toEqual(['src/api/cliente.ts']);
  });

  it('cada RPC existe, sin sobrecargas, con los parámetros que se le pasan y ejecutable con sesión', async () => {
    const problemas: string[] = [];
    for (const llamada of rpcs) {
      if (!llamada.funcion) continue;
      const filas = await sql<{
        nombres: string[] | null; modos: string[] | null; total: number; con_defecto: number; ejecutable: boolean;
      }>(db, `
        select p.proargnames as nombres, p.proargmodes::text[] as modos, p.pronargs as total,
               p.pronargdefaults as con_defecto, has_function_privilege('authenticated', p.oid, 'execute') as ejecutable
        from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1`, [llamada.funcion]);
      const donde = `${llamada.funcion} (${llamada.archivo})`;
      if (filas.length !== 1) {
        problemas.push(`${donde}: ${filas.length === 0 ? 'no existe' : `${filas.length} sobrecargas`}`);
        continue;
      }
      const [funcion] = filas;
      if (!funcion.ejecutable) problemas.push(`${donde}: authenticated no la puede ejecutar`);
      const nombres = funcion.nombres ?? [];
      const entradas = funcion.modos
        ? nombres.filter((_, indice) => ['i', 'b', 'v'].includes(funcion.modos?.[indice] ?? 'i'))
        : nombres.slice(0, funcion.total);
      const obligatorios = entradas.slice(0, funcion.total - funcion.con_defecto);
      if (!llamada.argumentos) continue;
      for (const clave of llamada.argumentos) {
        if (!entradas.includes(clave)) problemas.push(`${donde}: no tiene el parámetro ${clave}`);
      }
      for (const nombre of obligatorios) {
        if (!llamada.argumentos.includes(nombre)) problemas.push(`${donde}: falta el parámetro obligatorio ${nombre}`);
      }
    }
    expect(problemas).toEqual([]);
  });

  it('cada lectura de tabla pide columnas visibles para quien la hace y relaciones que existen', async () => {
    const problemas: string[] = [];
    for (const acceso of tablas.filter((uso) => uso.metodo === 'select')) {
      expect(acceso.seleccion, `select sin columnas conocidas en ${acceso.archivo}`).not.toBeNull();
      for (const parte of aplanar(parsearSeleccion(acceso.tabla, acceso.seleccion ?? '*'))) {
        const donde = `${parte.tabla} (${acceso.archivo})`;
        const [existe] = await sql<{ ok: boolean }>(db, `select to_regclass($1) is not null as ok`, [`public.${parte.tabla}`]);
        if (!existe.ok) {
          problemas.push(`${donde}: la tabla no existe`);
          continue;
        }
        if (parte.padre) {
          const [relacion] = await sql<{ ok: boolean }>(db, `
            select exists (
              select 1 from pg_constraint c where c.contype = 'f'
                and ((c.conrelid = $1::regclass and c.confrelid = $2::regclass)
                  or (c.conrelid = $2::regclass and c.confrelid = $1::regclass))
            ) as ok`, [`public.${parte.padre}`, `public.${parte.tabla}`]);
          if (!relacion.ok) problemas.push(`${donde}: no tiene clave foránea con ${parte.padre}`);
        }
        for (const rol of rolesQueLeen(acceso.archivo)) {
          for (const columna of parte.columnas) {
            const [permiso] = await sql<{ ok: boolean | null }>(db, `
              select case when exists (
                select 1 from pg_attribute where attrelid = $2::regclass and attname = $3 and not attisdropped
              ) then has_column_privilege($1, $2::regclass, $3, 'select') end as ok`,
            [rol, `public.${parte.tabla}`, columna]);
            if (permiso.ok === null) problemas.push(`${donde}: no existe la columna ${columna}`);
            else if (!permiso.ok) problemas.push(`${donde}: ${rol} no puede leer ${columna}`);
          }
        }
      }
    }
    expect(problemas).toEqual([]);
  });

  it('cada escritura directa tiene el permiso que necesita', async () => {
    const problemas: string[] = [];
    for (const acceso of tablas.filter((uso) => uso.metodo !== 'select')) {
      const privilegio = PRIVILEGIO_POR_METODO[acceso.metodo];
      if (!privilegio) {
        problemas.push(`${acceso.tabla} (${acceso.archivo}): método desconocido ${acceso.metodo}`);
        continue;
      }
      const [permiso] = await sql<{ ok: boolean }>(db,
        privilegio === 'DELETE'
          ? `select has_table_privilege('authenticated', $1::regclass, 'delete') as ok`
          : `select has_any_column_privilege('authenticated', $1::regclass, $2) as ok`,
        privilegio === 'DELETE' ? [`public.${acceso.tabla}`] : [`public.${acceso.tabla}`, privilegio]);
      if (!permiso.ok) problemas.push(`${acceso.tabla} (${acceso.archivo}): authenticated no tiene ${privilegio}`);
    }
    expect(problemas).toEqual([]);
  });

  it('los buckets de Storage existen', async () => {
    for (const uso of buckets) {
      const filas = await sql(db, `select 1 from storage.buckets where id = $1`, [uso.bucket]);
      expect(filas, `bucket ${uso.bucket} (${uso.archivo})`).toHaveLength(1);
    }
  });
});
