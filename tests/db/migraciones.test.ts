import { describe, expect, it } from 'vitest';
import { construirBase, listarMigraciones, sql } from './harness';

describe('migraciones', () => {
  it('reconstruyen la base completa desde cero, en orden y sin errores', async () => {
    const db = await construirBase();
    const tablas = await sql<{ tabla: string }>(db,
      `select tablename as tabla from pg_tables where schemaname = 'public' order by 1`);
    expect(tablas.map((fila) => fila.tabla)).toEqual(expect.arrayContaining([
      'clubes', 'canchas', 'horarios_semanales', 'ocupaciones', 'series', 'pagos', 'clientes_club',
      'club_miembros', 'partidos', 'participantes_partido', 'notificaciones', 'auditoria',
    ]));
  }, 300_000);

  it('cada archivo tiene una versión única y ordenable', () => {
    const versiones = listarMigraciones().map((nombre) => nombre.slice(0, 14));
    expect(versiones.every((version) => /^\d{14}$/.test(version))).toBe(true);
    expect(new Set(versiones).size).toBe(versiones.length);
  });
});
