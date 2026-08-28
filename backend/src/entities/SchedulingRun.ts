import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { genUuid } from '../utils/ids';

export enum SchedulingRunStatus {
  PREVIEW = 'preview',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
  PUBLISHED = 'published',
}

@Entity('scheduling_runs')
@Index('IDX_scheduling_run_status', ['status'])
@Index('IDX_scheduling_run_combination', ['subjectCombination'])
export class SchedulingRun {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ name: 'subject_combination', type: 'varchar', length: 500 })
  subjectCombination!: string;

  @Column({ name: 'career_group_id', type: 'varchar', nullable: true })
  careerGroupId: string | null = null;

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

  @Column({ type: 'varchar', length: 20, default: SchedulingRunStatus.PREVIEW })
  status: string = SchedulingRunStatus.PREVIEW;

  @Column({ name: 'config_used', type: 'jsonb', nullable: true })
  configUsed: Record<string, unknown> | null = null;

  @Column({ type: 'jsonb', nullable: true })
  summary: Record<string, unknown> | null = null;

  @Column({ name: 'session_ids', type: 'jsonb', nullable: true })
  sessionIds: string[] | null = null;

  @Column({ name: 'hall_ids', type: 'jsonb', nullable: true })
  hallIds: string[] | null = null;

  @Column({ name: 'generated_by', type: 'varchar', nullable: true })
  generatedBy: string | null = null;

  @Column({ name: 'error_message', type: 'varchar', length: 1000, nullable: true })
  errorMessage: string | null = null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null = null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null = null;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null = null;

  @Column({ name: 'published_by', type: 'varchar', nullable: true })
  publishedBy: string | null = null;

  /** Whether this run has been published (immutable historical record). */
  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean = false;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
