import { Column, Entity, PrimaryColumn } from 'typeorm';
import { genUuid } from '../utils/ids';

export enum ScheduleState {
  NONE = 'none',
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
}

@Entity('schedule_meta')
export class ScheduleMeta {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ type: 'varchar', length: 20, default: ScheduleState.NONE })
  status: string = ScheduleState.NONE;

  @Column({ name: 'session_ids', type: 'simple-json', nullable: true })
  sessionIds: string[] | null = null;

  @Column({ name: 'generated_at', type: 'timestamp', nullable: true })
  generatedAt: Date | null = null;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt: Date | null = null;

  @Column({ name: 'confirmed_by', type: 'varchar', nullable: true })
  confirmedBy: string | null = null;

  @Column({ type: 'simple-json', nullable: true })
  summary: Record<string, unknown> | null = null;
}
