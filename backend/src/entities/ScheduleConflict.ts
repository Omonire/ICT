import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { genUuid } from '../utils/ids';
import { Candidate } from './Candidate';

export enum ConflictType {
  CANDIDATE_SESSION = 'candidate_session',
  CAPACITY_EXCEEDED = 'capacity_exceeded',
  DAILY_SESSION_LIMIT = 'daily_session_limit',
  HALL_UNAVAILABLE = 'hall_unavailable',
  OTHER = 'other',
}

export enum ConflictStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
}

@Entity('schedule_conflicts')
@Index('IDX_conflict_run', ['schedulingRunId'])
@Index('IDX_conflict_status', ['status'])
@Index('IDX_conflict_candidate', ['candidateId'])
export class ScheduleConflict {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ name: 'scheduling_run_id', type: 'varchar', nullable: true })
  schedulingRunId: string | null = null;

  @Column({ name: 'candidate_id', type: 'varchar' })
  candidateId!: string;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: Candidate;

  @Column({ name: 'subject_combination', type: 'varchar', length: 500, nullable: true })
  subjectCombination: string | null = null;

  @Column({ name: 'first_choice', type: 'varchar', length: 160, nullable: true })
  firstChoice: string | null = null;

  @Column({ name: 'conflict_type', type: 'varchar', length: 40 })
  conflictType!: string;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ name: 'assigned_session_id', type: 'varchar', nullable: true })
  assignedSessionId: string | null = null;

  @Column({ name: 'assigned_hall_id', type: 'varchar', nullable: true })
  assignedHallId: string | null = null;

  @Column({ name: 'assigned_exam_date', type: 'varchar', nullable: true })
  assignedExamDate: string | null = null;

  @Column({ name: 'assigned_seat_number', type: 'varchar', nullable: true })
  assignedSeatNumber: string | null = null;

  @Column({ type: 'varchar', length: 20, default: ConflictStatus.OPEN })
  status: string = ConflictStatus.OPEN;

  @Column({ name: 'resolved_by', type: 'varchar', nullable: true })
  resolvedBy: string | null = null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null = null;

  @Column({ name: 'resolution_notes', type: 'varchar', length: 500, nullable: true })
  resolutionNotes: string | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
