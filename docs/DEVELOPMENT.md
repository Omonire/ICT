# Development Guide

This guide covers local development setup, workflow, and debugging for ExamFlow.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [Database](#database)
- [API Proxy](#api-proxy)
- [Debugging](#debugging)
- [Code Style](#code-style)
- [Testing](#testing)

---

## Prerequisites

| Tool     | Version | Check           |
| -------- | ------- | --------------- |
| Node.js  | >= 18   | `node --version` |
| npm      | >= 9    | `npm --version`  |

Optional:
- **PostgreSQL** — if you want to develop against Postgres instead of SQLite
- **VS Code** — recommended editor with extensions for TypeScript, Tailwind, ESLint

---

## Setup

```bash
# Clone the repository
git clone https://github.com/Omonire/ICT.git
cd ICT

# Install all dependencies (monorepo workspaces)
npm install

# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Seed demo data
npm run seed
```

The seed command is **idempotent** — running it multiple times replaces existing data safely.

---

## Running the Project

### Full Stack (Recommended)

```bash
npm run dev
```

This starts both servers concurrently:
- **Frontend:** http://localhost:3000 (Next.js with Turbopack)
- **Backend API:** http://localhost:4000 (Express with ts-node watch)

### Individual Servers

```bash
# Frontend only
npm run dev:web

# Backend only
npm run dev:api
```

### Available Scripts

| Command               | Description                                |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | Start API + web in watch mode              |
| `npm run dev:web`     | Start Next.js dev server only              |
| `npm run dev:api`     | Start backend API server only              |
| `npm run build`       | Production build (backend + frontend)      |
| `npm run start`       | Production start (API + web)               |
| `npm run seed`        | Seed/replace demo data                     |
| `npm run typecheck`   | Type-check backend + frontend              |

---

## Project Structure

```
ICT/
├── app/                     # Next.js App Router pages
│   ├── layout.tsx           # Root layout (fonts, ToastProvider)
│   ├── globals.css          # Theme variables, animations
│   ├── page.tsx             # Landing page
│   ├── login/               # Auth page
│   └── (dashboard)/         # Protected dashboard group
│       ├── layout.tsx       # Theme + Auth + AppShell
│       ├── dashboard/       # Overview page
│       ├── candidates/      # Candidate CRUD + import
│       ├── halls/           # Hall management
│       ├── sessions/        # Session management
│       ├── schedule/        # Scheduling engine
│       ├── attendance/      # Attendance sheets
│       ├── analytics/       # Charts
│       ├── activity/        # Audit log
│       └── superadmin/      # System controls
│
├── components/
│   ├── auth/                # AuthContext, AuthProvider
│   ├── dashboard/           # AppShell, sidebar, header, search
│   ├── landing/             # 14 landing page sections
│   └── ui/                  # 22 reusable primitives
│       ├── button.tsx       # Button with 6 variants
│       ├── card.tsx         # Card components
│       ├── dialog.tsx       # Modal dialog
│       ├── table.tsx        # Table components
│       ├── toast.tsx        # Toast notification system
│       └── ...
│
├── lib/
│   ├── api.ts               # HTTP client (apiGet, apiPost, etc.)
│   ├── types.ts             # TypeScript interfaces
│   ├── use-api.ts           # useApi<T>() data fetching hook
│   ├── format.ts            # Date/enum formatting
│   ├── hooks.ts             # useDebounce
│   ├── boot.ts              # Landing page boot signaling
│   └── utils.ts             # cn() class merge
│
├── hooks/
│   └── use-in-view.ts       # IntersectionObserver hook
│
├── backend/
│   ├── src/
│   │   ├── index.ts         # Server bootstrap (TypeORM + Express)
│   │   ├── app.ts           # Express app factory
│   │   ├── config/
│   │   │   ├── env.ts       # Typed environment config
│   │   │   └── data-source.ts # TypeORM DataSource
│   │   ├── entities/        # 9 TypeORM models
│   │   ├── schemas/         # Zod validation schemas
│   │   ├── routes/          # 11 route modules
│   │   ├── controllers/     # 9 controller modules
│   │   ├── services/        # Business logic
│   │   ├── middleware/       # Auth, roles, errors, validation
│   │   └── utils/           # IDs, errors, pagination
│   └── data/                # SQLite database file
│
└── docs/                    # Documentation
```

---

## Frontend Development

### Adding a New Page

1. Create a file in `app/(dashboard)/your-page/page.tsx`
2. Add navigation entry in `components/dashboard/app-shell.tsx`
3. Use the `useApi` hook for data fetching:

```tsx
"use client";
import { useApi } from "@/lib/use-api";
import { PageLoader } from "@/components/ui/spinner";

export default function YourPage() {
  const { data, loading, error } = useApi<{ data: Item[] }>("/api/your-endpoint");

  if (loading) return <PageLoader />;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* render data */}</div>;
}
```

### Adding a New UI Component

Follow the pattern in `components/ui/`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary";
}

const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "base-styles",
          variant === "secondary" && "secondary-styles",
          className
        )}
        {...props}
      />
    );
  }
);
MyComponent.displayName = "MyComponent";

