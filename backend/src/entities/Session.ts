import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { genUuid } from '../utils/ids';

@Entity('sessions')
export class Session {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ type: 'varchar', length: 40 })
  name!: string;

  @Column({ name: 'exam_date', type: 'varchar', length: 10 })
  examDate!: string;

  @Column({ name: 'start_time', type: 'varchar', length: 5 })
  startTime!: string;

  @Column({ name: 'end_time', type: 'varchar', length: 5 })
  endTime!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
