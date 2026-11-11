import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import type { DatabaseConfig } from '../config/env.js';
import * as schema from './schema.js';

export const DB = Symbol('DB');

export function createDb(config: DatabaseConfig) {
  const client = createClient(config);
  return drizzle(client, { schema });
}
export type Db = ReturnType<typeof createDb>;

/** apps/api/drizzle, from both src/db and dist/db. */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}