export { MyComponent };
```

### Theme System

Themes use CSS custom properties. To add a new theme:

1. Add CSS variables in `app/globals.css` under `[data-theme="your-theme"]`
2. Add the theme option in `components/theme-provider.tsx`
3. Add a toggle button in `components/theme-toggle.tsx`

### Landing Page

The landing page uses GSAP for scroll-triggered animations. Key files:
- `components/landing/landing-reveal.tsx` — Batch scroll reveal
- `components/landing/scroll-video.tsx` — Canvas seat grid animation
- `components/landing/showcase.tsx` — Scroll-pinned console mockup

---

## Backend Development

### Adding a New Endpoint

1. **Entity** (if needed): Create in `backend/src/entities/`
2. **Schema**: Add Zod schema in `backend/src/schemas/index.ts`
3. **Service** (if complex logic): Create in `backend/src/services/`
4. **Controller**: Create in `backend/src/controllers/`
5. **Route**: Create in `backend/src/routes/`
6. **Mount**: Register the route in `backend/src/app.ts`

Example route:

```typescript
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import { mySchema } from "../schemas";
import { myController } from "../controllers/my.controller";

const router = Router();

router.get("/", authenticate, myController.list);
router.post("/", authenticate, requireRole("admin"), validate(mySchema), myController.create);

export default router;
```

### Adding Middleware

Create in `backend/src/middleware/` and register in `app.ts`:

```typescript
export const myMiddleware = (req, res, next) => {
  // Logic here
  next();
};
```

### Activity Logging

Log actions for audit trail:

```typescript
import { logActivity } from "../services/activity-log";

await logActivity({
  action: "my.action",
  userId: req.user.id,
  entityType: "myEntity",
  entityId: entity.id,
  details: { /* any relevant data */ },
});
```

---

## Database

### Default: SQLite

Zero-config. Database file at `backend/data/examflow.sqlite`. TypeORM creates tables automatically in development (`synchronize: true`).

### PostgreSQL

1. Set `DB_TYPE=postgres` in `backend/.env`
2. Configure `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
3. Create the database in PostgreSQL
4. Restart the backend — tables auto-create

### Re-seeding

```bash
npm run seed
```

This clears all data and re-seeds: 3 users, 5 career groups, 5 halls, 12 sessions, 520 candidates with pre-assignments.

---

## API Proxy

In development, Next.js proxies `/api/*` requests to the backend. This is configured in `next.config.js`:

```javascript
async rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: "http://localhost:4000/api/:path*",
    },
  ];
}
```

This means the frontend can make requests to `/api/...` without specifying the full URL.

---

## Debugging

### Frontend

- **React DevTools** — Inspect component tree and state
- **Next.js DevTools** — Available at `/_next/devtools`
- **Browser Network tab** — Monitor API calls

### Backend

- **Console logging** — Express errors are logged to stdout
- **API responses** — All errors return structured JSON
- **TypeORM logging** — Set `logging: true` in `data-source.ts` to see SQL queries

### Common Issues

| Issue | Solution |
| ----- | -------- |
| `ECONNREFUSED` on API | Ensure backend is running on port 4000 |
| CORS errors | Check `CORS_ORIGIN` in backend config |
| `401 Unauthorized` | JWT expired or cookie not set; re-login |
| Seed fails | Check if `backend/data/` directory is writable |
| Port already in use | Change `PORT` in `.env` or kill the process |

---

## Code Style

- **TypeScript** throughout (no `any` types when avoidable)
- **Functional components** with hooks (no class components)
- **Tailwind CSS** for all styling (no CSS modules or styled-components)
- **Named exports** for components and utilities
- **`"use client"`** directive on all client components
- **Zod** for all validation (frontend and backend)
- **No comments** unless explicitly requested
