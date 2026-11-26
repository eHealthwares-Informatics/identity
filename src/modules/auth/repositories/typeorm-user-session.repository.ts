import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserSessionOrmEntity } from '../entities/user-session.orm-entity';
import type {
  CreateUserSessionInput,
  EndSessionInput,
  RefreshSessionInput,
  UserSessionListFilters,
  UserSessionRecord,
  UserSessionRepository,
} from './user-session.repository';

const SORTABLE = new Set(['loginAt', 'lastRefreshAt', 'logoutAt', 'createdAt']);
const SORT_COLUMN: Record<string, string> = {
  loginAt: 'session.loginAt',
  lastRefreshAt: 'session.lastRefreshAt',
  logoutAt: 'session.logoutAt',
  createdAt: 'session.createdAt',
};

@Injectable()
export class TypeormUserSessionRepository implements UserSessionRepository {
  constructor(
    @InjectRepository(UserSessionOrmEntity)
    private readonly repo: Repository<UserSessionOrmEntity>
  ) {}

  async create(input: CreateUserSessionInput): Promise<UserSessionRecord> {
    const entity = this.repo.create({
      ...input,
      refreshTokenJti: input.refreshTokenJti,
      lastRefreshAt: null,
      lastRefreshIp: null,
      lastRefreshUserAgent: null,
      refreshCount: 0,
      logoutAt: null,
      logoutReason: null,
      logoutIp: null,
    });
    return this.repo.save(entity);
  }

  findById(id: string): Promise<UserSessionRecord | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByRefreshJti(userId: string, jti: string): Promise<UserSessionRecord | null> {
    return this.repo.findOne({ where: { userId, refreshTokenJti: jti } });
  }

  async recordRefresh(id: string, input: RefreshSessionInput): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(UserSessionOrmEntity)
      .set({
        refreshTokenJti: input.refreshTokenJti,
        lastRefreshAt: input.at,
        lastRefreshIp: input.ip,
        lastRefreshUserAgent: input.userAgent,
        expiresAt: input.expiresAt,
        refreshCount: () => '"refresh_count" + 1',
      })
      .where('id = :id', { id })
      .execute();
  }

  async end(id: string, input: EndSessionInput): Promise<void> {
    // Only close an open session — never overwrite the original end time.
    await this.repo.update({ id, logoutAt: IsNull() }, {
      logoutAt: input.at,
      logoutReason: input.reason,
      logoutIp: input.ip,
    });
  }

  async endAllForUser(userId: string, input: EndSessionInput): Promise<number> {
    const result = await this.repo.update({ userId, logoutAt: IsNull() }, {
      logoutAt: input.at,
      logoutReason: input.reason,
      logoutIp: input.ip,
    });
    return result.affected ?? 0;
  }

  async list(
    filters: UserSessionListFilters
  ): Promise<{ rows: UserSessionRecord[]; total: number }> {
    const query = this.repo.createQueryBuilder('session');

    if (filters.userId) {
      query.andWhere('session.userId = :userId', { userId: filters.userId });
    }
    if (filters.organizationId) {
      query.andWhere('session.organizationId = :organizationId', {
        organizationId: filters.organizationId,
      });
    }
    if (filters.active === true) {
      query
        .andWhere('session.logoutAt IS NULL')
        .andWhere('session.expiresAt > :now', { now: new Date() });
    }
    if (filters.active === false) {
      query.andWhere(
        '(session.logoutAt IS NOT NULL OR session.expiresAt <= :now)',
        { now: new Date() }
      );
    }
    if (filters.ip) {
      query.andWhere('(session.loginIp = :ip OR session.lastRefreshIp = :ip)', {
        ip: filters.ip,
      });
    }
    if (filters.from) {
      query.andWhere('session.loginAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      query.andWhere('session.loginAt <= :to', { to: filters.to });
    }

    const sortBy = filters.sortBy && SORTABLE.has(filters.sortBy) ? filters.sortBy : 'loginAt';
    query
      .orderBy(SORT_COLUMN[sortBy], filters.sortOrder === 'ASC' ? 'ASC' : 'DESC')
      .skip(filters.offset)
      .take(filters.limit);

    const [rows, total] = await query.getManyAndCount();
    return { rows, total };
  }
}
