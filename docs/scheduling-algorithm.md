# Scheduling Algorithm

The scheduling engine lives in `backend/src/services/scheduler.ts` (`buildPlan` + `generateSchedule`). It turns a set of exam sessions and a pool of candidates into concrete seat assignments (`CandidateAssignment` rows).

## Goals / invariants

1. **No double-booking** — a candidate is assigned to exactly one `(session, hall, seat)`.
2. **No seat conflicts** — a `(session, hall, seat)` triple is assigned at most once.
3. **Capacity respected** — hall occupancy never exceeds capacity.
4. **Career-line packing** — candidates are processed group-by-group (largest career group first) so each programme occupies contiguous blocks of seats and halls.
5. **No silent dropouts** — candidates that no session/hall can absorb are reported as overflow and left `unscheduled`.

## Inputs

- Selected `Session` IDs (from the request body).
- All `Hall` rows (only `status = 'active'` halls are used).
- The full candidate pool minus anyone already holding a seat in a session *outside* the current selection (those are left untouched so they are never double-booked).
- Any pre-existing assignments for the selected sessions (so re-generation is stable).

## Core steps (`buildPlan`)

1. **Prepare ordering**
   - Halls sorted by `capacity DESC` (then name), so seats pack tightly into the biggest rooms first.
   - Sessions sorted by `examDate ASC, startTime ASC` (chronological).
   - Candidates grouped by `careerGroupId`; groups ordered largest-first, then by name.
2. **Seed from existing assignments** — pre-fill the used-counts map (`session → hall → occupied`), the occupied-seat set (`session:hall:seatNumber`), and per-candidate assignment map. This keeps re-generation idempotent.
3. **Allocate** — for each career group, then each candidate, then each session, then each hall:
   - skip the hall if it is already at capacity,
   - compute the next seat label (`A-001`, `A-002`, … based on the hall's occupied count),
   - skip if that exact seat is already taken, otherwise assign and `continue` to the next candidate.
4. **Summarize** — per-group, per-session and per-hall stats plus overflow counts are returned as the `summary`.

## Persistence (`generateSchedule`)

Runs in a single transaction:

1. Validates that all requested sessions exist and at least one active hall is present.
2. Deletes existing assignments for the selected sessions.
3. Inserts the new assignments (PK = `candidateId:sessionId`).
4. Updates each candidate's `status` (`scheduled`/`unscheduled`) plus `assignedHallId`, `assignedSeatNumber`, `assignedSessionId`, `assignedExamDate`.
5. Refreshes the `Seat` inventory for display: all seats reset to `available`, then seats used by the *latest* session per hall are marked `occupied` with the candidate attached.

`strict` mode throws on overflow instead of returning unassigned candidates.

## Overflow behavior

Candidates that cannot be seated stay `unscheduled` and are returned as `unassigned`. The API surfaces the count (`summary.unassignedCount` / `overflowCount`) and the UI shows exactly who could not be seated, so the exam officer can add halls/sessions and re-generate.

## Conflict checking

`computeConflicts` is a pure helper used to validate candidate plans: it reports any duplicate `(session, hall, seat)` keys (`seatClashes`) and any hall over its capacity (`overCapacity`).
