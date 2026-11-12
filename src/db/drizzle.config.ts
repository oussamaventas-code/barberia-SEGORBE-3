import { defineConfig } from 'drizzle-kit';

// Base de datos local de demostración (PGlite = PostgreSQL embebido en un fichero local).
// `npm run db:generate` crea las migraciones SQL en ./drizzle a partir de schema.ts.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  driver: 'pglite',
  dbCredentials: { url: './.data/pglite' },
});
