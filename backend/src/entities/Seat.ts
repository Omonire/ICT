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
import { Hall } from './Hall';

export enum SeatStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
}

@Entity('seats')
@Index('IDX_seats_hall_seat', ['hallId', 'seatNumber'], { unique: true })
export class Seat {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ name: 'hall_id', type: 'varchar' })
  hallId!: string;

  @ManyToOne(() => Hall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hall_id' })
  hall!: Hall;

  @Column({ name: 'seat_number', type: 'varchar', length: 16 })
  seatNumber!: string;

  @Column({ type: 'varchar', length: 20, default: SeatStatus.AVAILABLE })
  status: string = SeatStatus.AVAILABLE;

  @Column({ name: 'candidate_id', type: 'varchar', nullable: true })
  candidateId: string | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
