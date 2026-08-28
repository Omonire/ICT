import 'reflect-metadata';
import { createApp } from './app';
import { env } from './config/env';
import { AppDataSource } from './config/data-source';
import { runSeed } from './services/seeding';
import { initWebSocket } from './services/websocket';

async function bootstrap(): Promise<void> {
  const started = Date.now();
  await AppDataSource.initialize();
  console.log(`[db] connected (${env.dbType}) in ${Date.now() - started}ms`);

  if (env.seedOnStartup) {
    const result = await runSeed();
    console.log(`[seed] ${result.message}`);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] ExamFlow API listening on http://localhost:${env.port}`);
  });
  initWebSocket(server);
  console.log(`[ws] WebSocket server ready`);
}

bootstrap().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
