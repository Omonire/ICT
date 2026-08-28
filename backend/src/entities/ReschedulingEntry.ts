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

export enum RescheduleReason {
  CAPACITY_EXCEEDED = 'capacity_exceeded',
  NO_AVAILABLE_SESSION = 'no_available_session',
  SCHEDULING_CONFLICT = 'scheduling_conflict',
  NO_COMPATIBLE_HALL = 'no_compatible_hall',
  SEAT_SPACING_CONSTRAINT = 'seat_spacing_constraint',
  OTHER = 'other',
}

export enum RescheduleStatus {
  PENDING = 'pending',
  RESCHEDULED = 'rescheduled',
  EXCLUDED = 'excluded',
}

@Entity('rescheduling_entries')
@Index('IDX_reschedule_candidate', ['candidateId'])
@Index('IDX_reschedule_status', ['status'])
export class ReschedulingEntry {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ name: 'candidate_id', type: 'varchar' })
  candidateId!: string;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: Candidate;

  @Column({ name: 'scheduling_run_id', type: 'varchar', nullable: true })
  schedulingRunId: string | null = null;

  @Column({ name: 'subject_combination', type: 'varchar', length: 500 })
  subjectCombination!: string;

  @Column({ type: 'varchar', length: 30 })
  reason!: string;

  @Column({ type: 'varchar', length: 20, default: RescheduleStatus.PENDING })
  status: string = RescheduleStatus.PENDING;

  @Column({ name: 'target_session_id', type: 'varchar', nullable: true })
  targetSessionId: string | null = null;

  @Column({ name: 'target_hall_id', type: 'varchar', nullable: true })
  targetHallId: string | null = null;

  @Column({ name: 'target_seat_number', type: 'varchar', nullable: true })
  targetSeatNumber: string | null = null;

  @Column({ name: 'target_exam_date', type: 'varchar', nullable: true })
  targetExamDate: string | null = null;

  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true })
  assignedAt: Date | null = null;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes: string | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
