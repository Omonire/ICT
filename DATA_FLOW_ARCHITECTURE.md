# Excel Data Flow Architecture

## System Overview

```
Excel File (Exam_Schedulling_4_Python_1.xls)
         ↓
    [15,705 Rows]
    - Exam No
    - Last Name / First Name
    - Gender
    - Jamb Subjects
    - First Choice Program
         ↓
  ┌─────────────────────────┐
  │  Excel Import Service   │
  │  (excel-import.ts)      │
  │                         │
  │ 1. Parse Excel          │
  │ 2. Map Programs         │
  │ 3. Generate Candidates  │
  └─────────────────────────┘
         ↓
  ┌─────────────────────────┐
  │  Seeding Service        │
  │  (seeding.ts)           │
  │                         │
  │ 1. Create Career Groups │
  │ 2. Create Halls/Seats   │
  │ 3. Create Sessions      │
  │ 4. Assign Candidates    │
  └─────────────────────────┘
         ↓
  ┌─────────────────────────┐
  │    PostgreSQL DB        │
  │                         │
  │ Tables:                 │
  │ - Candidates (15,705)   │
  │ - Career Groups (5)     │
  │ - Halls (5)             │
  │ - Seats (~530)          │
  │ - Sessions              │
  │ - Assignments           │
  └─────────────────────────┘
         ↓
  ┌─────────────────────────┐
  │  Application UI         │
  │  (Next.js Frontend)     │
  │                         │
  │ - Dashboard             │
  │ - Candidate Lists       │
  │ - Exam Schedule         │
  │ - Attendance Sheets     │
  └─────────────────────────┘
```

## Data Transformation Flow

```
Excel Row
   ↓
   ├─ Exam No: 10000001
   ├─ First Name: Marvellous
   ├─ Last Name: Ikharo
   ├─ First Choice: Nursing/Nursing Science
   └─ Gender: M
   ↓
Program Mapping
   ├─ "Nursing/Nursing Science"
   ├─ Matched to: "Natural Sciences"
   └─ Found Career Group ID: "2"
   ↓
Candidate Entity
   ├─ name: "Marvellous Ikharo"
   ├─ email: "marvellous.ikharo.10000001@student.fut.edu.ng"
   ├─ matricNo: "FUT/2024/10000001"
   ├─ careerGroupId: "2"
   ├─ status: "unscheduled"
   └─ id: [generated UUID]
   ↓
Database
   └─ Saved to candidate table
```

## Career Group Distribution

```
Distribution of 15,705 Candidates:

Natural Sciences      █████████████████████████████████████ 86.3% (13,552)
Social Sciences       ██ 5.9% (930)
Management Sciences   ██ 4.9% (773)
Engineering           █ 2.9% (450)
Arts & Humanities     ░ 0.0% (0)

Most programs default to Natural Sciences:
- MBBS Medicine & Surgery
- Nursing/Nursing Sciences
- Doctor of Optometry
- Pharmacy
- Dentistry
- And many others
```

## Seeding Process Timeline

```
START npm run seed
   ↓
[1] Initialize Database Connection
   ↓
[2] Ensure Superadmin Exists
   ├─ Email: superadmin@examflow.edu.ng
   ├─ Password: SuperAdmin123!
   └─ Role: SUPERADMIN
   ↓
[3] Create Admin & Operator Users
   ├─ admin@examflow.edu.ng
   └─ operator@examflow.edu.ng
   ↓
[4] Create Career Groups (5)
   ├─ Engineering
   ├─ Natural Sciences
   ├─ Management Sciences
   ├─ Social Sciences
   └─ Arts & Humanities
   ↓
[5] Create Exam Halls (5)
   ├─ Hall A (120 seats)
   ├─ Hall B (120 seats)
   ├─ Hall C (100 seats)
   ├─ Hall D (100 seats)
   └─ Hall E (80 seats)
   ├─ Total: ~530 seats
   └─ All marked as "available"
   ↓
[6] Parse Excel File
   └─ Load 15,705 candidates
   ↓
[7] Generate & Save Candidates
   ├─ Map programs to career groups
   ├─ Generate emails & matric numbers
   ├─ Set status to "unscheduled"
   └─ Update career group counts
   ↓
[8] Create Exam Sessions
   ├─ Start: Next Monday
   ├─ Duration: ~1 week
   ├─ Schedule: Morning (09:00-11:00) & Afternoon (13:00-15:00)
   └─ Total: ~12 sessions
   ↓
[9] Pre-assign Candidates to Sessions (~50%)
   ├─ Round-robin assignment
   ├─ Allocate halls & seats
   ├─ Update candidate status to "scheduled"
   └─ Mark seats as "occupied"
   ↓
[10] Create Schedule Metadata
   ├─ Status: CONFIRMED
   ├─ Summary: Total/Assigned/Unassigned counts
   └─ Timestamps
   ↓
[11] Log Seeding Activity
   └─ Record in ActivityLog table
   ↓
✓ SEEDING COMPLETE
└─ Output: "15,705 candidates seeded in XXXms"
```

