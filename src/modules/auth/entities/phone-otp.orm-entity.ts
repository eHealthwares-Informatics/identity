import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One-time passcodes issued to mobile shoppers for phone sign-in.
 * Codes are stored hashed; only the latest unconsumed row per phone is valid.
 */
@Entity('phone_otps')
@Index('idx_phone_otps_phone_created', ['phone', 'createdAt'])
export class PhoneOtpOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'text' })
  phone!: string;

  // 'sms' | 'whatsapp'
  @Column({ type: 'text' })
  channel!: string;

  @Column({ name: 'code_hash', type: 'text' })
  codeHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
