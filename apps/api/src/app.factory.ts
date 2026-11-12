import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { LlmProvider } from './ai/llm.js';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/env.js';
import { createDb, type Db, runMigrations } from './db/client.js';
import { API_HEADERS, WEB_HEADERS } from './security/headers.js';

function setHeaders(headers: Record<string, string>) {
  return (_req: Request, res: Response, next: NextFunction) => {
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    next();
  };
}

/**
 * Serves the built web app from the API, for people running the project on their own PC.
 * On Vercel the web app is static and this is not used.
 */
function mountWeb(app: NestExpressApplication, dir: string): void {
  const root = resolve(dir);
  const index = join(root, 'index.html');
  if (!existsSync(index)) throw new Error(`SERVE_WEB_DIR has no index.html: ${root}`);

  app.use(setHeaders(WEB_HEADERS));
  app.use(express.static(root, { index: false, maxAge: '1h' }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(index);
  });
}

export async function createApp(
  config: AppConfig,
  db: Db = createDb(config.database),
  llm?: LlmProvider | null,
) {
  if (config.migrateOnBoot) await runMigrations(db);

  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config, db, llm), {
    // Production logs only problems, not the route map printed on every cold start.
    logger:
      config.env === 'test'
        ? false
        : config.env === 'production'
          ? ['warn', 'error']
          : ['log', 'warn', 'error'],
  });

  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  app.use('/api', setHeaders({ ...API_HEADERS, 'Cache-Control': 'no-store' }));
  app.use(cookieParser());
  app.enableCors({ origin: [...config.allowedOrigins], credentials: true });
  app.setGlobalPrefix('api');
  if (config.serveWebDir) mountWeb(app, config.serveWebDir);

  await app.init();
  return app;
}
