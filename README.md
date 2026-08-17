# ExamFlow

> A modern, full-stack CBT examination scheduling and management platform built for university exam offices.

ExamFlow takes the headache out of university exam scheduling. Import thousands of candidates from a CSV, define your halls and sessions, and let the engine handle the rest — assigning every student to a conflict-free seat automatically. When it's done, download print-ready attendance sheets per hall, per session.

No more spreadsheets. No more manual seat assignments. No more double-bookings.

---

## What It Does

**Import candidates in bulk.** Upload a CSV with student names, emails, matric numbers, and career groups. ExamFlow validates every row, flags errors, detects duplicates, and lets you preview everything before committing.

**Manage halls and seats.** Register exam halls with capacity limits. ExamFlow auto-generates seat maps (`A-001`, `A-002`, ..., `B-001`, ...) and shows a live color-coded seat map for each hall.

**Define exam sessions.** Create time slots with dates and durations. Each session represents a block of exams that candidates can be assigned to.

**Let the engine schedule.** One click generates the entire schedule. The engine assigns candidates to seats across halls and sessions with zero conflicts. It packs by career group so each programme fills halls contiguously. If demand exceeds supply, overflow is reported explicitly — no silent dropouts.

**Print attendance sheets.** Generate per-hall, per-session attendance sheets. Download as PDF (A4, formatted with PDFKit) or open as a printable HTML page.

**Track everything.** Full analytics dashboard with charts for candidate status, programme coverage, hall utilization, and session load. Every action in the system is logged in the activity trail.

---

## How It Works

```
Import CSV → Define Halls → Create Sessions → Generate Schedule → Download Sheets
```

1. **Import** — Upload candidate CSV, review validation, confirm import
2. **Halls** — Register halls, auto-generate seats
3. **Sessions** — Create exam time slots
4. **Schedule** — Engine assigns all candidates to seats (no conflicts, capacity-aware)
5. **Attendance** — Generate and download PDF/HTML attendance sheets per hall

---

## Tech Stack

- **Frontend** — Next.js 14, React 18, TypeScript, Tailwind CSS, GSAP animations, Recharts charts
- **Backend** — Express 4, TypeORM, JWT auth (httpOnly cookies), Zod validation, PDFKit for PDFs
- **Database** — PostgreSQL (Neon) with local SQLite fallback

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & Run (Development)

```bash
git clone https://github.com/Omonire/ICT.git
cd ICT
npm install
npm run seed
npm run dev
```

In dev the two servers run concurrently — **Frontend:** http://localhost:3000 · **API:** http://localhost:4000. For production they run in one process on one port: `npm run build && npm run start` → http://localhost:3000.

### Demo Accounts

| Role       | Email                      | Password       |
| ---------- | -------------------------- | -------------- |
| Admin      | admin@examflow.edu.ng      | `Admin123!`    |
| Operator   | operator@examflow.edu.ng   | `Operator123!` |

---

## Deploy

### Docker (Recommended)

```bash
# Create .env files
cp .env.example .env
cp backend/.env.example backend/.env
# Edit with production values (strong JWT secret, PostgreSQL credentials, COOKIE_SECURE=true)

docker-compose up -d
docker-compose exec api node dist/index.js --seed   # seed once
```

### Manual Server (one command, one port)

The API and frontend run together in a single process on one port — `/api/*` is handled by Express, everything else by Next.js.

```bash
npm install
npm run build
npm run start          # http://localhost:3000 serves API + web
```

Optionally keep them as two processes with `npm run start:split`, or use PM2: `pm2 start server.js --name examflow`.

### Vercel (Backend + Frontend)

Follow the full step-by-step guide: **[vercel.md](vercel.md)** — database setup, backend serverless function, frontend project, env vars, and troubleshooting.

**Backend:** Import the repo as a Vercel project, add a serverless function for `backend/src/app.ts` (it ships with a Vercel-compatible default handler that auto-initializes the DB), set `DATABASE_URL` to your PostgreSQL connection string (e.g. from [Neon](https://neon.tech)), and deploy.

**Frontend:** Separate Vercel project, proxy `/api` to the backend (or set `NEXT_PUBLIC_API_URL`), deploy.

### Railway (Full Stack)

1. Create project on [railway.app](https://railway.app)
2. Create a PostgreSQL database on [Neon](https://neon.tech)
3. Connect your GitHub repo
4. Set environment variables
5. Auto-deploys on push

---

## Environment Variables

```bash
# Backend
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@your-host:5432/your-db
JWT_SECRET=your-64-char-random-secret
JWT_EXPIRES_IN=7d
COOKIE_SECURE=true
SEED_ON_STARTUP=false

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

---

## Project Structure

```
app/                    Next.js pages (landing, login, dashboard)
components/             UI primitives + dashboard + landing sections
lib/                    API client, types, formatting, hooks
backend/src/
  entities/             9 TypeORM models (User, Candidate, Hall, Seat, Session, ...)
  routes/               11 route modules
  controllers/          9 controller modules
  services/             Scheduler engine, CSV import, attendance PDF, seeding
  middleware/           JWT auth, role guard, validation, error handling
data/                   SQLite database file (auto-created)
docs/                   Full documentation
```

---

## API at a Glance

41 RESTful endpoints under `/api` — auth, candidate CRUD + CSV import, halls + seats, sessions, scheduling engine (preview/generate/confirm/clear), attendance sheets (PDF/HTML), analytics, activity log, and admin controls.

Full reference: [docs/API.md](docs/API.md)

---

## Documentation

- [API Reference](docs/API.md) — All endpoints with examples
- [Architecture](docs/ARCHITECTURE.md) — System design, database schema, auth flow
- [Deployment](docs/DEPLOYMENT.md) — Docker, Vercel, Railway, Nginx, production checklist
- [Development](docs/DEVELOPMENT.md) — Setup, workflow, debugging guide
- [Contributing](docs/CONTRIBUTING.md) — Branch naming, commits, PR process
- [Scheduling Algorithm](docs/scheduling-algorithm.md) — How the seat assignment engine works

---

## License

Private and proprietary. Unauthorized distribution is prohibited.
