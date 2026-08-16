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
- **PostgreSQL** (recommended for production) or SQLite (demo/small deployments)

---

## Environment Configuration

### Backend (`backend/.env`)

```bash
PORT=4000
NODE_ENV=production

# Use PostgreSQL in production
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=examflow
DB_PASSWORD=<strong-password>
DB_NAME=examflow

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

### PostgreSQL

```sql
CREATE DATABASE examflow;
CREATE USER examflow WITH PASSWORD '<strong-password>';
GRANT ALL PRIVILEGES ON DATABASE examflow TO examflow;
```

TypeORM will auto-create tables when `synchronize: true` is set (development mode). For production, use migrations:

```bash
# If using TypeORM CLI
npx typeorm migration:run -d backend/src/config/data-source.ts
```

### SQLite

No setup required. The database file is created at `backend/data/examflow.sqlite`. Ensure the `data/` directory is writable:

```bash
mkdir -p backend/data
chmod 755 backend/data
```

---

## Build & Start

```bash
# Install dependencies
npm install

# Build backend (TypeScript → JavaScript)
cd backend && npx tsc && cd ..

# Build frontend
npx next build

# Start production servers
npm run start
```

This runs both the API (:4000) and the Next.js production server (:3000) via `concurrently`.

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
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: examflow
      POSTGRES_USER: examflow
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      PORT: 4000
      NODE_ENV: production
      DB_TYPE: postgres
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: examflow
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: examflow
      JWT_SECRET: ${JWT_SECRET}
      COOKIE_SECURE: "true"
    depends_on:
      - db
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

volumes:
  pgdata:
```

```bash
# Start all services
docker-compose up -d

# Seed the database (run once)
docker-compose exec api node dist/index.js --seed
```

---

## Vercel (Frontend Only)

Deploy the Next.js frontend to Vercel while the backend runs separately:

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Set environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com/api`
4. Deploy

The Next.js config already includes API proxy rewrites for development. In production, point directly to your backend.

---

## Railway

Railway can host the full stack:

1. Create a new project on [railway.app](https://railway.app)
2. Add a PostgreSQL service
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
cd backend && npx tsc && cd ..
npx next build

# Start with PM2 (recommended)
pm2 start backend/dist/index.js --name examflow-api
pm2 start "npx next start -p 3000" --name examflow-web
pm2 save
pm2 startup
```

---

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
- [ ] `DB_TYPE=postgres` with a strong database password
- [ ] PostgreSQL is running and accessible
- [ ] Backend is built (`tsc`) and running
- [ ] Frontend is built (`next build`) and running
- [ ] `NEXT_PUBLIC_API_URL` points to the production API
- [ ] Nginx/reverse proxy is configured
- [ ] SSL certificate is installed and auto-renewing
- [ ] Firewall allows ports 80, 443, and blocks 4000 (API should not be public)
- [ ] PM2 or systemd is managing processes
- [ ] Log rotation is configured
- [ ] Database backups are scheduled
