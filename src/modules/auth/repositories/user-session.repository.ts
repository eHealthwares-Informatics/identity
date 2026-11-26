import type {
  LoginMethod,
  SessionChannel,
  SessionEndReason,
} from '../entities/user-session.orm-entity';

/** A session row as the application sees it (repository boundary, no TypeORM). */
export type UserSessionRecord = {
  id: string;
  userId: string;
  username: string;
  organizationId: string | null;
  channel: SessionChannel;
  loginMethod: LoginMethod;
  loginAt: Date;
  loginIp: string | null;
  loginUserAgent: string | null;
  refreshTokenJti: string | null;
  lastRefreshAt: Date | null;
  lastRefreshIp: string | null;
  lastRefreshUserAgent: string | null;
  refreshCount: number;
  expiresAt: Date;
  logoutAt: Date | null;
  logoutReason: SessionEndReason | null;
  logoutIp: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateUserSessionInput = {
  userId: string;
  username: string;
  organizationId: string | null;
  channel: SessionChannel;
  loginMethod: LoginMethod;
  loginAt: Date;
  loginIp: string | null;
  loginUserAgent: string | null;
  refreshTokenJti: string | null;
  expiresAt: Date;
};

export type RefreshSessionInput = {
  at: Date;
  ip: string | null;
  userAgent: string | null;
  expiresAt: Date;
  refreshTokenJti: string;
};

export type EndSessionInput = {
  at: Date;
  ip: string | null;
  reason: SessionEndReason;
};

export type UserSessionListFilters = {
  userId?: string;
  organizationId?: string | null;
  /** true = still open (no logout, not expired), false = closed, undefined = both. */
  active?: boolean;
  ip?: string;
  from?: Date;
  to?: Date;
  sortBy?: 'loginAt' | 'lastRefreshAt' | 'logoutAt' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  limit: number;
  offset: number;
};

export interface UserSessionRepository {
  create(input: CreateUserSessionInput): Promise<UserSessionRecord>;
  findById(id: string): Promise<UserSessionRecord | null>;
  findByRefreshJti(userId: string, jti: string): Promise<UserSessionRecord | null>;
  recordRefresh(id: string, input: RefreshSessionInput): Promise<void>;
  end(id: string, input: EndSessionInput): Promise<void>;
  endAllForUser(userId: string, input: EndSessionInput): Promise<number>;
  list(filters: UserSessionListFilters): Promise<{ rows: UserSessionRecord[]; total: number }>;
}
