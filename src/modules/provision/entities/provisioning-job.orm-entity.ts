import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  ProvisionJobStatus,
  ProvisionStageName,
  ProvisionStageState,
} from '../provision-job.types';

/**
 * Durable state for one organisation provision. The row is created before the
 * 202 is returned, so a container restart can find and resume the job.
 */
@Entity('provisioning_jobs')
export class ProvisioningJobOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'organization_code', type: 'text' })
  organizationCode!: string;

  @Column({ type: 'text', default: 'pending' })
  status!: ProvisionJobStatus;

  @Column({ type: 'text', nullable: true })
  stage!: ProvisionStageName | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  stages!: ProvisionStageState[];

  /**
   * Per-stage resume cursor (last committed item id). Kept separately from
   * `stages` so a batch checkpoint is a single small update.
   */
  @Column({ type: 'jsonb', nullable: true })
  cursor!: Record<string, string | null> | null;

  /**
   * Normalised request needed to resume. The password is stored as an
   * already-hashed value — never plaintext.
   */
  @Column({ type: 'jsonb', nullable: true })
  request!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
