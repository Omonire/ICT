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
import { User } from './User';

@Entity('activity_logs')
@Index('IDX_activity_timestamp', ['timestamp'])
@Index('IDX_activity_action', ['action'])
export class ActivityLog {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ type: 'varchar', length: 40 })
  action!: string;

  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId: string | null = null;

  @ManyToOne(() => User, (u) => u.activityLogs, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 40, nullable: true })
  entityType: string | null = null;

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId: string | null = null;

  @Column({ name: 'details', type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null = null;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp!: Date;
}
