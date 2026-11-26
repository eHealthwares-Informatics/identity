import { LoginSessionService } from './login-session.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import type {
  UserSessionRecord,
  UserSessionRepository,
} from '../repositories/user-session.repository';

const NOW = new Date('2026-11-25T10:00:00.000Z');
const HOUR = 60 * 60 * 1000;

// Freeze "now" so login/refresh/logout instants and durations are deterministic.
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

function makeRecord(overrides: Partial<UserSessionRecord> = {}): UserSessionRecord {
  return {
    id: 'session-1',
    userId: 'user-1',
    username: 'admin',
    organizationId: 'org-1',
    channel: 'console',
    loginMethod: 'password',
    loginAt: new Date(NOW.getTime() - HOUR),
    loginIp: '203.0.113.7',
    loginUserAgent: 'Firefox/140',
    refreshTokenJti: 'jti-1',
    lastRefreshAt: null,
    lastRefreshIp: null,
    lastRefreshUserAgent: null,
    refreshCount: 0,
    expiresAt: new Date(NOW.getTime() + 24 * HOUR),
    logoutAt: null,
    logoutReason: null,
    logoutIp: null,
    createdAt: new Date(NOW.getTime() - HOUR),
    updatedAt: new Date(NOW.getTime() - HOUR),
    ...overrides,
  };
}

function makeRepo() {
  const repository: jest.Mocked<UserSessionRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByRefreshJti: jest.fn(),
    recordRefresh: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
    endAllForUser: jest.fn().mockResolvedValue(1),
    list: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
  };
  return repository;
}

/**
 * A service plus a `run` helper that executes a call inside the request scope,
 * exactly like the middleware does for a real request.
 */
function build(ip: string | null = null, userAgent: string | null = null) {
  const repository = makeRepo();
  const context = new RequestContextService();
  const service = new LoginSessionService(repository, context);
  const run = <T>(work: () => Promise<T>): Promise<T> =>
    context.run({ ip, userAgent }, work);
  return { repository, service, run };
}

describe('LoginSessionService', () => {
  it('records the login with the request origin', async () => {
    const { repository, service, run } = build('203.0.113.7', 'Firefox/140');
    const record = makeRecord();
    repository.create.mockResolvedValue(record);

    const id = await run(() =>
      service.start({
        userId: 'user-1',
        username: 'admin',
        organizationId: 'org-1',
        channel: 'console',
        loginMethod: 'password',
        refreshTokenJti: 'jti-1',
        expiresAt: record.expiresAt,
      }),
    );

    expect(id).toBe('session-1');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        loginIp: '203.0.113.7',
        loginUserAgent: 'Firefox/140',
        channel: 'console',
        loginMethod: 'password',
        refreshTokenJti: 'jti-1',
        expiresAt: record.expiresAt,
      }),
    );
  });

  it('never fails a login when the audit write fails', async () => {
    const { repository, service, run } = build();
    repository.create.mockRejectedValue(new Error('db down'));

    await expect(
      run(() =>
        service.start({
          userId: 'user-1',
          username: 'admin',
          organizationId: null,
          expiresAt: new Date(NOW.getTime() + HOUR),
        }),
      ),
    ).resolves.toBeNull();
  });

  it('binds the rotation to the session that owned the previous jti', async () => {
    const { repository, service, run } = build('198.51.100.4', 'Chrome/141');
    repository.findByRefreshJti.mockResolvedValue(makeRecord());
    const expiresAt = new Date(NOW.getTime() + 24 * HOUR);

    await run(() =>
      service.recordRefresh('user-1', 'jti-1', {
        refreshTokenJti: 'jti-2',
        expiresAt,
      }),
    );

    expect(repository.findByRefreshJti).toHaveBeenCalledWith('user-1', 'jti-1');
    expect(repository.recordRefresh).toHaveBeenCalledWith('session-1', {
      at: expect.any(Date),
      ip: '198.51.100.4',
      userAgent: 'Chrome/141',
      expiresAt,
      refreshTokenJti: 'jti-2',
    });
  });

  it('ignores a rotation it cannot correlate', async () => {
    const { repository, service, run } = build();
    repository.findByRefreshJti.mockResolvedValue(null);

    await run(() =>
      service.recordRefresh('user-1', 'unknown', {
        refreshTokenJti: 'jti-2',
        expiresAt: new Date(),
      }),
    );
    expect(repository.recordRefresh).not.toHaveBeenCalled();

    // No jti at all (older token) — nothing to do.
    await run(() =>
      service.recordRefresh('user-1', undefined, {
        refreshTokenJti: 'jti-3',
        expiresAt: new Date(),
      }),
    );
    expect(repository.findByRefreshJti).toHaveBeenCalledTimes(1);
  });

  it('closes the session bound to a jti, with the reason and origin', async () => {
    const { repository, service, run } = build('192.0.2.10', 'Safari/18');
    repository.findByRefreshJti.mockResolvedValue(makeRecord());

    await run(() => service.endByRefreshJti('user-1', 'jti-1', 'logout'));

    expect(repository.end).toHaveBeenCalledWith('session-1', {
      at: expect.any(Date),
      ip: '192.0.2.10',
      reason: 'logout',
    });
  });

  it('closes every open session for logout-all / password change', async () => {
    const { repository, service, run } = build();

    await expect(
      run(() => service.endAllForUser('user-1', 'password_change')),
    ).resolves.toBe(1);
    expect(repository.endAllForUser).toHaveBeenCalledWith('user-1', {
      at: expect.any(Date),
      ip: null,
      reason: 'password_change',
    });
  });

  it('lists and maps rows to the API shape', async () => {
    const { repository, service } = build();
    repository.list.mockResolvedValue({ rows: [makeRecord()], total: 1 });

    const { data, total } = await service.list({
      userId: 'user-1',
      active: true,
      limit: 25,
      offset: 0,
    });

    expect(total).toBe(1);
    expect(data[0]).toEqual(
      expect.objectContaining({
        id: 'session-1',
        username: 'admin',
        channel: 'console',
        loginIp: '203.0.113.7',
        refreshCount: 0,
        active: true,
        logoutReason: null,
      }),
    );
    expect(data[0].durationSeconds).toBe(3600);
  });

  it('reports a closed session as inactive with its end reason', () => {
    const { service } = build();
    const logoutAt = new Date(NOW.getTime() - 10 * 60 * 1000);

    const response = service.toResponse(
      makeRecord({ logoutAt, logoutReason: 'logout_all', logoutIp: '203.0.113.7' }),
    );

    expect(response.active).toBe(false);
    expect(response.logoutAt).toBe(logoutAt.toISOString());
    expect(response.logoutReason).toBe('logout_all');
    expect(response.durationSeconds).toBe(60 * 60 - 10 * 60);
  });

  it('treats an expired-but-not-logged-out session as inactive', () => {
    const { service } = build();

    const response = service.toResponse(
      makeRecord({ expiresAt: new Date(Date.now() - 1000) }),
    );

    expect(response.active).toBe(false);
  });
});
