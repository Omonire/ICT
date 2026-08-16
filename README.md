# ExamFlow — CBT Examination Scheduling & Management

A full-stack platform for planning, scheduling, and managing university **Computer-Based Test (CBT)** examinations. Import thousands of candidates via CSV, define halls and exam sessions, let the scheduling engine auto-assign every candidate to a conflict-free seat, and produce print-ready attendance sheets (PDF and HTML).

Built with **Next.js 14 (App Router) + TypeScript + Tailwind CSS** on the frontend and **Express 4 + TypeORM** on the backend.

---

## Features

- **Landing Page** — GSAP scroll-animated hero with canvas-drawn seat-map visualization, animated counters, workflow pipeline, and trust marquee.
- **Candidate Management** — Searchable, sortable, paginated table with add/edit/delete. CSV bulk import with per-row validation, rollback on failure, and duplicate detection.
- **Hall & Seat Registry** — Create halls with capacity, auto-generated seat maps (`A-001`, `A-002`, ...), live seat-map viewer per hall with color-coded status.
- **Session Management** — Define exam slots with date, start/end times.
- **Scheduling Engine** — Conflict-free seat assignment with career-line packing, capacity awareness, and explicit overflow reporting. See [Scheduling Algorithm](docs/scheduling-algorithm.md).
- **Attendance Sheets** — Per-hall/per-session printable sheets with PDF download (server-side PDFKit) and HTML view.
- **Analytics Dashboard** — Candidate status, programme coverage, hall utilization, and session load charts (Recharts).
- **Activity Log** — Full audit trail of every system action.
- **Theme System** — Light, dark, and purple themes with localStorage persistence.
- **Role-Based Access Control** — Superadmin, admin, operator, and viewer roles with JWT httpOnly cookie auth.
- **Maintenance Mode** — Toggle to block non-admin access during system updates.
- **Responsive Design** — Mobile-friendly dashboard with collapsible sidebar and drawer navigation.

---

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/Omonire/ICT.git
cd ICT

# Install all dependencies (monorepo workspaces)
npm install

# Seed demo data (520 candidates, 5 halls, 12 sessions, 5 career groups, 3 users)
npm run seed

# Start development servers
npm run dev          # API on :4000, web on :3000
```

Open **http://localhost:3000** and sign in:

| Role       | Email                      | Password       |
| ---------- | -------------------------- | -------------- |
| Superadmin | superadmin@examflow.edu.ng | `Super123!`    |
| Admin      | admin@examflow.edu.ng      | `Admin123!`    |
| Operator   | operator@examflow.edu.ng   | `Operator123!` |

---

## Tech Stack

| Layer      | Technology                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, GSAP, Recharts, Lucide Icons |
| **Backend**  | Express 4, TypeORM, JWT (httpOnly cookies), Zod validation, multer, PDFKit |
| **Database** | SQLite (zero-config default) / PostgreSQL (production via `DB_TYPE=postgres`) |

---

## Project Structure

```
ICT/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing page (GSAP animated)
│   ├── login/                  # Authentication page
│   └── (dashboard)/            # Dashboard route group (protected)
│       ├── dashboard/          # Operations overview
│       ├── candidates/         # Candidate CRUD + CSV import
│       ├── halls/              # Hall registry + seat maps
│       ├── sessions/           # Session management
│       ├── schedule/           # Scheduling engine UI
│       ├── attendance/         # Attendance sheets + PDF
│       ├── analytics/          # Charts & statistics
│       ├── activity/           # Audit trail
│       └── superadmin/         # System controls
├── components/
│   ├── auth/                   # Auth context & provider
│   ├── dashboard/              # App shell, sidebar, search, user menu
│   ├── landing/                # 14 landing page sections
│   └── ui/                     # 22 reusable UI primitives
├── lib/
│   ├── api.ts                  # HTTP client (fetch wrapper)
│   ├── types.ts                # TypeScript interfaces
│   ├── use-api.ts              # Data fetching hook
│   ├── format.ts               # Date/enum formatting utilities
│   └── utils.ts                # cn() class merge utility
├── hooks/
│   └── use-in-view.ts          # IntersectionObserver hook
├── backend/
│   ├── src/
│   │   ├── index.ts            # Server bootstrap
│   │   ├── app.ts              # Express app factory
│   │   ├── config/             # Environment + TypeORM DataSource
│   │   ├── entities/           # 9 TypeORM models
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── routes/             # 11 route modules
│   │   ├── controllers/        # 9 controller modules
│   │   ├── services/           # Scheduler, CSV import, attendance, seeding
│   │   ├── middleware/         # Auth, roles, validation, error handling
│   │   └── utils/              # IDs, errors, pagination
│   └── data/                   # SQLite database file
└── docs/                       # Documentation
```

---

## Available Scripts

| Command               | Description                                       |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Start API (:4000) + web (:3000) in watch mode     |
| `npm run dev:web`     | Start only the Next.js dev server                 |
| `npm run dev:api`     | Start only the backend API server                 |
| `npm run build`       | Production build (backend + frontend)             |
| `npm run start`       | Production start (API + web)                      |
| `npm run seed`        | Seed/replace demo data (idempotent)               |
| `npm run typecheck`   | Type-check backend + frontend                     |

---

## Environment Variables

Copy `.env.example` to `.env` (root) and `backend/.env.example` to `backend/.env`:

```bash
# Backend
PORT=4000
NODE_ENV=development
DB_TYPE=sqlite                  # or "postgres" for production
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=examflow
DB_FILE=./data/examflow.sqlite
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d
COOKIE_SECURE=false
SEED_ON_STARTUP=true

# Frontend (set in .env.local or as environment variable)
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## API Overview

The backend exposes **41 RESTful endpoints** under `/api`:

| Module            | Endpoints                                             |
| ----------------- | ----------------------------------------------------- |
| **Auth**          | `POST /login`, `POST /logout`, `GET /me`              |
| **Candidates**    | CRUD + `POST /import/preview`, `POST /import/confirm` |
| **Halls**         | CRUD + `GET /:id` (with seats)                        |
| **Seats**         | `GET /:hallId` (filtered by session)                  |
| **Sessions**      | CRUD                                                  |
| **Career Groups** | `GET /`, `POST /`                                     |
| **Schedule**      | `GET /status`, `GET /preview`, `POST /generate`, `POST /confirm`, `POST /clear` |
| **Attendance**    | `GET /`, `POST /:sid/:hid/generate`, `GET /:sid/:hid/pdf`, `GET /:sid/:hid/html` |
| **Analytics**     | `GET /`                                               |
| **Activity Log**  | `GET /` (paginated)                                   |
| **Admin**         | User CRUD, purge, seed, maintenance toggle            |

See [docs/API.md](docs/API.md) for the complete API reference with request/response examples.

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system architecture, database schema, authentication flow, and design patterns.

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production deployment instructions (Docker, Vercel, Railway, manual).

---

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed development setup, workflow, and debugging guide.

---

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for contribution guidelines, code style, and PR process.

---

## License

This project is private and proprietary. Unauthorized distribution is prohibited.
