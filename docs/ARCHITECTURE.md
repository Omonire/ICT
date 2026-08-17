# Architecture

This document describes ExamFlow's system architecture, database schema, authentication flow, and key design patterns.

---

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Monorepo Structure](#monorepo-structure)
- [Database Schema](#database-schema)
- [Authentication & Authorization](#authentication--authorization)
- [Scheduling Engine](#scheduling-engine)
- [CSV Import Pipeline](#csv-import-pipeline)
- [Attendance Generation](#attendance-generation)
- [Theme System](#theme-system)
- [Error Handling](#error-handling)
- [Design Patterns](#design-patterns)

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Landing  │  │  Login   │  │      Dashboard        │  │
│  │  (GSAP)  │  │  (JWT)   │  │  (App Router Group)   │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│                    │              │                       │
│              ┌─────┴──────────────┴──────┐              │
│              │     lib/api.ts (fetch)     │              │
│              └─────────────┬─────────────┘              │
└────────────────────────────┼────────────────────────────┘
                             │ HTTP (JSON + cookies)
┌────────────────────────────┼────────────────────────────┐
│                    Backend (Express)                      │
│              ┌─────────────┴─────────────┐              │
│              │   Middleware Pipeline      │              │
│              │  CORS → Security → Auth →  │              │
│              │  Role → Validate → Route   │              │
│              └─────────────┬─────────────┘              │
│  ┌──────────┐  ┌──────────┴──┐  ┌──────────────────┐  │
│  │  Routes  │  │ Controllers │  │    Services       │  │
│  │  (11)    │→ │    (9)      │→ │ Scheduler, CSV,   │  │
│  └──────────┘  └─────────────┘  │ Attendance, Seed   │  │
│                                  └──────────────────┘  │
│              ┌─────────────┬─────────────┐              │
│              │  TypeORM    │  Activity    │              │
│              │  Entities   │  Logger      │              │
│              └──────┬──────┴─────────────┘              │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │  Database   │                             │
│              │  Turso (libSQL)│                             │
│              └─────────────┘                             │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component   | Choice            | Purpose                                      |
| ----------- | ----------------- | -------------------------------------------- |
| Runtime     | Node.js 18+       | JavaScript runtime                           |
| Framework   | Next.js 14        | React SSR, App Router, API proxy             |
| UI Library  | React 18          | Component-based UI                           |
| Styling     | Tailwind CSS 3    | Utility-first CSS                            |
| Animation   | GSAP              | Scroll-triggered animations on landing page  |
| Charts      | Recharts          | Analytics dashboard visualizations           |
| HTTP Client | Fetch API         | Backend communication                        |
| Server      | Express 4         | REST API framework                           |
| ORM         | TypeORM           | Database abstraction                          |
| Validation  | Zod               | Runtime schema validation                    |
| Auth        | JWT + bcrypt      | Stateless authentication                     |
| PDF         | PDFKit            | Server-side PDF generation                   |
| CSV         | multer + csv-parse| File upload and parsing                      |

---

## Monorepo Structure

ExamFlow uses **npm workspaces** to manage the monorepo:

```
ICT/                         # Root workspace
├── package.json             # Workspaces: ["backend"]
├── app/                     # Next.js App Router
├── components/              # React components
├── lib/                     # Shared frontend utilities
├── hooks/                   # React hooks
└── backend/                 # Backend workspace
    ├── package.json         # Express, TypeORM, etc.
    └── src/                 # Source code
```

**Key convention:** The root `package.json` defines workspace scripts that delegate to `backend`:

```json
{
  "scripts": {
    "dev": "concurrently -n api,web \"npm run dev --workspace backend\" \"next dev -p 3000\"",
    "dev:api": "npm run dev --workspace backend",
    "dev:web": "next dev -p 3000"
  }
}
```

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│  Users   │     │ Candidates   │     │  Halls   │
├──────────┤     ├──────────────┤     ├──────────┤
│ id (PK)  │     │ id (PK,CAN)  │     │ id (PK)  │
│ email    │     │ name         │     │ name     │
│ password │     │ email        │     │ capacity │
│ role     │     │ matric_no    │     │ status   │
│ name     │     │ career_group │     └────┬─────┘
└──────────┘     │   _id (FK)   │          │
                 │ status       │     ┌────┴─────┐
                 │ assigned_    │     │  Seats   │
                 │   hall_id FK │     ├──────────┤
                 │ assigned_    │     │ id (PK)  │
                 │   seat_no    │     │ hall_id  │
                 │ assigned_    │     │   (FK,C) │
                 │   session_id │     │ seat_num │
                 │ assigned_    │     │ status   │
                 │   exam_date  │     │candidate │
                 └──────┬───────┘     │  _id(FK) │
                        │             └──────────┘
┌──────────────┐        │
│Career Groups │   ┌────┴─────────────┐     ┌──────────────┐
├──────────────┤   │CandidateAssign-  │     │  Sessions    │
│ id (PK)      │   │ments             │     ├──────────────┤
│ name         │   ├──────────────────┤     │ id (PK)      │
│ description  │   │ id (PK)          │     │ name         │
│ subjects(JSON│   │ candidate_id(FK) │     │ exam_date    │
│ candidate_   │   │ session_id (FK)  │     │ start_time   │
│   count      │   │ hall_id (FK)     │     │ end_time     │
└──────────────┘   │ seat_number      │     └──────────────┘
                   └──────────────────┘
┌──────────────┐   ┌──────────────┐
│Schedule Meta │   │Activity Logs │
├──────────────┤   ├──────────────┤
│ id (fixed)   │   │ id (PK)      │
│ status       │   │ action       │
│ session_ids  │   │ user_id (FK) │
│ generated_at │   │ entity_type  │
│ confirmed_at │   │ entity_id    │
│ confirmed_by │   │ details(JSON)│
│ summary(JSON)│   │ timestamp    │
└──────────────┘   └──────────────┘
```

### Table Details

#### `users`
| Column      | Type     | Constraints           |
| ----------- | -------- | --------------------- |
| id          | UUID     | PK                    |
| email       | VARCHAR  | UNIQUE, NOT NULL      |
| password    | VARCHAR  | bcrypt hash, select:false |
| role        | ENUM     | superadmin/admin/operator/viewer |
| name        | VARCHAR  | NOT NULL              |
| created_at  | DATETIME | auto                  |

#### `candidates`
| Column             | Type     | Constraints                    |
| ------------------ | -------- | ------------------------------ |
| id                 | VARCHAR  | PK, format `CAN-NNNNN`        |
| name               | VARCHAR  | NOT NULL                       |
| email              | VARCHAR  | UNIQUE, indexed                |
| matric_no          | VARCHAR  | nullable                       |
| career_group_id    | UUID     | FK → career_groups             |
| status             | ENUM     | unscheduled/scheduled/completed |
| assigned_hall_id   | UUID     | FK → halls, nullable           |
| assigned_seat_number | VARCHAR | nullable                       |
| assigned_session_id | UUID    | FK → sessions, nullable        |
| assigned_exam_date | DATE     | nullable                       |
| created_at         | DATETIME | auto                           |

#### `career_groups`
| Column          | Type     | Constraints      |
| --------------- | -------- | ---------------- |
| id              | UUID     | PK               |
| name            | VARCHAR  | UNIQUE, NOT NULL |
| description     | TEXT     | nullable         |
| subjects        | JSON     | array of strings |
| candidate_count | INT      | denormalized     |

#### `halls`
| Column   | Type     | Constraints      |
| -------- | -------- | ---------------- |
| id       | UUID     | PK               |
| name     | VARCHAR  | UNIQUE, NOT NULL |
| capacity | INT      | 10–2000          |
| status   | VARCHAR  | default 'active' |
| created_at | DATETIME | auto            |

#### `seats`
| Column      | Type     | Constraints                  |
| ----------- | -------- | ---------------------------- |
| id          | UUID     | PK                           |
| hall_id     | UUID     | FK → halls, CASCADE, indexed |
| seat_number | VARCHAR  | e.g. `A-001`                |
| status      | ENUM     | available/occupied/reserved  |
| candidate_id | UUID    | FK → candidates, nullable    |

**Unique constraint:** `(hall_id, seat_number)`

#### `sessions`
| Column     | Type     | Constraints |
| ---------- | -------- | ----------- |
| id         | UUID     | PK          |
| name       | VARCHAR  | NOT NULL    |
| exam_date  | DATE     | YYYY-MM-DD  |
| start_time | VARCHAR  | HH:mm       |
| end_time   | VARCHAR  | HH:mm       |
| created_at | DATETIME | auto        |

#### `candidate_assignments`
| Column       | Type     | Constraints                          |
| ------------ | -------- | ------------------------------------ |
| id           | VARCHAR  | PK, format `CAN-NNNNN:sessionId`    |
| candidate_id | UUID     | FK → candidates, CASCADE, UNIQUE     |
| session_id   | UUID     | FK → sessions, CASCADE               |
| hall_id      | UUID     | FK → halls, CASCADE                  |
| seat_number  | VARCHAR  | NOT NULL                             |

**Unique constraint:** `(session_id, hall_id, seat_number)`

#### `schedule_meta`
| Column        | Type     | Constraints                    |
| ------------- | -------- | ------------------------------ |
| id            | VARCHAR  | PK, fixed value `'schedule'`   |
| status        | ENUM     | none/draft/confirmed           |
| session_ids   | JSON     | array of session UUIDs         |
| generated_at  | DATETIME | nullable                       |
| confirmed_at  | DATETIME | nullable                       |
| confirmed_by  | VARCHAR  | email of confirmer             |
| summary       | JSON     | scheduling statistics          |

#### `activity_logs`
| Column      | Type     | Constraints   |
| ----------- | -------- | ------------- |
| id          | UUID     | PK            |
| action      | VARCHAR  | indexed       |
| user_id     | UUID     | FK → users, SET NULL, nullable |
| entity_type | VARCHAR  | nullable      |
| entity_id   | VARCHAR  | nullable      |
| details     | JSON     | nullable      |
| timestamp   | DATETIME | indexed, auto |

---

## Authentication & Authorization

### Flow

```
1. User submits email + password
         │
2. POST /api/auth/login
         │
3. bcrypt.compare() verifies password
         │
4. JWT created: { sub, email, role }
         │
5. Token set as httpOnly cookie (7-day expiry)
         │
6. Subsequent requests: authenticate middleware
         │
7. Extracts token from cookie or Bearer header
         │
8. jwt.verify() decodes and attaches req.user + req.userRole
         │
9. requireRole() middleware checks permissions
```

### Role Hierarchy

```
superadmin  →  Full system access
admin       →  CRUD + delete operations
operator    →  Create/edit, schedule generation
viewer      →  Read-only access
```

### Middleware Pipeline

```
Request → CORS → Security Headers → authenticate → requireRole → validate → Route Handler
```

---

## Scheduling Engine

See [scheduling-algorithm.md](scheduling-algorithm.md) for the detailed algorithm.

**Key properties:**
- **Two-phase:** Preview (in-memory) → Confirm (DB persist)
- **Idempotent:** Re-generating replaces previous assignments
- **Career-line packing:** Groups fill halls contiguously
- **Capacity-aware:** Never exceeds hall capacity
- **Overflow-safe:** Reports unassigned candidates explicitly

---

## CSV Import Pipeline

```
Upload CSV → Parse → Validate (Zod) → Preview (in-memory, 10min TTL)
                                                    │
                                          User reviews
                                                    │
                                          Confirm → DB transaction
                                                    │
                                          Duplicate detection + rollback
```

---

## Attendance Generation

```
Session + Hall → Fetch assignments → Build sheet data
                                          │
                            ┌──────────────┴──────────────┐
                            │                              │
                       HTML render                    PDF render
                    (printable page)               (PDFKit, A4 layout)
```

PDF includes: header with exam info, hall/session details, seat-numbered table of candidates, and footer with page numbering.

---

## Theme System

Three themes using CSS custom properties on `<html data-theme="...">`:

| Theme    | Style                              |
| -------- | ---------------------------------- |
| `light`  | White background, dark text        |
| `dark`   | Dark background, light text        |
| `purple` | Purple-tinted background, gold accents |

**Persistence:** localStorage key `examflow-theme`, applied on `<html>` before React hydration to prevent flash.

**CSS Variables:** `--background`, `--foreground`, `--card`, `--card-hover`, `--muted`, `--input`, `--ring`, `--sidebar`, `--sidebar-foreground`, `--sidebar-active`, `--sidebar-hover`, `--header`

---

## Error Handling

### Backend

1. **AppError** — Custom error class with `statusCode` and `details`
2. **QueryFailedError** — TypeORM/DB errors mapped to user-friendly messages
3. **SyntaxError** — Malformed JSON body handling
4. **Global handler** — `error.middleware.ts` catches all unhandled errors

### Frontend

1. **ErrorBoundary** — Catches React render errors, shows recovery UI with retry
2. **Toast system** — Success/error/info notifications with auto-dismiss
3. **useApi hook** — Loading/error states for data fetching
4. **ApiRequestError** — Typed HTTP errors from the API client

---

## Design Patterns

| Pattern                  | Usage                                              |
| ------------------------ | -------------------------------------------------- |
| **Two-phase mutations**  | CSV import preview → confirm; Schedule preview → confirm |
| **Idempotent operations**| Reseeding, re-generating schedules, seat re-creation |
| **Optimistic seat labels**| Contiguous fill calculation without per-seat DB lookups |
| **Context providers**    | Auth, Theme, Toast as React Context                |
| **Zod validation**       | Every request validated at middleware level         |
| **Activity logging**     | Every mutation writes to audit trail               |
| **Soft maintenance mode**| Toggle that blocks non-admin access                |
| **Debounced search**     | useDebounce + useApi for non-blocking search       |
| **Pagination**           | Cursor-based page/limit with total counts          |
| **CORS + security headers** | Production-ready Express security              |
