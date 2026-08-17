import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { genUuid } from '../utils/ids';
import { Candidate } from './Candidate';

@Entity('career_groups')
export class CareerGroup {
  @PrimaryColumn({ type: 'varchar' })
  id: string = genUuid();

  @Column({ type: 'varchar', length: 80, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null = null;

  @Column({ type: 'jsonb', nullable: true })
  subjects: string[] = [];

  @Column({ type: 'int', default: 0 })
  candidateCount: number = 0;

  @OneToMany(() => Candidate, (c) => c.careerGroup)
  candidates!: Candidate[];
}
