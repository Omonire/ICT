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
import { Hall } from './Hall';
import { Session } from './Session';

@Entity('candidate_assignments')
@Index('IDX_assignments_session_hall_seat', ['sessionId', 'hallId', 'seatNumber'], {
  unique: true,
})
@Index('IDX_assignments_candidate', ['candidateId'], { unique: true })
export class CandidateAssignment {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ name: 'candidate_id', type: 'varchar' })
  candidateId!: string;

  @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: Candidate;

  @Column({ name: 'session_id', type: 'varchar' })
  sessionId!: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: Session;

  @Column({ name: 'hall_id', type: 'varchar' })
  hallId!: string;

  @ManyToOne(() => Hall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hall_id' })
  hall!: Hall;

  @Column({ name: 'seat_number', type: 'varchar', length: 16 })
  seatNumber!: string;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt!: Date;
}
