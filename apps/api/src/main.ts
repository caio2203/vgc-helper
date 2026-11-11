// Local entry point: `pnpm dev` / `pnpm start`. Vercel uses vercel.ts instead.
import { Logger } from '@nestjs/common';
import { createApp } from './app.factory.js';
import { ConfigError, loadConfig } from './config/env.js';

try {
  const config = loadConfig();
  const app = await createApp(config);
  app.enableShutdownHooks();
  await app.listen(config.port);
  Logger.log(`API listening on http://localhost:${config.port}/api`, 'Bootstrap');
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    console.error('See .env.example and docs/setup.md.');
    process.exit(1);
  }
  throw error;
}
