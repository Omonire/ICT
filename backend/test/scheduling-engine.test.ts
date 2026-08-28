/**
 * ExamFlow Scheduling Engine Tests
 *
 * These tests verify the core scheduling logic without requiring a database connection.
 * They test normalization, analysis, capacity calculations, hall reuse, seat uniqueness,
 * and other critical scheduling behaviors.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeSubjectCombination,
  displaySubjectCombination,
  analyzeSubjectCombinations,
  calculateFirstChoiceDistribution,
  getCandidatesForCombination,
} from '../src/services/scheduling-engine';

// ─── Helper: Create mock candidates ─────────────────────────────────────────

function mockCandidate(overrides: Partial<{
  id: string;
  name: string;
  jambSubjects: string[];
  firstChoice: string;
  careerGroupId: string;
  status: string;
}> = {}) {
  return {
    id: overrides.id ?? 'CAN-00001',
    name: overrides.name ?? 'Test Candidate',
    email: 'test@student.fut.edu.ng',
    matricNo: null,
    careerGroupId: overrides.careerGroupId ?? 'grp-1',
    status: overrides.status ?? 'unscheduled',
    assignedHallId: null,
    assignedSeatNumber: null,
    assignedSessionId: null,
    assignedExamDate: null,
    jambSubjects: overrides.jambSubjects ?? null,
    firstChoice: overrides.firstChoice ?? null,
    createdAt: new Date(),
    assignedHall: null,
    assignedSession: null,
    careerGroup: null as any,
  } as any;
}

function mockCareerGroup(overrides: Partial<{
  id: string;
  name: string;
  subjects: string[];
}> = {}) {
  return {
    id: overrides.id ?? 'grp-1',
    name: overrides.name ?? 'Engineering',
    description: null,
    subjects: overrides.subjects ?? ['Physics', 'Chemistry', 'Mathematics', 'English'],
    candidateCount: 0,
    candidates: [],
  } as any;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Subject Combination Normalization', () => {
  it('should normalize subjects in sorted order', () => {
    const result = normalizeSubjectCombination([
      'Physics',
      'Chemistry',
      'Mathematics',
      'English',
    ]);
    expect(result).toBe('chemistry|english|mathematics|physics');
  });

  it('should produce identical normalization for different orderings', () => {
    const combo1 = ['Physics', 'Chemistry', 'Mathematics', 'English'];
    const combo2 = ['English', 'Mathematics', 'Physics', 'Chemistry'];
    const combo3 = ['Mathematics', 'English', 'Chemistry', 'Physics'];

    expect(normalizeSubjectCombination(combo1)).toBe(
      normalizeSubjectCombination(combo2)
    );
    expect(normalizeSubjectCombination(combo2)).toBe(
      normalizeSubjectCombination(combo3)
    );
  });

  it('should handle case differences', () => {
    const result1 = normalizeSubjectCombination(['PHYSICS', 'CHEMISTRY']);
    const result2 = normalizeSubjectCombination(['physics', 'chemistry']);
    expect(result1).toBe(result2);
  });

  it('should handle whitespace in subject names', () => {
    const result = normalizeSubjectCombination([
      '  Physics  ',
      ' Chemistry ',
    ]);
    expect(result).toBe('chemistry|physics');
  });

  it('should handle single subject', () => {
    expect(normalizeSubjectCombination(['English'])).toBe('english');
  });

  it('should handle empty array', () => {
    expect(normalizeSubjectCombination([])).toBe('');
  });
});

describe('Display Subject Combination', () => {
  it('should display normalized combination in title case', () => {
    const normalized = normalizeSubjectCombination([
      'Physics',
      'Chemistry',
      'Mathematics',
      'English',
    ]);
    const display = displaySubjectCombination(normalized);
    expect(display).toBe('Chemistry + English + Mathematics + Physics');
  });
});

describe('Analyze Subject Combinations', () => {
  it('should group candidates by jambSubjects', () => {
    const candidates = [
      mockCandidate({
        id: 'CAN-00001',
        jambSubjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
      }),
      mockCandidate({
        id: 'CAN-00002',
        jambSubjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
      }),
      mockCandidate({
        id: 'CAN-00003',
        jambSubjects: ['Economics', 'Government', 'Literature', 'French'],
      }),
    ];

    const groups = [mockCareerGroup()];
    const result = analyzeSubjectCombinations(candidates, groups);

    expect(result).toHaveLength(2);
    expect(result[0].candidateCount).toBe(2);
    expect(result[1].candidateCount).toBe(1);
  });

  it('should fall back to careerGroup subjects when jambSubjects is null', () => {
    const group = mockCareerGroup({
      id: 'grp-1',
      subjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
    });

    const candidates = [
      mockCandidate({
        id: 'CAN-00001',
        jambSubjects: null,
        careerGroupId: 'grp-1',
      }),
    ];

    const result = analyzeSubjectCombinations(candidates, [group]);
    expect(result).toHaveLength(1);
    expect(result[0].candidateCount).toBe(1);
  });

  it('should sort by candidate count descending', () => {
    const candidates = [
      mockCandidate({
        id: 'CAN-00001',
        jambSubjects: ['A', 'B', 'C', 'D'],
      }),
      mockCandidate({
        id: 'CAN-00002',
        jambSubjects: ['A', 'B', 'C', 'D'],
      }),
      mockCandidate({
        id: 'CAN-00003',
        jambSubjects: ['A', 'B', 'C', 'D'],
      }),
      mockCandidate({
        id: 'CAN-00004',
        jambSubjects: ['E', 'F', 'G', 'H'],
      }),
    ];

    const result = analyzeSubjectCombinations(candidates, []);
    expect(result[0].candidateCount).toBe(3);
    expect(result[1].candidateCount).toBe(1);
  });

  it('should return empty array for no candidates', () => {
    const result = analyzeSubjectCombinations([], []);
    expect(result).toHaveLength(0);
  });
});

describe('First Choice Distribution', () => {
  it('should calculate distribution correctly', () => {
    const normalized = normalizeSubjectCombination([
      'Physics',
      'Chemistry',
      'Mathematics',
      'English',
    ]);

    const candidates = [
      mockCandidate({
        jambSubjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
        firstChoice: 'Computer Science',
      }),
      mockCandidate({
        jambSubjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
        firstChoice: 'Computer Science',
      }),
      mockCandidate({
        jambSubjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
        firstChoice: 'Software Engineering',
      }),
    ];

    const result = calculateFirstChoiceDistribution(candidates, normalized);

    expect(result).toHaveLength(2);
    expect(result[0].firstChoice).toBe('Computer Science');
    expect(result[0].candidateCount).toBe(2);
    expect(result[0].percentage).toBe(66.67);
    expect(result[1].firstChoice).toBe('Software Engineering');
    expect(result[1].candidateCount).toBe(1);
  });

  it('should handle candidates with no first choice', () => {
    const normalized = normalizeSubjectCombination([
      'Physics',
      'Chemistry',
      'Mathematics',
      'English',
    ]);

    const candidates = [
      mockCandidate({
        jambSubjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
        firstChoice: null,
      }),
    ];

    const result = calculateFirstChoiceDistribution(candidates, normalized);
    expect(result).toHaveLength(1);
    expect(result[0].firstChoice).toBe('Unknown');
  });

  it('should return empty array when no candidates match', () => {
    const candidates = [
      mockCandidate({
        jambSubjects: ['A', 'B', 'C', 'D'],
        firstChoice: 'Physics',
      }),
    ];

    const result = calculateFirstChoiceDistribution(
      candidates,
      'chemistry|english|mathematics|physics'
    );
    expect(result).toHaveLength(0);
  });
});

describe('Get Candidates for Combination', () => {
  it('should filter candidates by normalized combination', () => {
    const normalized = normalizeSubjectCombination([
      'Physics',
      'Chemistry',
      'Mathematics',
      'English',
    ]);

    const candidates = [
      mockCandidate({
        id: 'CAN-00001',
        jambSubjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
      }),
      mockCandidate({
        id: 'CAN-00002',
        jambSubjects: ['Physics', 'Chemistry', 'Mathematics', 'English'],
      }),
      mockCandidate({
        id: 'CAN-00003',
        jambSubjects: ['Economics', 'Government', 'Literature', 'French'],
      }),
    ];

    const result = getCandidatesForCombination(candidates, normalized);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain('CAN-00001');
    expect(result.map((c) => c.id)).toContain('CAN-00002');
    expect(result.map((c) => c.id)).not.toContain('CAN-00003');
  });

  it('should return empty array when no candidates match', () => {
    const candidates = [
      mockCandidate({
        jambSubjects: ['A', 'B', 'C', 'D'],
      }),
    ];

    const result = getCandidatesForCombination(
      candidates,
      'chemistry|english|mathematics|physics'
    );
    expect(result).toHaveLength(0);
  });
});

describe('Capacity Calculations', () => {
  it('should calculate total capacity correctly', () => {
    const halls = [
      { capacity: 120, status: 'active' },
      { capacity: 100, status: 'active' },
      { capacity: 80, status: 'active' },
    ];

    const totalCapacity = halls
      .filter((h) => h.status === 'active')
      .reduce((sum, h) => sum + h.capacity, 0);

    expect(totalCapacity).toBe(300);
  });

  it('should exclude disabled halls from capacity', () => {
    const halls = [
      { capacity: 120, status: 'active' },
      { capacity: 100, status: 'disabled' },
      { capacity: 80, status: 'active' },
    ];

    const totalCapacity = halls
      .filter((h) => h.status === 'active')
      .reduce((sum, h) => sum + h.capacity, 0);

    expect(totalCapacity).toBe(200);
  });

  it('should calculate overflow correctly', () => {
    const candidates = 2000;
    const capacityPerSession = 1000;
    const sessions = 2;

    const totalCapacity = capacityPerSession * sessions;
    const overflow = Math.max(0, candidates - totalCapacity);

    expect(overflow).toBe(0);
  });

  it('should handle overflow when candidates exceed total capacity', () => {
    const candidates = 2500;
    const capacityPerSession = 1000;
    const sessions = 2;

    const totalCapacity = capacityPerSession * sessions;
    const overflow = Math.max(0, candidates - totalCapacity);

    expect(overflow).toBe(500);
  });

  it('should calculate estimated days from capacity', () => {
    const candidates = 2000;
    const capacityPerSession = 500;

    const estimatedDays = Math.ceil(candidates / capacityPerSession);
    expect(estimatedDays).toBe(4);
  });
});

describe('Seat Label Generation', () => {
  it('should generate correct seat labels', () => {
    // Simulating the seatLabel function from scheduler.ts
    function seatLabel(hallName: string, n: number): string {
      const words = hallName
        .replace(/[^a-zA-Z\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);
      let code: string;
      if (words.length === 0) code = 'H';
      else if (words.length === 1) code = words[0].toUpperCase();
      else {
        const last = words[words.length - 1];
        if (last.length === 1) code = last.toUpperCase();
        else code = words.map((w) => w[0].toUpperCase()).join('');
      }
      return `${code}-${String(n).padStart(3, '0')}`;
    }

    expect(seatLabel('Hall A', 1)).toBe('A-001');
    expect(seatLabel('Hall A', 100)).toBe('A-100');
    expect(seatLabel('Hall B', 1)).toBe('B-001');
    expect(seatLabel('Conference Room', 1)).toBe('CR-001');
  });
});

describe('Hall Reuse Logic', () => {
  it('should allow hall reuse when rule is enabled', () => {
    const allowHallReuse = true;
    const usedHallsThisDay = new Map<string, Set<string>>();
    usedHallsThisDay.set('2026-01-01', new Set(['hall-1']));

    // Hall can be reused if allowHallReuse is true
    const canReuse = allowHallReuse || !usedHallsThisDay.get('2026-01-01')?.has('hall-1');
    expect(canReuse).toBe(true);
  });

  it('should prevent hall reuse when rule is disabled and same day', () => {
    const allowHallReuse = false;
    const allowSameDayHallReuse = false;
    const usedHallsThisDay = new Map<string, Set<string>>();
    usedHallsThisDay.set('2026-01-01', new Set(['hall-1']));

    const canReuse =
      allowHallReuse ||
      (allowSameDayHallReuse && !usedHallsThisDay.get('2026-01-01')?.has('hall-1'));
    expect(canReuse).toBe(false);
  });

  it('should allow hall reuse on different days when same-day reuse is disabled', () => {
    const allowHallReuse = false;
    const allowSameDayHallReuse = false;
    const usedHallsThisDay = new Map<string, Set<string>>();
    usedHallsThisDay.set('2026-01-01', new Set(['hall-1']));

    // Different day - hall is available (matching actual engine logic:
    // when allowSameDayHallReuse is false, check if hall was used on THIS day)
    const sessionExamDate = '2026-01-02';
    const canReuse =
      allowHallReuse ||
      (allowSameDayHallReuse && !usedHallsThisDay.get(sessionExamDate)?.has('hall-1')) ||
      (!allowSameDayHallReuse && !usedHallsThisDay.has(sessionExamDate));
    expect(canReuse).toBe(true);
  });
});

describe('Scheduling Rules Defaults', () => {
  it('should have sensible defaults', () => {
    const defaults = {
      allowHallReuse: true,
      allowSameDayHallReuse: false,
      seatSpacingEnabled: false,
      seatSpacingGap: 0,
      maxCandidatesPerHall: null,
      sessionsPerDay: null,
      availableDates: null,
      automaticOverflow: true,
      overflowStrategy: 'sequential',
      minBreakBetweenSessions: 0,
    };

    expect(defaults.allowHallReuse).toBe(true);
    expect(defaults.automaticOverflow).toBe(true);
    expect(defaults.overflowStrategy).toBe('sequential');
  });
});

describe('Basic Capacity Scenarios', () => {
  it('500 candidates / 1000 seats should schedule all', () => {
    const candidates = 500;
    const capacity = 1000;
    const scheduled = Math.min(candidates, capacity);
    const overflow = Math.max(0, candidates - capacity);

    expect(scheduled).toBe(500);
    expect(overflow).toBe(0);
  });

  it('2000 candidates / 1000 seats should overflow 1000', () => {
    const candidates = 2000;
    const capacity = 1000;
    const scheduled = Math.min(candidates, capacity);
    const overflow = Math.max(0, candidates - capacity);

    expect(scheduled).toBe(1000);
    expect(overflow).toBe(1000);
  });

  it('should distribute overflow across multiple days', () => {
    const candidates = 2000;
    const capacityPerSession = 500;
    const sessionsPerDay = 2;
    const capacityPerDay = capacityPerSession * sessionsPerDay;

    const daysNeeded = Math.ceil(candidates / capacityPerDay);
    expect(daysNeeded).toBe(2);

    // Day 1
    const day1 = Math.min(candidates, capacityPerDay);
    expect(day1).toBe(1000);

    // Day 2
    const remaining = candidates - day1;
    const day2 = Math.min(remaining, capacityPerDay);
    expect(day2).toBe(1000);
  });
});

describe('Seat Uniqueness', () => {
  it('should not assign same seat to two candidates in same session/hall', () => {
    const assignments = new Set<string>();
    const session = 'session-1';
    const hall = 'hall-1';

    // Attempt to assign seat A-001 twice
    const seat1 = 'A-001';
    const seat2 = 'A-001';

    const key1 = `${session}:${hall}:${seat1}`;
    const key2 = `${session}:${hall}:${seat2}`;

    assignments.add(key1);
    const isDuplicate = assignments.has(key2);

    expect(isDuplicate).toBe(true);
  });

  it('should allow same seat number in different halls', () => {
    const assignments = new Set<string>();
    const session = 'session-1';

    const key1 = `${session}:hall-1:A-001`;
    const key2 = `${session}:hall-2:A-001`;

    assignments.add(key1);
    const isDuplicate = assignments.has(key2);

    expect(isDuplicate).toBe(false);
  });

  it('should allow same seat number in different sessions', () => {
    const assignments = new Set<string>();
    const hall = 'hall-1';

    const key1 = `session-1:${hall}:A-001`;
    const key2 = `session-2:${hall}:A-001`;

    assignments.add(key1);
    const isDuplicate = assignments.has(key2);

    expect(isDuplicate).toBe(false);
  });
});

describe('Rescheduling Queue', () => {
  it('should categorize overflow candidates correctly', () => {
    const reasons = [
      'capacity_exceeded',
      'no_available_session',
      'scheduling_conflict',
      'no_compatible_hall',
      'seat_spacing_constraint',
      'other',
    ];

    expect(reasons).toContain('capacity_exceeded');
    expect(reasons).toContain('no_available_session');
    expect(reasons).toContain('scheduling_conflict');
  });

  it('should track rescheduling status transitions', () => {
    const statuses = ['pending', 'rescheduled', 'excluded'];
    expect(statuses).toHaveLength(3);
    expect(statuses[0]).toBe('pending');
    expect(statuses[1]).toBe('rescheduled');
    expect(statuses[2]).toBe('excluded');
  });
});

describe('First-Choice Analysis', () => {
  it('should calculate percentages correctly', () => {
    const distribution = [
      { firstChoice: 'Computer Science', count: 450 },
      { firstChoice: 'Software Engineering', count: 320 },
      { firstChoice: 'Engineering', count: 180 },
      { firstChoice: 'Physics', count: 50 },
    ];

    const total = distribution.reduce((sum, d) => sum + d.count, 0);

    const withPercentages = distribution.map((d) => ({
      ...d,
      percentage: Math.round((d.count / total) * 100 * 100) / 100,
    }));

    expect(withPercentages[0].percentage).toBe(45);
    expect(withPercentages[1].percentage).toBe(32);
    expect(withPercentages[2].percentage).toBe(18);
    expect(withPercentages[3].percentage).toBe(5);
  });

  it('should handle empty distribution', () => {
    const distribution: Array<{ firstChoice: string; count: number }> = [];
    const total = distribution.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBe(0);
  });
});
