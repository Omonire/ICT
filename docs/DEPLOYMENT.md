# Deployment Guide

This guide covers deploying ExamFlow to production environments.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Build & Start](#build--start)
- [Docker Deployment](#docker-deployment)
- [Vercel (Frontend Only)](#vercel-frontend-only)
- [Railway](#railway)
- [Manual Server Deployment](#manual-server-deployment)
- [Nginx Reverse Proxy](#nginx-reverse-proxy)
- [SSL / HTTPS](#ssl--https)
- [Production Checklist](#production-checklist)

---

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Turso Cloud** (libSQL) — recommended for production

---

## Environment Configuration

### Backend (`backend/.env`)

```bash
PORT=4000
NODE_ENV=production

# Database — single connection URL
DATABASE_URL=libsql://your-db-name-your-org.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# Auth — use a strong, random secret (64+ chars)
JWT_SECRET=<generate-with-openssl-rand-base64-64>
JWT_EXPIRES_IN=7d
COOKIE_SECURE=true

# Disable auto-seeding in production
SEED_ON_STARTUP=false
```

### Frontend (`.env.local` or environment variable)

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

**Generate a JWT secret:**

```bash
# Linux/macOS
openssl rand -base64 64

# Windows PowerShell
-join ((1..64) | ForEach-Object { [char]((Get-Random -Minimum 33 -Maximum 126)) })
```

---

## Database Setup

### Turso Cloud (Recommended)

```bash
# Install the Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Sign in
turso auth login

# Create a database
turso db create examflow-db

# Get connection URL and auth token
turso db show examflow-db --url
turso db tokens create examflow-db
```

TypeORM will auto-create tables when `synchronize: true` is set (development mode). In production, the backend syncs schema on cold start (Vercel) or you can run migrations:

```bash
# If using TypeORM CLI
npx typeorm migration:run -d backend/src/config/data-source.ts
```

### Local libSQL file (Development)

No setup required. The database file is created at `backend/data/examflow.sqlite`. Ensure the `data/` directory is writable:

```bash
mkdir -p backend/data
chmod 755 backend/data
```

---

## Build & Start

> **Single-process mode (recommended):** `server.js` runs the Express API and the Next.js frontend in one process on one port (default 3000). Requests under `/api` are handled by Express; everything else is rendered by Next.js.

```bash
# Install dependencies
npm install

# Build backend (TypeScript → JavaScript) + frontend
npm run build

# Start the single production server (API + web on one port)
npm run start
```

The server binds to port 3000 (override with `PORT`). To run the API and web as two separate processes instead (API :4000, web :3000), use `npm run start:split`.

---

## Docker Deployment

### Dockerfile (Backend)

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci
COPY . .
RUN cd backend && npx tsc

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/backend/data ./data

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Dockerfile (Frontend)

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx next build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npx", "next", "start"]
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      PORT: 4000
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      TURSO_AUTH_TOKEN: ${TURSO_AUTH_TOKEN}
      JWT_SECRET: ${JWT_SECRET}
      COOKIE_SECURE: "true"
    ports:
      - "4000:4000"

  web:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    environment:
      NEXT_PUBLIC_API_URL: http://api:4000/api
    depends_on:
      - api
    ports:
      - "3000:3000"
```

```bash
# Start all services
docker-compose up -d

# Seed the database (run once)
docker-compose exec api node dist/index.js --seed
```

---

## Vercel

Vercel can host both the **backend API** (as a serverless function) and the **Next.js frontend**. Since a `vercel.json` at the repo root would override Next.js auto-detection, deploy each piece as a **separate Vercel project**.

### Vercel (Backend API)

The backend ships with a serverless-compatible entrypoint at `backend/src/app.ts` — it exports a default handler that lazy-initializes the database, syncs the schema (no migrations yet), seeds on cold start (idempotent), and hands the request to Express.

1. Push to GitHub
2. In the Vercel dashboard, **Add New Project** → import this repo
3. Set **Root Directory** to the repo root
4. In **Build and Output Settings** → **Function** (or "Functions"), add a function with source file:
   ```
   backend/src/app.ts
   ```
   If the dashboard does not expose this, set the **Entrypoint / Build Command** to:
   ```
   cd backend && npm run build
   ```
   and configure the **Serverless Function path** as `backend/dist/app.js`.
5. Set environment variables (see [Environment Configuration](#environment-configuration)):
   - `DATABASE_URL` = `libsql://your-db-your-org.turso.io` (a hosted Turso database — **required**; SQLite native bindings do not run reliably on serverless)
   - `TURSO_AUTH_TOKEN` = your Turso auth token
   - `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_SECURE=true`, `SEED_ON_STARTUP=false`
6. Deploy. The API is served from `/` of that project's URL (e.g. `https://examflow-api.vercel.app/api/health`).

> **Note:** Do **not** point Vercel at `backend/src/index.ts` — that entry calls `app.listen()` and is for the standalone server (`npm run start`). Serverless functions must use the `app.ts` default export.

### Vercel (Frontend Only)

Deploy the Next.js frontend to Vercel while the backend runs separately:

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Set environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://examflow-api.vercel.app/api`
4. Deploy

The Next.js config already includes API proxy rewrites for development. In production, point directly to your backend.

---

## Railway

Railway can host the full stack:

1. Create a new project on [railway.app](https://railway.app)
2. Create a Turso Cloud database and get the URL/token
3. Add the ExamFlow service (connect to GitHub repo)
4. Set environment variables (see [Environment Configuration](#environment-configuration))
5. Railway auto-deploys on push

---

## Manual Server Deployment

```bash
# On the server
git clone https://github.com/Omonire/ICT.git
cd ICT

# Install dependencies
npm install

# Configure environment
cp .env.example .env
cp backend/.env.example backend/.env
# Edit .env files with production values

# Build
npm run build

# Start with PM2 (single process on one port — API + web)
pm2 start server.js --name examflow
pm2 save
pm2 startup
```

The single-process server binds to one port (3000 by default), so one PM2 entry is all you need. Set `PORT=3000` in `.env` and configure Nginx to proxy that port.

---

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Single process serves both the frontend and the API on one port
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## SSL / HTTPS

Use Certbot with Nginx:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Ensure `COOKIE_SECURE=true` in the backend `.env` so JWT cookies are only sent over HTTPS.

---

## Production Checklist

- [ ] `NODE_ENV=production` set on both frontend and backend
- [ ] `JWT_SECRET` is a strong, random 64+ character string
- [ ] `COOKIE_SECURE=true` (requires HTTPS)
- [ ] `SEED_ON_STARTUP=false`
- [ ] `DATABASE_URL` points to a Turso Cloud `libsql://` URL with `TURSO_AUTH_TOKEN` set
- [ ] Backend is built (`tsc`) and running
- [ ] Frontend is built (`next build`) and running
- [ ] `NEXT_PUBLIC_API_URL` points to the production API
- [ ] Nginx/reverse proxy is configured
- [ ] SSL certificate is installed and auto-renewing
- [ ] Firewall allows ports 80, 443, and blocks 4000 (API should not be public)
- [ ] PM2 or systemd is managing processes
- [ ] Log rotation is configured
- [ ] Database backups are scheduled
