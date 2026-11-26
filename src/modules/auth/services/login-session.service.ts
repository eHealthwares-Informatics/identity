import { Inject, Injectable, Logger } from '@nestjs/common';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import type {
  LoginMethod,
  SessionChannel,
  SessionEndReason,
} from '../entities/user-session.orm-entity';
import {
  USER_SESSION_REPOSITORY,
} from './identity.di-tokens';
import type {
  UserSessionListFilters,
  UserSessionRecord,
  UserSessionRepository,
} from '../repositories/user-session.repository';

export type StartSessionInput = {
  userId: string;
  username: string;
  organizationId: string | null;
  channel?: SessionChannel;
  loginMethod?: LoginMethod;
  /** jti of the refresh token issued with this login. */
  refreshTokenJti?: string | null;
  /** Absolute expiry of the refresh token (the hard end of the session). */
  expiresAt: Date;
};

export type SessionResponse = {
  id: string;
  userId: string;
  username: string;
  organizationId: string | null;
  channel: SessionChannel;
  loginMethod: LoginMethod;
  loginAt: string;
  loginIp: string | null;
  loginUserAgent: string | null;
  lastRefreshAt: string | null;
  lastRefreshIp: string | null;
  refreshCount: number;
  expiresAt: string;
  logoutAt: string | null;
  logoutReason: SessionEndReason | null;
  logoutIp: string | null;
  /** Open: not logged out and not past the refresh-token expiry. */
  active: boolean;
  /** Seconds between login and logout (or now, while still open). */
  durationSeconds: number;
};

/**
 * Owns the session audit trail (`user_sessions`): one row per login, updated on
 * every refresh-token rotation and closed on logout.
 *
 * Audit writes must never break authentication, so failures are logged and
 * swallowed — a missing audit row is preferable to a failed login.
 */
@Injectable()
export class LoginSessionService {
  private readonly logger = new Logger(LoginSessionService.name);

  constructor(
    @Inject(USER_SESSION_REPOSITORY)
    private readonly repository: UserSessionRepository,
    private readonly requestContext: RequestContextService
  ) {}

  /** Records a new session and returns its id (null when the audit write failed). */
  async start(input: StartSessionInput): Promise<string | null> {
    try {
      const session = await this.repository.create({
        userId: input.userId,
        username: input.username,
        organizationId: input.organizationId,
        channel: input.channel ?? 'unknown',
        loginMethod: input.loginMethod ?? 'unknown',
        loginAt: new Date(),
        loginIp: this.requestContext.ip(),
        loginUserAgent: this.requestContext.userAgent(),
        refreshTokenJti: input.refreshTokenJti ?? null,
        expiresAt: input.expiresAt,
      });
      return session.id;
    } catch (error) {
      this.logger.warn(
        `Could not record login session for user=${input.userId}: ${String(error)}`
      );
      return null;
    }
  }

  /**
   * A refresh token was rotated: bind the session row to the new jti, stamp the
   * refresh time/ip and extend the expiry.
   */
  async recordRefresh(
    userId: string,
    previousJti: string | null | undefined,
    next: { refreshTokenJti: string; expiresAt: Date }
  ): Promise<void> {
    if (!previousJti) {
      return;
    }
    try {
      const session = await this.repository.findByRefreshJti(userId, previousJti);
      if (!session) {
        return;
      }
      await this.repository.recordRefresh(session.id, {
        at: new Date(),
        ip: this.requestContext.ip(),
        userAgent: this.requestContext.userAgent(),
        expiresAt: next.expiresAt,
        refreshTokenJti: next.refreshTokenJti,
      });
    } catch (error) {
      this.logger.warn(
        `Could not record refresh for user=${userId}: ${String(error)}`
      );
    }
  }

  /** Closes the session bound to a refresh-token jti (sign-out of one session). */
  async endByRefreshJti(
    userId: string,
    jti: string | null | undefined,
    reason: SessionEndReason
  ): Promise<void> {
    if (!jti) {
      return;
    }
    try {
      const session = await this.repository.findByRefreshJti(userId, jti);
      if (!session) {
        return;
      }
      await this.repository.end(session.id, {
        at: new Date(),
        ip: this.requestContext.ip(),
        reason,
      });
    } catch (error) {
      this.logger.warn(
        `Could not close session for user=${userId}: ${String(error)}`
      );
    }
  }

  /** Closes every open session for a user (logout-all, password change, …). */
  async endAllForUser(userId: string, reason: SessionEndReason): Promise<number> {
    try {
      return await this.repository.endAllForUser(userId, {
        at: new Date(),
        ip: this.requestContext.ip(),
        reason,
      });
    } catch (error) {
      this.logger.warn(
        `Could not close sessions for user=${userId}: ${String(error)}`
      );
      return 0;
    }
  }

  async list(
    filters: UserSessionListFilters
  ): Promise<{ data: SessionResponse[]; total: number }> {
    const { rows, total } = await this.repository.list(filters);
    return { data: rows.map((row) => this.toResponse(row)), total };
  }

  async countActive(userId: string): Promise<number> {
    try {
      const { total } = await this.repository.list({
        userId,
        active: true,
        limit: 1,
        offset: 0,
      });
      return total;
    } catch {
      return 0;
    }
  }

  async findLatest(userId: string): Promise<UserSessionRecord | null> {
    try {
      const { rows } = await this.repository.list({
        userId,
        limit: 1,
        offset: 0,
        sortBy: 'loginAt',
        sortOrder: 'DESC',
      });
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  toResponse(row: UserSessionRecord): SessionResponse {
    const end = row.logoutAt ?? new Date();
    return {
      id: row.id,
      userId: row.userId,
      username: row.username,
      organizationId: row.organizationId,
      channel: row.channel,
      loginMethod: row.loginMethod,
      loginAt: row.loginAt.toISOString(),
      loginIp: row.loginIp,
      loginUserAgent: row.loginUserAgent,
      lastRefreshAt: row.lastRefreshAt?.toISOString() ?? null,
      lastRefreshIp: row.lastRefreshIp,
      refreshCount: row.refreshCount,
      expiresAt: row.expiresAt.toISOString(),
      logoutAt: row.logoutAt?.toISOString() ?? null,
      logoutReason: row.logoutReason,
      logoutIp: row.logoutIp,
      active: row.logoutAt === null && row.expiresAt.getTime() > Date.now(),
      durationSeconds: Math.max(
        0,
        Math.round((end.getTime() - row.loginAt.getTime()) / 1000)
      ),
    };
  }
}
