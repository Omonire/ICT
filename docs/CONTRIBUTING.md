# Contributing Guide

Thank you for your interest in contributing to ExamFlow!

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/ICT.git
   cd ICT
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. **Seed** the database:
   ```bash
   npm run seed
   ```
5. **Start** the dev servers:
   ```bash
   npm run dev
   ```

Open http://localhost:3000 and log in with the default credentials (see README.md).

---

## Branch Naming

Use descriptive branch names:

| Type       | Pattern                     | Example                    |
| ---------- | --------------------------- | -------------------------- |
| Feature    | `feat/description`          | `feat/bulk-delete-candidates` |
| Bug fix    | `fix/description`           | `fix/seat-map-overflow`    |
| Refactor   | `refactor/description`      | `refactor/scheduler-service` |
| Docs       | `docs/description`          | `docs/api-reference`       |
| Test       | `test/description`          | `test/candidate-import`    |

---

## Commit Messages

Follow conventional commits:

```
type(scope): description

feat(candidates): add bulk delete endpoint
fix(schedule): handle empty session list
docs(api): update attendance endpoints
refactor(scheduler): extract seat labeling logic
test(halls): add hall creation tests
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`

---

## Code Style

### General

- **TypeScript** — no `any` types when avoidable
- **No comments** unless explicitly requested
- Use existing libraries and patterns in the codebase

### Frontend (`app/`, `components/`, `lib/`)

- **React functional components** with hooks
- **`"use client"`** directive on all client components
- **Tailwind CSS** for all styling
- **Named exports** for components
- Follow existing component patterns in `components/ui/`

### Backend (`backend/src/`)

- **Express Router** for routes
- **Zod** for validation schemas
- **TypeORM** for database queries
- **Controller → Service → Entity** layering
- **AppError** class for error handling
- **asyncHandler** wrapper for async route handlers

---

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure the project builds:
   ```bash
   npm run typecheck
   npm run build
   ```
4. Commit with a conventional commit message
5. Push to your fork and open a Pull Request
6. Fill in the PR template with:
   - Description of changes
   - Screenshots (for UI changes)
   - Testing steps

### PR Checklist

- [ ] Code builds without errors (`npm run build`)
- [ ] Type-check passes (`npm run typecheck`)
- [ ] No new TypeScript errors or warnings
- [ ] UI changes are responsive
- [ ] API changes include validation (Zod schema)
- [ ] New endpoints have activity logging
- [ ] Database changes are backward-compatible

---

## Project Layout Reference

```
app/                  Next.js App Router pages
components/ui/        Reusable UI primitives
components/dashboard/ Dashboard layout components
components/landing/   Landing page sections
components/auth/      Authentication context
lib/                  Shared utilities and types
backend/src/
  entities/           TypeORM models
  routes/             Express routers
  controllers/        Request handlers
  services/           Business logic
  middleware/         Auth, roles, validation, errors
  schemas/            Zod validation schemas
  utils/              Helper functions
```

---

## Reporting Issues

When reporting bugs, include:

1. **Steps to reproduce** the issue
2. **Expected behavior** vs **actual behavior**
3. **Environment** (OS, Node.js version, browser)
4. **Console errors** or **network responses** if applicable

---

## Feature Requests

For feature requests, describe:

1. The **problem** you're trying to solve
2. Your **proposed solution**
3. Any **alternatives** considered
