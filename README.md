# ExamFlow — CBT Examination Scheduling & Management

A full-stack platform for planning, scheduling and running university **Computer-Based Test (CBT)** examinations. Import candidates, define halls and exam sessions, let the engine auto-assign every candidate to a seat with no conflicts, and produce print-ready attendance sheets per hall.

Built with **Next.js 14 (App Router) + TypeScript + Tailwind** on the frontend and **Express + TypeORM** on the backend.

## Quick start

```bash
npm install            # installs all workspace deps
npm run seed           # creates schema + seeds 520 candidates, 5 halls, 12 sessions (idempotent)
npm run dev            # API on :4000, web on :3000
```

Open http://localhost:3000 and sign in:

| Role    | Email                       | Password      |
| ------- | --------------------------- | ------------- |
| Admin   | admin@examflow.edu.ng      | `Admin123!`   |
| Operator| operator@examflow.edu.ng   | `Operator123!`|

## What's included

- **Landing page** — GSAP scroll-animated hero with a canvas-drawn seat-map visualization and reveal-on-scroll sections.
- **Candidates** — searchable/sortable/paginated table, add/edit/delete, CSV bulk import with per-row validation, rollback on failure, duplicate detection.
- **Halls & seats** — hall registry with auto-generated seat maps (`A-001…A-040`), live seat-map viewer per hall.
- **Sessions** — exam slots with date/time and duration.
- **Scheduling engine** — assigns candidates to seats/sessions automatically:
  - no candidate scheduled twice,
  - at most one candidate per seat per session,
  - candidates are processed by career line so each programme fills halls contiguously,
  - capacity-aware with a clear "overflow" report when demand exceeds supply.
- **Attendance sheets** — per-hall/per-session printable sheets and PDF downloads (generated server-side with PDFKit).
- **Analytics** — candidate status, programme coverage, hall utilization and session load charts (Recharts).
- **Activity log** — full audit trail of every action (login, imports, schedule changes, sheet generation).

## Tech stack

- **Web:** Next.js 14, React 18, Tailwind CSS, GSAP, Recharts, Lucide
- **API:** Express 4, TypeORM, JWT (httpOnly cookie), Zod validation, multer CSV upload, PDFKit
- **DB:** SQLite by default; PostgreSQL supported via `DB_TYPE=postgres`

## Project layout

```
app/                  Next.js App Router (landing, login, dashboard group)
components/           UI primitives + dashboard/landing components
lib/                  API client, types, formatting helpers
backend/src/
  entities/           TypeORM models (User, Candidate, Hall, Seat, Session, Assignment, …)
  routes/             Express routers
  controllers/        Request handlers
  services/           scheduling engine, CSV import, attendance PDF, seeding
  middleware/         JWT auth, role guard, error handling
data/                 SQLite database (committed for out-of-the-box demo, in backend/)
```

## Scripts

| Command               | Description                                |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | API + web in watch mode                    |
| `npm run build`       | Production build (backend + frontend)      |
| `npm run start`       | Production start                           |
| `npm run seed`        | (Re)seed demo data                         |
| `npm run typecheck`   | Type-check backend + frontend              |
| `npm run migration:run` | Run TypeORM migrations (Postgres)        |

## API overview

`/api/auth/*` login/logout/me · `/api/candidates` CRUD + `/import` · `/api/halls` + `/halls/:id/seats` · `/api/sessions` · `/api/schedule/generate|preview|confirm|clear|status` · `/api/attendance-sheets/*` (+ PDF/HTML) · `/api/analytics` · `/api/activity-log`

See `docs/scheduling-algorithm.md` for how the placement engine works.
