import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { genUuid } from '../utils/ids';

/**
 * Immutable historical record of a published schedule.
 * Created when an admin publishes a schedule. Never modified after creation.
 */
@Entity('schedule_history')
@Index('IDX_schedule_history_published', ['publishedAt'])
export class ScheduleHistory {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  /** Reference to the originating scheduling run. */
  @Column({ name: 'scheduling_run_id', type: 'varchar' })
  schedulingRunId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null = null;

  /** Snapshot of the subject combination that was published. */
  @Column({ name: 'subject_combination', type: 'varchar', length: 500, nullable: true })
  subjectCombination: string | null = null;

  @Column({ name: 'candidate_count', type: 'int', default: 0 })
  candidateCount: number = 0;

  @Column({ name: 'scheduled_count', type: 'int', default: 0 })
  scheduledCount: number = 0;

  @Column({ name: 'overflow_count', type: 'int', default: 0 })
  overflowCount: number = 0;

  @Column({ name: 'conflict_count', type: 'int', default: 0 })
  conflictCount: number = 0;

  @Column({ name: 'day_count', type: 'int', default: 0 })
  dayCount: number = 0;

  /**
   * Full JSON snapshot of all assignments at publish time.
   * Structure: { dayNumber, date, sessions: [{ session, halls: [{ hall, seats: [{candidateId, candidateName, seatNumber}] }] }] }
   */
  @Column({ type: 'jsonb', nullable: true })
  snapshot: Record<string, unknown> | null = null;

  /** Snapshot of the scheduling config used. */
  @Column({ name: 'config_snapshot', type: 'jsonb', nullable: true })
  configSnapshot: Record<string, unknown> | null = null;

  @Column({ name: 'published_by', type: 'varchar', nullable: true })
  publishedBy: string | null = null;

  @Column({ name: 'published_at', type: 'timestamp' })
  publishedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
