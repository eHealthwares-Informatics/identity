import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuthActionPurpose = 'password_reset' | 'email_verify';

/**
 * Single-use tokens emailed to website shoppers for password reset and email
 * verification. Tokens are stored hashed; only the latest unconsumed row per
 * user + purpose is valid.
 */
@Entity('auth_action_tokens')
@Index('idx_auth_action_tokens_hash', ['tokenHash'])
export class AuthActionTokenOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  purpose!: AuthActionPurpose;

  @Column({ name: 'token_hash', type: 'text', unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
