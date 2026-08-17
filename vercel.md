# Deploying ExamFlow to Vercel

This guide walks you through hosting ExamFlow on Vercel, step by step. Vercel is a **serverless** platform, so the app is split into two Vercel projects:

1. **Backend** — the Express API deployed as a serverless function (`backend/src/app.ts`)
2. **Frontend** — the Next.js app deployed as a regular Vercel project

> **Important:** `server.js` (the single-process VPS server) will **not** work on Vercel. Serverless functions cannot run `app.listen()`. Vercel requires the backend's serverless entrypoint at `backend/src/app.ts`, which exports a default handler.

---

## Table of Contents

1. [How It Works](#1-how-it-works)
2. [Prerequisites](#2-prerequisites)
3. [Create the Database](#3-create-the-database)
4. [Deploy the Backend API](#4-deploy-the-backend-api)
5. [Deploy the Frontend](#5-deploy-the-frontend)
6. [Connect the Frontend to the Backend](#6-connect-the-frontend-to-the-backend)
7. [Verify Everything Works](#7-verify-everything-works)
8. [Environment Variables Reference](#8-environment-variables-reference)
9. [Redeploying After Changes](#9-redeploying-after-changes)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. How It Works

```
Browser
   │
   ▼
┌─────────────────────────────────────────────┐
│  Frontend (Next.js)                         │
│  https://examflow-frontend.vercel.app       │
│  calls your API via NEXT_PUBLIC_API_URL     │
└──────────────────┬──────────────────────────┘
                   │ HTTPS (cookies + JSON)
                   ▼
┌─────────────────────────────────────────────┐
│  Backend (Express serverless function)      │
│  https://examflow-api.vercel.app            │
│  backend/src/app.ts → default handler       │
│  ├─ inits Turso libSQL (DATABASE_URL)       │
│  ├─ syncs schema on cold start              │
│  └─ serves /api/*                           │
└──────────────────┬──────────────────────────┘
                   ▼
           Turso Cloud (libSQL)
```

**Why two projects?** Vercel only supports one framework per project. Next.js and Express are different runtimes, so they each get their own Vercel project.

---

## 2. Prerequisites

Before you start, make sure you have:

- [ ] A **GitHub account** and the ExamFlow repo (`Omonire/ICT`) pushed to GitHub
- [ ] A **Vercel account** (free tier is enough) at [vercel.com](https://vercel.com)
- [ ] A **Turso Cloud database** (see step 3)
- [ ] The repo cloned locally (for reference / troubleshooting)

---

## 3. Create the Database

Serverless environments can't run the SQLite file database reliably (native bindings). You need a hosted database. [Turso Cloud](https://turso.tech) (libSQL) is the primary option.

### Create a Turso database

1. Install the Turso CLI:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
2. Sign in: `turso auth login`
3. Create a database:
   ```bash
   turso db create examflow-db
   ```
4. Get the connection URL:
   ```bash
   turso db show examflow-db --url
   # → libsql://examflow-db-<your-org>.turso.io
   ```
5. Create an auth token:
   ```bash
   turso db tokens create examflow-db
   # → <your-auth-token>
   ```

> Save both values — you'll paste them into Vercel as `DATABASE_URL` and `TURSO_AUTH_TOKEN` in step 4. The backend creates the tables automatically on cold start (schema sync), so no manual schema setup is needed.

---

## 4. Deploy the Backend API

### 4.1 Create the project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Add New → Project**
3. Select **Import** next to the `Omonire/ICT` repository
4. Click **Import** again

### 4.2 Configure the project

In the **Configure Project** screen:

| Setting              | Value                                     |
| -------------------- | ----------------------------------------- |
| **Project Name**     | `examflow-api`                            |
| **Framework Preset** | **Other** (do NOT pick Next.js — this is the backend) |
| **Root Directory**   | *(leave at repo root — do not change)*    |
| **Build Command**    | *(leave empty)*                           |
| **Output Directory** | *(leave empty)*                           |

> The backend is TypeScript. Vercel's Node.js builder compiles `backend/src/app.ts` on the fly — no build step needed.

### 4.3 Add the serverless function

This is the key step that makes the API work:

1. Click **Settings** (top of the project page)
2. Go to **Functions** (under the "Project" menu)
3. Click **Add Function**
4. Set the **Source File** to:
   ```
   backend/src/app.ts
   ```
5. Click **Save**

If your plan allows, set **Max Duration** to `30` seconds (cold starts with DB sync can take a few seconds).

> `backend/src/app.ts` exports a default handler. It initializes the database, syncs the schema, seeds on cold start, and hands each request to the Express app. This is exactly why the earlier `Invalid export found in module` error happened — the file previously had no default export.

### 4.4 Set environment variables

While in **Settings**, go to **Environment Variables** and add:

| Name                 | Value                                              | Environments      |
| -------------------- | -------------------------------------------------- | ----------------- |
| `DATABASE_URL`       | Your Turso `libsql://` URL from step 3             | Production (and Preview if you want) |
| `TURSO_AUTH_TOKEN`   | Your Turso auth token from step 3                  | Production (and Preview if you want) |
| `JWT_SECRET`         | A long random string (see below)                   | Production        |
| `JWT_EXPIRES_IN`     | `7d`                                               | Production        |
| `COOKIE_SECURE`      | `true`                                             | Production        |
| `SEED_ON_STARTUP`    | `true` for the first deploy (seeds demo data), then `false` | Production |

**Generate a JWT secret:**

```bash
openssl rand -base64 64
```

> **First deploy:** leave `SEED_ON_STARTUP=true`. The first cold start will create the tables and seed 520 candidates, 5 halls, 12 sessions, and the 3 demo accounts. After confirming the seed worked, set it to `false`.

### 4.5 Deploy

1. Click **Deploy**
2. Wait for the build to finish (usually 1–3 minutes)
3. When done, Vercel shows your URL, e.g. `https://examflow-api.vercel.app`

### 4.6 Test the backend

```bash
# Health check
curl https://examflow-api.vercel.app/api/health
# → {"status":"ok","service":"examflow-api","time":"..."}

# Login
curl -X POST https://examflow-api.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@examflow.edu.ng","password":"Admin123!"}'
# → {"user":{"email":"admin@examflow.edu.ng","role":"admin",...}}
```

If both work, the backend is live. Note the URL — you'll need it in step 5.

---

## 5. Deploy the Frontend

### 5.1 Create the project

1. Go to [vercel.com/new](https://vercel.com/new)
2. **Add New → Project → Import** the `Omonire/ICT` repo again
3. In **Configure Project**:

| Setting              | Value                                    |
| -------------------- | ---------------------------------------- |
| **Project Name**     | `examflow` (or `examflow-frontend`)      |
| **Framework Preset** | **Next.js** (Vercel auto-detects this)   |
| **Root Directory**   | *(repo root)*                            |
| **Build Command**    | `npm run build --workspace backend && next build` *(optional — see note)* |

> **Note on build command:** The backend must be compiled before `next build` because Next.js type-checks imported modules that reference `backend/`. Vercel's auto-detected build command runs `next build` only — if you hit type errors during the frontend build, set the build command explicitly to the one above.

### 5.2 Set environment variables

| Name                   | Value                                  |
| ---------------------- | -------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | `https://examflow-api.vercel.app/api`  |

### 5.3 Deploy

1. Click **Deploy**
2. Wait for the build to finish (2–4 minutes)
3. Vercel gives you `https://examflow.vercel.app` (or your custom domain)

---

## 6. Connect the Frontend to the Backend

By default the frontend calls relative `/api/...` paths. In production on Vercel there is no Next.js rewrite pointing to your backend, so you must tell the app where the API lives.

### Option A — `NEXT_PUBLIC_API_URL` (simplest, recommended)

The app does **not** currently read `NEXT_PUBLIC_API_URL` in `lib/api.ts` (it uses relative paths). So for a fully working frontend you have two clean choices:

1. **Add a rewrite** in `next.config.js` so the frontend proxies `/api` to your backend:

   ```js
   // next.config.js
   async rewrites() {
     return [
       {
         source: '/api/:path*',
         destination: `${process.env.API_PROXY_TARGET ?? 'http://localhost:4000'}/api/:path*`,
       },
     ];
   },
   ```

   Then set the env var `API_PROXY_TARGET` = `https://examflow-api.vercel.app` in the frontend project and redeploy. The frontend keeps calling relative `/api/...` and Vercel proxies it server-side to your backend.

2. **Or** update `lib/api.ts` to prefix requests with `NEXT_PUBLIC_API_URL`:

   ```ts
   const base = process.env.NEXT_PUBLIC_API_URL ?? '';
   // in api(): const res = await fetch(base + path, {...})
   ```

> The cookie flow matters here: JWT is stored in an httpOnly cookie set by the **backend**. If the frontend is on `examflow.vercel.app` and the backend on `examflow-api.vercel.app`, they're **different domains** — the cookie won't be sent cross-origin unless the backend's CORS allows it. The backend already reflects the request origin (`credentials: true`), so Option A (proxy) keeps everything same-origin and cookies work seamlessly. This is the recommended setup.

### Option B — custom domain

Put both behind one custom domain (e.g. `examflow.com` for the frontend and `api.examflow.com` for the backend). Same-origin cookie behavior applies if you proxy `/api`; otherwise keep `credentials: 'include'` and the CORS setup, which already works.

---

## 7. Verify Everything Works

1. Open `https://examflow.vercel.app`
2. Click **Sign In**
3. Log in with:
   - Admin: `admin@examflow.edu.ng` / `Admin123!`
   - Operator: `operator@examflow.edu.ng` / `Operator123!`
   - Superadmin: `superadmin@examflow.edu.ng` / `SuperAdmin123!`
4. Confirm the dashboard loads with seeded data (520 candidates, 5 halls, 12 sessions)
5. Open a page that calls the API — `/candidates`, `/halls`, `/analytics`, `/schedule` — and confirm data renders
6. Generate an attendance sheet PDF and confirm it downloads

If the login fails with a **network error**, see [Troubleshooting](#10-troubleshooting).

---

## 8. Environment Variables Reference

### Backend project (`examflow-api`)

| Variable            | Required | Description                                              |
| ------------------- | -------- | -------------------------------------------------------- |
| `DATABASE_URL`      | Yes      | Turso `libsql://` URL                                    |
| `TURSO_AUTH_TOKEN`  | Yes      | Turso authentication token                               |
| `JWT_SECRET`        | Yes      | Long random secret for signing tokens                    |
| `JWT_EXPIRES_IN`    | No       | Token lifetime (default `7d`)                            |
| `COOKIE_SECURE`     | No       | `true` in production (HTTPS-only cookies)                |
| `SEED_ON_STARTUP`   | No       | `true` seeds demo data on cold start (default `true`)    |

### Frontend project (`examflow`)

| Variable                | Required | Description                                        |
| ----------------------- | -------- | -------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`   | If using direct calls | Base URL of the backend API, e.g. `https://examflow-api.vercel.app/api` |
| `API_PROXY_TARGET`      | If using rewrites | Backend origin, e.g. `https://examflow-api.vercel.app` |

---

## 9. Redeploying After Changes

Vercel auto-deploys on every push to `main` — nothing to do manually.

- **Backend changes** (anything in `backend/`) → push to GitHub, the `examflow-api` project redeploys
- **Frontend changes** (anything in `app/`, `components/`, etc.) → push, the `examflow` project redeploys
- **Both at once** → one push triggers both projects (each builds its own path)

To deploy a preview (test branch): open a PR or push a branch — Vercel creates preview deployments automatically.

---

## 10. Troubleshooting

### "Invalid export found in module .../app.js. The default export must be a function or server."

**Cause:** Vercel is pointed at a file without a default handler export (this was the original issue with `backend/src/app.ts`).

**Fix:** Make sure the serverless function is set to `backend/src/app.ts`. That file exports `export default async function handler(...)`. Do **not** point it at `backend/src/index.ts` (calls `app.listen()`) or `server.js` (VPS-only).

### Login works locally but fails on Vercel with a network error

**Cause:** The frontend can't reach the backend, or the JWT cookie is being blocked cross-origin.

**Fixes:**
- Confirm `https://examflow-api.vercel.app/api/health` returns `ok`
- Check `NEXT_PUBLIC_API_URL` (direct calls) or `API_PROXY_TARGET` (rewrite) is set correctly
- Use the **rewrite/proxy approach** (same-origin) so the httpOnly cookie flows correctly
- Make sure `COOKIE_SECURE=true` only if you're on HTTPS (Vercel is always HTTPS, so keep it `true`)

### `Could not connect to database` / `ConnectionFailed`

**Cause:** `DATABASE_URL` is missing or the Turso database/token is invalid.

**Fixes:**
- Confirm `DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in the **backend** project's Production env
- Verify the Turso database exists: `turso db show examflow-db`
- Verify the token is valid: `turso db tokens create examflow-db`
- Confirm the URL format is `libsql://examflow-db-<org>.turso.io` (not `https://`)

### Native module errors during build

**Cause:** The `libsql` native module ships prebuilt binaries for common platforms (linux-x64-gnu, darwin-arm64, etc.). If Vercel's build environment doesn't match, the build can fail.

**Fixes:**
- Ensure `DATABASE_URL` is set to a `libsql://` Turso URL so the code path opens a remote connection
- The `libsql` package includes prebuilt binaries for Vercel's runtime — this should work out of the box
- If the build still fails, check the `libsql` package version and file an issue at [github.com/tursodatabase/libsql-js](https://github.com/tursodatabase/libsql-js)

### Cold start is slow / first request times out

**Cause:** The serverless function syncs the schema and (optionally) seeds on the first cold start.

**Fixes:**
- Set `SEED_ON_STARTUP=false` after the first successful seed
- Set the function's **Max Duration** to 30s
- Vercel Hobby functions can be slow to warm; a scheduled "ping" (e.g. a cron hitting `/api/health`) keeps it warm

### Frontend builds but shows an empty dashboard

**Cause:** The frontend is up but can't talk to the API.

**Fixes:**
- Open the browser devtools Network tab and check the failing `/api/...` request
- Confirm the backend URL is reachable from the browser (CORS)
- Verify `credentials` and CORS origin are configured (the backend already sets `cors({ credentials: true, origin: ... })`)

---

## Quick Reference

```bash
# Backend URL:    https://examflow-api.vercel.app
# Frontend URL:   https://examflow.vercel.app

# Test backend
curl https://examflow-api.vercel.app/api/health

# Deploy flow
git add -A && git commit -m "update" && git push origin main   # Vercel redeploys both projects
```
