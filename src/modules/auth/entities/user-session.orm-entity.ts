import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** How the session was established. */
export type LoginMethod =
  | 'password'
  | 'otp'
  | 'oauth_google'
  | 'oauth_facebook'
  | 'unknown';

/** Which client established the session. */
export type SessionChannel = 'console' | 'website' | 'shopper' | 'emr' | 'unknown';

/** Why a session stopped being usable. */
export type SessionEndReason =
  | 'logout'
  | 'logout_all'
  | 'password_change'
  | 'user_deactivated'
  | 'refresh_reuse'
  | 'admin_revoked';

/**
 * One row per login — the auditable lifetime of a session:
 *
 *   login (when, from where, how)
 *     → refresh* (last time + count + ip)
 *     → logout (when, why, from where)
 *
 * The row is never deleted with the user: audits outlive the account, so
 * `user_id` is a plain indexed uuid (no FK / cascade). `refresh_token_jti`
 * correlates the row with the rotation chain: every rotation replaces the
 * stored jti, which is how refresh/logout find the session from the token.
 */
@Entity('user_sessions')
@Index('idx_user_sessions_user', ['userId', 'loginAt'])
@Index('idx_user_sessions_jti', ['refreshTokenJti'])
@Index('idx_user_sessions_org', ['organizationId'])
export class UserSessionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** Denormalised so the audit stays readable after the account is removed. */
  @Column({ type: 'text' })
  username!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ type: 'text', default: 'unknown' })
  channel!: SessionChannel;

  @Column({ name: 'login_method', type: 'text', default: 'unknown' })
  loginMethod!: LoginMethod;

  // ── Login ────────────────────────────────────────────────────────────────
  @Column({ name: 'login_at', type: 'timestamptz' })
  loginAt!: Date;

  @Column({ name: 'login_ip', type: 'text', nullable: true })
  loginIp!: string | null;

  @Column({ name: 'login_user_agent', type: 'text', nullable: true })
  loginUserAgent!: string | null;

  // ── Rotations ────────────────────────────────────────────────────────────
  /** jti of the refresh token currently bound to the session. */
  @Column({ name: 'refresh_token_jti', type: 'text', nullable: true })
  refreshTokenJti!: string | null;

  @Column({ name: 'last_refresh_at', type: 'timestamptz', nullable: true })
  lastRefreshAt!: Date | null;

  @Column({ name: 'last_refresh_ip', type: 'text', nullable: true })
  lastRefreshIp!: string | null;

  @Column({ name: 'last_refresh_user_agent', type: 'text', nullable: true })
  lastRefreshUserAgent!: string | null;

  @Column({ name: 'refresh_count', type: 'integer', default: 0 })
  refreshCount!: number;

  /** Hard end: the refresh token lifetime (each rotation pushes it forward). */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  // ── End ──────────────────────────────────────────────────────────────────
  @Column({ name: 'logout_at', type: 'timestamptz', nullable: true })
  logoutAt!: Date | null;

  @Column({ name: 'logout_reason', type: 'text', nullable: true })
  logoutReason!: SessionEndReason | null;

  @Column({ name: 'logout_ip', type: 'text', nullable: true })
  logoutIp!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
