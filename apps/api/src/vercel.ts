// Vercel Function entry point (see /api/index.js). The Nest app is built once per instance.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.factory.js';
import { loadConfig } from './config/env.js';

type Listener = (req: IncomingMessage, res: ServerResponse) => void;

let listener: Promise<Listener> | undefined;

async function build(): Promise<Listener> {
  const app = await createApp(loadConfig());
  return app.getHttpAdapter().getInstance() as Listener;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  listener ??= build();
  try {
    (await listener)(req, res);
  } catch (error) {
    // Fail closed: a misconfigured instance answers nothing useful and retries on the next request.
    listener = undefined;
    console.error(error instanceof Error ? error.message : error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Service unavailable');
  }
}
