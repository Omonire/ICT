# API Reference

ExamFlow's backend exposes a RESTful API under `/api` on port **4000** (default). All responses use JSON. Authentication is via httpOnly cookies or `Authorization: Bearer <token>` header.

---

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Pagination](#pagination)
- [Health Check](#health-check)
- [Auth Endpoints](#auth-endpoints)
- [Candidate Endpoints](#candidate-endpoints)
- [Hall Endpoints](#hall-endpoints)
- [Seat Endpoints](#seat-endpoints)
- [Session Endpoints](#session-endpoints)
- [Career Group Endpoints](#career-group-endpoints)
- [Schedule Endpoints](#schedule-endpoints)
- [Attendance Endpoints](#attendance-endpoints)
- [Analytics Endpoints](#analytics-endpoints)
- [Activity Log Endpoints](#activity-log-endpoints)
- [Admin Endpoints](#admin-endpoints)

---

## Authentication

JWT tokens are stored in httpOnly cookies (7-day expiry) or passed via `Authorization: Bearer <token>`.

**Payload:**
```json
{
  "sub": "user-uuid",
  "email": "admin@examflow.edu.ng",
  "role": "admin"
}
```

**Roles (ascending privilege):**
1. `viewer` — read-only access
2. `operator` — can create/edit candidates, halls, sessions, generate schedules
3. `admin` — can delete records, manage attendance
4. `superadmin` — system-level controls (purge, seed, maintenance, user management)

---

## Error Handling

All errors follow a consistent structure:

```json
{
  "error": "Error message",
  "statusCode": 400,
  "details": {}
}
```

| Status Code | Meaning                          |
| ----------- | -------------------------------- |
| 400         | Validation error / bad request   |
| 401         | Not authenticated                |
| 403         | Insufficient permissions         |
| 404         | Resource not found               |
| 409         | Conflict (e.g., duplicate)       |
| 500         | Internal server error            |

---

## Pagination

List endpoints support query parameters:

| Parameter  | Default | Description                        |
| ---------- | ------- | ---------------------------------- |
| `page`     | `1`     | Page number (1-indexed)            |
| `limit`    | `20`    | Items per page (max 100)           |
| `search`   | —       | Free-text search                   |
| `sortBy`   | —       | Sort field                         |
| `sortDir`  | `ASC`   | Sort direction (`ASC` or `DESC`)   |

**Paginated response:**
```json
{
  "data": [...],
  "total": 520,
  "page": 1,
  "limit": 20,
  "totalPages": 26
}
```

---

## Health Check

```
GET /api/health
```

**Response:**
```json
{ "status": "ok", "timestamp": "2026-08-16T12:00:00.000Z" }
```

---

## Auth Endpoints

### POST /api/auth/login

Authenticate a user and set a JWT cookie.

**Request:**
```json
{
  "email": "admin@examflow.edu.ng",
  "password": "Admin123!"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "admin@examflow.edu.ng",
    "name": "Admin User",
    "role": "admin"
  }
}
```

### POST /api/auth/logout

Clear the authentication cookie.

**Response:** `{ "message": "Logged out" }`

### GET /api/auth/me

Get the currently authenticated user.

**Auth:** Required (any role)

**Response:**
```json
{
  "id": "uuid",
  "email": "admin@examflow.edu.ng",
  "name": "Admin User",
  "role": "admin"
}
```

---

## Candidate Endpoints

### GET /api/candidates

List candidates with pagination, search, and filtering.

**Query Parameters:** `page`, `limit`, `search`, `sortBy`, `sortDir`, `careerGroupId`, `status`

**Response:**
```json
{
  "data": [
    {
      "id": "CAN-00001",
      "name": "Adebayo Johnson",
      "email": "adebayo@stu.edu.ng",
      "matric_no": "CS/2024/001",
      "careerGroupId": "uuid",
      "careerGroup": { "id": "uuid", "name": "Computer Science" },
      "status": "scheduled",
      "assignedHallId": "uuid",
      "assignedSessionId": "uuid",
      "assignedSeatNumber": "A-015",
      "assignedExamDate": "2026-09-01"
    }
  ],
  "total": 520,
  "page": 1,
  "limit": 20,
  "totalPages": 26
}
```

### POST /api/candidates

Create a single candidate.

**Auth:** admin/operator

**Request:**
```json
{
  "name": "Adebayo Johnson",
  "email": "adebayo@stu.edu.ng",
  "matric_no": "CS/2024/001",
  "careerGroupId": "uuid"
}
```

### GET /api/candidates/:id

Get a single candidate by ID.

### PUT /api/candidates/:id

Update a candidate.

**Auth:** admin/operator

### DELETE /api/candidates/:id

Delete a candidate.

**Auth:** admin+

### POST /api/candidates/import/preview

Upload a CSV file for import preview. Returns parsed rows with validation errors.

**Auth:** admin/operator

**Request:** `multipart/form-data` with `file` field (CSV)

**Response:**
```json
{
  "totalRows": 100,
  "validRows": 98,
  "errorRows": 2,
  "rows": [
    {
      "row": 1,
      "data": { "name": "...", "email": "...", "matric_no": "...", "career_group": "..." },
      "valid": true
    },
    {
      "row": 2,
      "data": { "name": "..." },
      "valid": false,
      "errors": ["Email is required"]
    }
  ]
}
```

### POST /api/candidates/import/confirm

Commit the previewed CSV import to the database.

**Auth:** admin/operator

**Request:**
```json
{
  "rows": [
    { "name": "...", "email": "...", "matric_no": "...", "career_group": "..." }
  ]
}
```

---

## Hall Endpoints

### GET /api/halls

List all halls.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Hall A",
      "capacity": 200,
      "status": "active",
      "seatCount": 200,
      "occupiedSeats": 150,
      "createdAt": "2026-08-01T00:00:00.000Z"
    }
  ]
}
```

### POST /api/halls

Create a new hall.

**Auth:** admin+

**Request:**
```json
{
  "name": "Hall F",
  "capacity": 300
}
```

Seats are auto-generated on creation.

### GET /api/halls/:id

Get hall detail with all seats (auto-creates seats if missing).

**Response:**
```json
{
  "id": "uuid",
  "name": "Hall A",
  "capacity": 200,
  "status": "active",
  "seats": [
    {
      "id": "uuid",
      "seatNumber": "A-001",
      "status": "available",
      "candidateId": null
    }
  ]
}
```

### PUT /api/halls/:id

Update a hall.

**Auth:** admin+

---

## Seat Endpoints

### GET /api/seats/:hallId

Get all seats for a hall. Optional query param `sessionId` to show seat status for a specific session.

---

## Session Endpoints

### GET /api/sessions

List all exam sessions.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Session 1 - Monday Morning",
      "examDate": "2026-09-01",
      "startTime": "09:00",
      "endTime": "11:00",
      "createdAt": "2026-08-01T00:00:00.000Z"
    }
  ]
}
```

### POST /api/sessions

Create a new session.

**Auth:** admin/operator

**Request:**
```json
{
  "name": "Session 13 - Tuesday Afternoon",
  "examDate": "2026-09-02",
  "startTime": "14:00",
  "endTime": "16:00"
}
```

### GET /api/sessions/:id

Get a single session.

### DELETE /api/sessions/:id

Delete a session. Cascades to remove all assignments and update candidate statuses.

**Auth:** admin+

---

## Career Group Endpoints

### GET /api/career-groups

List all career groups with candidate counts.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Computer Science",
      "description": "B.Sc. Computer Science",
      "subjects": ["CSC101", "CSC201", "CSC301"],
      "candidateCount": 120
    }
  ]
}
```

### POST /api/career-groups

Create a new career group.

**Auth:** admin+

---

## Schedule Endpoints

### GET /api/schedule/status

Get the current schedule state.

**Response:**
```json
{
  "status": "confirmed",
  "sessionIds": ["uuid1", "uuid2"],
  "generatedAt": "2026-08-16T10:00:00.000Z",
  "confirmedAt": "2026-08-16T10:05:00.000Z",
  "confirmedBy": "admin@examflow.edu.ng",
  "summary": {
    "totalCandidates": 520,
    "scheduledCount": 500,
    "unassignedCount": 20,
    "totalHallsUsed": 5,
    "totalSessionsUsed": 12
  }
}
```

### GET /api/schedule/preview

Preview a schedule without persisting. Same response as generate but returns a plan only.

### POST /api/schedule/generate

Generate a new schedule for selected sessions.

**Auth:** admin/operator

**Request:**
```json
{
  "sessionIds": ["uuid1", "uuid2", "uuid3"],
  "strict": false
}
```

**Response:**
```json
{
  "message": "Schedule generated successfully",
  "summary": {
    "totalCandidates": 520,
    "scheduledCount": 500,
    "unassignedCount": 20,
    "assignments": [...],
    "unassigned": [...],
    "perGroup": { "Computer Science": { "scheduled": 115, "total": 120 } },
    "perSession": { "Session 1": { "count": 45, "halls": 2 } }
  }
}
```

### POST /api/schedule/confirm

Confirm a draft schedule (makes it final).

**Auth:** admin/operator

### POST /api/schedule/clear

Clear the current schedule and reset all candidate assignments.

**Auth:** admin+

---

## Attendance Endpoints

### GET /api/attendance-sheets

List generated attendance sheets grouped by session and hall.

### POST /api/attendance-sheets/:sessionId/:hallId/generate

Generate/regenerate an attendance sheet for a specific session+hall combination.

### GET /api/attendance-sheets/:sessionId/:hallId/pdf

Download a PDF attendance sheet (A4, generated with PDFKit).

### GET /api/attendance-sheets/:sessionId/:hallId/html

Get the attendance sheet as a printable HTML page.

### GET /api/attendance-sheets/:id/pdf

Download a previously generated PDF by sheet ID.

---

## Analytics Endpoints

### GET /api/analytics

Get dashboard analytics data.

**Response:**
```json
{
  "overview": {
    "totalCandidates": 520,
    "scheduledCandidates": 500,
    "unscheduledCandidates": 20,
    "totalHalls": 5,
    "totalSessions": 12,
    "totalCareerGroups": 5
  },
  "statusBreakdown": [
    { "status": "scheduled", "count": 500 },
    { "status": "unscheduled", "count": 20 }
  ],
  "hallUtilization": [
    { "name": "Hall A", "capacity": 200, "occupied": 195, "utilization": 97.5 }
  ],
  "sessionLoad": [
    { "name": "Session 1", "candidateCount": 45 }
  ],
  "careerGroupCoverage": [
    { "name": "Computer Science", "total": 120, "scheduled": 115, "coverage": 95.8 }
  ]
}
```

---

## Activity Log Endpoints

### GET /api/activity-log

Get paginated activity log.

**Query Parameters:** `page`, `limit`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "action": "schedule.generate",
      "userId": "uuid",
      "user": { "name": "Admin User", "email": "admin@examflow.edu.ng" },
      "entityType": "schedule",
      "entityId": null,
      "details": { "sessionCount": 12, "scheduledCount": 500 },
      "timestamp": "2026-08-16T10:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

---

## Admin Endpoints

All admin endpoints require **superadmin** role.

### POST /api/admin/purge

Delete all data (candidates, halls, sessions, assignments, schedules).

### POST /api/admin/seed

Reseed the database with demo data.

### POST /api/admin/maintenance

Toggle maintenance mode.

**Request:** `{ "enabled": true }`

### GET /api/admin/users

List all users.

### POST /api/admin/users

Create a new user.

**Request:**
```json
{
  "email": "newuser@examflow.edu.ng",
  "password": "SecurePass123!",
  "name": "New User",
  "role": "operator"
}
```

### PUT /api/admin/users/:id

Update a user.

### DELETE /api/admin/users/:id

Delete a user.

### POST /api/admin/purge-sessions

Delete all sessions.

### POST /api/admin/seed-for-session

Seed candidates for a specific session.

---

## CSV Import Format

The CSV import expects the following columns:

| Column         | Required | Description                      |
| -------------- | -------- | -------------------------------- |
| `name`         | Yes      | Full name of the candidate       |
| `email`        | Yes      | Unique email address             |
| `matric_no`    | No       | Matriculation number             |
| `career_group` | Yes      | Must match an existing career group name |

**Example CSV:**
```csv
name,email,matric_no,career_group
Adebayo Johnson,adebayo@stu.edu.ng,CS/2024/001,Computer Science
Fatima Abdullahi,fatima@stu.edu.ng,CS/2024/002,Computer Science
```
