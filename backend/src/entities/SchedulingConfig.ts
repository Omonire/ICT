import { Column, Entity, PrimaryColumn } from 'typeorm';
import { genUuid } from '../utils/ids';

export type TieBreakerRule = 'name_asc' | 'name_desc' | 'id_asc' | 'id_desc' | 'random';

export interface SchedulingRules {
  allowHallReuse: boolean;
  allowSameDayHallReuse: boolean;
  seatSpacingEnabled: boolean;
  seatSpacingGap: number;
  maxCandidatesPerHall: number | null;
  sessionsPerDay: number | null;
  availableDates: string[] | null;
  automaticOverflow: boolean;
  overflowStrategy: 'sequential' | 'balanced';
  minBreakBetweenSessions: number;
}

export const DEFAULT_SCHEDULING_RULES: SchedulingRules = {
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

@Entity('scheduling_configs')
export class SchedulingConfig {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ type: 'varchar', length: 80, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null = null;

  @Column({ type: 'jsonb' })
  rules: SchedulingRules = DEFAULT_SCHEDULING_RULES;

  @Column({ type: 'boolean', default: false })
  isActive: boolean = false;

  /** Ordered array of normalized subject-combination keys (exam priority). */
  @Column({ name: 'exam_priority_order', type: 'jsonb', nullable: true })
  examPriorityOrder: string[] | null = null;

  /**
   * Map of normalizedKey → ordered array of first-choice programme names.
   * Example: { "chemistry|english|mathematics|physics": ["Computer Science", "Software Engineering", ...] }
   */
  @Column({ name: 'first_choice_priority', type: 'jsonb', nullable: true })
  firstChoicePriority: Record<string, string[]> | null = null;

  /** Admin-selected tie-breaker rule applied when exam + first-choice are equal. */
  @Column({ name: 'tie_breaker', type: 'varchar', length: 30, nullable: true })
  tieBreaker: TieBreakerRule | null = null;

  @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt!: Date;
}
