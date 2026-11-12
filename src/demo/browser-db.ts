/**
 * Base de datos en el NAVEGADOR (modo demo sin servidor).
 *
 * Sustituye a `src/db/index.ts` en el build del frontend: es el mismo PostgreSQL (PGlite)
 * pero compilado a WebAssembly y guardado en IndexedDB del propio dispositivo.
 * Cada móvil / ordenador tiene su propia agenda temporal e independiente.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgliteQueryResultHKT } from 'drizzle-orm/pglite';
import * as schema from '../db/schema.ts';
import initSql from '../../drizzle/0000_init.sql?raw';

export const DEMO_DB_NAME = 'barberia-segorbe-demo';
const IDB_DATABASE = `/pglite/${DEMO_DB_NAME}`;

function openClient(): PGlite {
  try {
    return new PGlite(`idb://${DEMO_DB_NAME}`);
  } catch {
    // Navegación privada sin IndexedDB: base en memoria (se pierde al recargar)
    return new PGlite();
  }
}

export const client = openClient();

/**
 * Solo una pestaña puede usar la base a la vez: la última que se abre (o a la que se vuelve)
 * "roba" el candado. La pestaña que lo pierde cierra su copia y se recargará al volver a ella,
 * así nunca se pisan los datos entre pestañas.
 */
export const ownership = { lost: false, listeners: new Set<() => void>() };
try {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    navigator.locks
      .request('barberia-segorbe-db', { steal: true }, () => new Promise<void>(() => {}))
      .catch(() => {
        ownership.lost = true;
        client.close().catch(() => {});
        ownership.listeners.forEach((l) => l());
      });
  }
} catch {
  // sin Web Locks: modo una sola pestaña
}
export const db = drizzle(client, { schema });
export type DbExecutor = PgDatabase<PgliteQueryResultHKT, typeof schema>;
export const dbLocation = 'este navegador (IndexedDB)';

const MIGRATIONS: Array<{ id: string; sql: string }> = [{ id: '0000_init', sql: initSql }];

let migrated: Promise<void> | null = null;

export function runMigrations(): Promise<void> {
  if (!migrated) {
    migrated = (async () => {
      await client
        .exec('CREATE TABLE IF NOT EXISTS __demo_migrations (id text PRIMARY KEY, applied_at timestamptz DEFAULT now())')
        .catch(() => {
          // carrera con otra pestaña creando la tabla: ya existe
        });
      const done = await client.query<{ id: string }>('SELECT id FROM __demo_migrations');
      const applied = new Set(done.rows.map((r) => r.id));
      for (const m of MIGRATIONS) {
        if (applied.has(m.id)) continue;
        await client.transaction(async (tx) => {
          // Re-comprobación dentro de la transacción (otra pestaña pudo aplicarla ya)
          const again = await tx.query('SELECT 1 FROM __demo_migrations WHERE id = $1', [m.id]);
          if (again.rows.length > 0) return;
          for (const stmt of m.sql.split('--> statement-breakpoint')) {
            if (stmt.trim()) await tx.exec(stmt);
          }
          await tx.query('INSERT INTO __demo_migrations (id) VALUES ($1)', [m.id]);
        });
      }
    })().catch((e) => {
      migrated = null;
      throw e;
    });
  }
  return migrated;
}

/** Borra la base de datos local del dispositivo (para reiniciar la demo). */
export async function destroyDemoDatabase(): Promise<void> {
  try {
    await client.close();
  } catch {
    // ignore
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(IDB_DATABASE);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
