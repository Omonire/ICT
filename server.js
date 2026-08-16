// server.js — ExamFlow single-process production server.
//
// Runs the Express API (backend/dist/app.js) and the Next.js frontend on a
// single port: requests under /api are handled by Express, everything else is
// rendered by Next.js. One process, one port, one command:
//
//   npm run build
//   npm run start
//
// Uses the compiled backend build, so run `npm run build` first.

const path = require('path');
const fs = require('fs');
const express = require('express');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? '0.0.0.0';

const backendEntry = path.join(__dirname, 'backend/dist/app.js');
if (!fs.existsSync(backendEntry)) {
  console.error('[single] backend/dist is missing — run `npm run build` first.');
  process.exit(1);
}

async function main() {
  const { initApi } = require(backendEntry);
  const apiApp = await initApi();

  const nextApp = next({ dev, hostname, port });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const server = express();
  server.disable('x-powered-by');
  server.set('trust proxy', 1);

  server.use((req, res, next) => {
    if (req.path.startsWith('/api')) return apiApp(req, res);
    return next();
  });

  server.all('*', (req, res) => handle(req, res));

  server.listen(port, hostname, () => {
    console.log(`[single] ExamFlow running at http://localhost:${port} (dev=${dev})`);
  });
}

main().catch((err) => {
  console.error('[single] failed to start:', err);
  process.exit(1);
});