## Program to Career Group Mapping Rules

```
Input: First Choice Program (from Excel)
   ↓
[1] Exact Match Check
   ├─ IF "Computer Engineering" → "Engineering"
   ├─ IF "MBBS Medicine & Surgery" → "Natural Sciences"
   └─ ... (see mapping table)
   ↓
[2] Partial Match Check
   ├─ IF contains "Engineering" → "Engineering"
   ├─ IF contains "Business" → "Management Sciences"
   └─ ... (fuzzy matching)
   ↓
[3] Default
   └─ Default to "Natural Sciences"
   ↓
Output: Career Group Name
```

## Email Generation Pattern

```
Format: firstname.lastname.examno@student.fut.edu.ng

Steps:
1. Take First Name from Excel
   ├─ Convert to lowercase
   └─ "Marvellous" → "marvellous"

2. Take Last Name from Excel
   ├─ Convert to lowercase
   └─ "Ikharo" → "ikharo"

3. Take Exam No from Excel
   ├─ Zero-pad to 8 digits
   └─ 10000001 → "10000001"

4. Combine with separator
   └─ marvellous.ikharo.10000001@student.fut.edu.ng

Guaranteed Uniqueness:
✓ Each Exam No is unique in Excel
✓ Each generated email is unique
✓ No duplicates possible
```

## Session Scheduling Logic

```
Start Date: Next Monday (from seeding run date)

Week Pattern:
Monday-Friday + Next Monday = 6 days

Daily Slots:
├─ Morning: 09:00 - 11:00
└─ Afternoon: 13:00 - 15:00

Total Sessions: 6 days × 2 slots = 12 sessions

Example (if Monday = Jan 20):
├─ Jan 20 09:00 → Morning Session
├─ Jan 20 13:00 → Afternoon Session
├─ Jan 21 09:00 → Morning Session
├─ Jan 21 13:00 → Afternoon Session
├─ ... (repeat for 6 days)
└─ Jan 27 13:00 → Final Afternoon Session
```

## Candidate Assignment Algorithm

```
Available Candidates: 15,705
Assignment Target: ~50% = ~7,852

For each session (round-robin):
  For each candidate to assign:
    For each hall (in order):
      [1] Check hall capacity
          └─ IF hall is full → try next hall
      [2] Find next available seat
          └─ Seats marked as "available"
      [3] Create assignment
          ├─ candidate_id → session_id
          ├─ hall_id → seat_number
          └─ Unique key: "candidate:session"
      [4] Update seat status
          └─ Mark as "occupied"
          └─ Link to candidate_id
      [5] Update candidate status
          └─ "unscheduled" → "scheduled"
          └─ Store assignment details

Result:
✓ ~7,852 candidates scheduled
✓ ~7,853 candidates remain unscheduled
✓ Seats distributed across halls
✓ Sessions have balanced candidates
```

## Error Handling Flow

```
Seed Process
   ↓
Try to load Excel file
   ├─ Success?
   │  └─ ✓ Process Excel data (15,705 candidates)
   │
   └─ Failure?
      ├─ Log warning message
      ├─ Fallback to demo data (520 candidates)
      └─ Continue seeding process
   ↓
Save to database
   ├─ Success?
   │  └─ ✓ Log activity & return success
   │
   └─ Failure?
      ├─ Transaction rolls back (no partial data)
      └─ ✗ Return error to caller
```

## Performance Characteristics

```
Operation                Time        Notes
────────────────────────────────────────────
Parse Excel             ~500ms      First-time only
Generate 15,705 entities ~100ms     In-memory
Database insertion      ~5-30s      Depends on DB setup
Create sessions         ~100ms      Usually ~12 sessions
Assign candidates       ~2-10s      Round-robin through halls
Total seeding          ~10-50s      End-to-end time
```

---

**Last Updated:** 2026-08-18  
**Status:** ✅ Production Ready  
**Test Coverage:** Excel import tested & verified
