import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PgliteQueryResultHKT } from 'drizzle-orm/pglite';
import * as schema from './schema.ts';

/**
 * Base de datos LOCAL de demostración.
 *
 * Usa PGlite: un PostgreSQL real compilado a WebAssembly que se ejecuta dentro del
 * propio proceso de Node y guarda los datos en una carpeta local (por defecto `.data/pglite`).
 * No necesita instalar ni arrancar ningún servidor de base de datos.
 *
 * - `DB_DIR=memory` → base de datos en memoria (se borra al reiniciar).
 * - `npm run db:reset` → borra la carpeta y se recrea con datos demo al arrancar.
 *
 * Como el esquema es PostgreSQL estándar (Drizzle), migrar más adelante a un Postgres
 * gestionado o a otra plataforma solo requiere cambiar este fichero.
 */
const dbDir = process.env.DB_DIR || path.resolve(process.cwd(), '.data/pglite');
const inMemory = dbDir === 'memory';

declare global {
  var _pglite: PGlite | undefined;
}

if (!inMemory) fs.mkdirSync(dbDir, { recursive: true });

export const client = global._pglite ?? new PGlite(inMemory ? undefined : dbDir);
global._pglite = client;

export const db = drizzle(client, { schema });

/** Tipo común a `db` y a una transacción `tx`: permite reutilizar consultas dentro de transacciones. */
export type DbExecutor = PgDatabase<PgliteQueryResultHKT, typeof schema>;

let migrated: Promise<void> | null = null;

/** Aplica las migraciones SQL de ./drizzle (idempotente). */
export function runMigrations(): Promise<void> {
  if (!migrated) {
    migrated = migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  }
  return migrated;
}

export const dbLocation = inMemory ? 'memoria (volátil)' : dbDir;
