export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { genUuid } from '../utils/ids';
import { ActivityLog } from './ActivityLog';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ type: 'varchar', length: 160, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password!: string;

  @Column({ type: 'varchar', length: 20, default: UserRole.OPERATOR })
  role: string = UserRole.OPERATOR;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => ActivityLog, (log) => log.user)
  activityLogs!: ActivityLog[];

  toSafeJSON() {
    const { password, ...safe } = this;
    return safe;
  }
}
