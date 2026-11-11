// Applies database migrations. Runs in the deploy build and from `pnpm db:migrate`.
import { loadDatabaseConfig } from '../config/env.js';
import { createDb, runMigrations } from '../db/client.js';

const config = loadDatabaseConfig();
const target = config.url.startsWith('file:') ? config.url : new URL(config.url).host;
await runMigrations(createDb(config));
console.log(`Migrations applied to ${target}`);
