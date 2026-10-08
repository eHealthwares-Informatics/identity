import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshTokenOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ON DELETE CASCADE: a refresh token is worthless without its user, and the
  // FK previously had NO ACTION, so `DELETE FROM users` failed (and — in the
  // old, error-swallowing deprovision path — left exactly 4 orphaned users per
  // provisioned organisation, identity#2). The deprovision path also deletes
  // the tokens explicitly, so this is defence in depth for every other caller.
  @ManyToOne('UserOrmEntity', 'refreshTokens', {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: any;

  @Column({ name: 'token_hash', type: 'text', unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
