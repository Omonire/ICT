import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CareerGroup } from './CareerGroup';
import { Hall } from './Hall';
import { Session } from './Session';

export enum CandidateStatus {
  UNSCHEDULED = 'unscheduled',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
}

@Entity('candidates')
@Index('IDX_candidates_career_group', ['careerGroupId'])
@Index('IDX_candidates_email', ['email'], { unique: true })
@Index('IDX_candidates_status', ['status'])
export class Candidate {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  matricNo!: string | null;

  @Column({ name: 'career_group_id', type: 'varchar' })
  careerGroupId!: string;

  @ManyToOne(() => CareerGroup, (g) => g.candidates, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'career_group_id' })
  careerGroup!: CareerGroup;

  @Column({ type: 'varchar', length: 20, default: CandidateStatus.UNSCHEDULED })
  status: string = CandidateStatus.UNSCHEDULED;

  @Column({ name: 'assigned_hall_id', type: 'varchar', nullable: true })
  assignedHallId: string | null = null;

  @Column({ name: 'assigned_seat_number', type: 'varchar', nullable: true })
  assignedSeatNumber: string | null = null;

  @Column({ name: 'assigned_session_id', type: 'varchar', nullable: true })
  assignedSessionId: string | null = null;

  @Column({ name: 'assigned_exam_date', type: 'varchar', nullable: true })
  assignedExamDate: string | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Hall, { nullable: true })
  @JoinColumn({ name: 'assigned_hall_id' })
  assignedHall!: Hall | null;

  @ManyToOne(() => Session, { nullable: true })
  @JoinColumn({ name: 'assigned_session_id' })
  assignedSession!: Session | null;
}
