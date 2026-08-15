import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { genUuid } from '../utils/ids';

@Entity('halls')
export class Hall {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ type: 'varchar', length: 40, unique: true })
  name!: string;

  @Column({ type: 'int' })
  capacity!: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string = 'active';

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
