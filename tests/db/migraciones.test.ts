import { describe, expect, it } from 'vitest';
import { construirBase, sql } from './harness';

describe('migraciones', () => {
  it('reconstruyen la base completa desde cero', async () => {
    const db = await construirBase();
    const [{ total }] = await sql<{ total: number }>(db,
      `select count(*)::int as total from pg_tables where schemaname = 'public'`);
    expect(total).toBeGreaterThan(5);
  });
});
