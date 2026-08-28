import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('custom_combinations')
export class CustomCombination {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  id!: string;

  @Column({ type: 'varchar', length: 255, name: 'display_name' })
  displayName!: string;

  @Column({ type: 'jsonb', name: 'subjects' })
  subjects!: string[];

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'career_group_id' })
  careerGroupId!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true, name: 'first_choice' })
  firstChoice!: string | null;

  @Column({ type: 'int', default: 0, name: 'candidate_count' })
  candidateCount!: number;

  @Column({ type: 'varchar', length: 160, name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
