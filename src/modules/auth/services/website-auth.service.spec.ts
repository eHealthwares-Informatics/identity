import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { WebsiteAuthService } from './website-auth.service';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { User } from '../../users/domains/user.entity';

const TOKEN_PAIR = {
  accessToken: 'at',
  refreshToken: 'rt',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 604800,
};

function makeUser(overrides: Partial<Record<string, unknown>> = {}): User {
  return new User(
    'user-1',
    (overrides.organizationId as string) ?? 'org-1',
    null,
    (overrides.username as string) ?? 'jane',
    'hash',
    true,
    (overrides.roleCodes as string[]) ?? ['admin'],
    [{ permissionCodes: ['users:read'] }],
    undefined,
    (overrides.email as string) ?? undefined,
  );
}

type Harness = {
  service: WebsiteAuthService;
  userRepository: jest.Mocked<UserRepository>;
  roleRepository: jest.Mocked<RoleRepository>;
  tokenIssuer: jest.Mocked<TokenIssuerPort>;
};

function buildHarness(overrides: Record<string, string> = {}): Harness {
  const config = new Map<string, string>(Object.entries(overrides));
  const configService = {
    get: (key: string, fallback?: string) => config.get(key) ?? fallback,
  };

  const userRepository: jest.Mocked<UserRepository> = {
    findByUsername: jest.fn(),
    findByPhone: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
  };

  const roleRepository: jest.Mocked<RoleRepository> = {
    findByCode: jest.fn(),
    findById: jest.fn(),
    listByCodes: jest.fn(),
    listAll: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findLastCreated: jest.fn(),
  };
  // Default: every configured role resolves (linked users re-query their roles).
  roleRepository.listByCodes.mockImplementation(
    async (codes: string[]) => codes.map(() => ({ permissionCodes: [] } as never)),
  );

  const passwordHasher: jest.Mocked<PasswordHasherPort> = {
    verify: jest.fn(),
    hash: jest.fn().mockResolvedValue('hashed'),
  };

  const tokenIssuer: jest.Mocked<TokenIssuerPort> = {
    issuePair: jest.fn().mockResolvedValue(TOKEN_PAIR),
    verifyRefreshToken: jest.fn(),
  };

  const refreshTokenRepository: jest.Mocked<RefreshTokenRepository> = {
    persist: jest.fn().mockResolvedValue(undefined),
    isValid: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const service = new WebsiteAuthService(
    {} as never, // otpRepo — unused by the OAuth paths under test
    userRepository,
    roleRepository,
    passwordHasher,
    tokenIssuer,
    refreshTokenRepository,
    // ConfigService is structural in these tests (get(key, fallback)).
    configService as never,
  );

  return { service, userRepository, roleRepository, tokenIssuer };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('WebsiteAuthService — oauthGoogleSignInForChannel', () => {
  const stubTokenInfo = (payload: Record<string, unknown>) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => payload,
      } as never);
  };

  // Hard-coded fallback client id in the service (no env override in tests).
  const WEB_CLIENT_ID =
    '763036387173-jml5o3iauj2ms5269dqf7qq24gplh6mq.apps.googleusercontent.com';

  it('links an existing account of any role by verified email', async () => {
    const harness = buildHarness({ SHOPPER_DEFAULT_ORGANIZATION_ID: 'org-1' });
    const staff = makeUser({ email: 'topzy20@gmail.com', username: 'alice', roleCodes: ['pharmacy_admin'] });
    harness.userRepository.findByEmail.mockResolvedValue(staff);
    stubTokenInfo({
      aud: WEB_CLIENT_ID,
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 600,
      sub: 'g-123',
      email: 'topzy20@gmail.com',
      email_verified: true,
      name: 'Alice',
    });

    const result = await harness.service.oauthGoogleSignInForChannel(
      { idToken: 'id-token' },
      'console',
    );

    expect(result).toBe(TOKEN_PAIR);
    expect(harness.userRepository.findByEmail).toHaveBeenCalledWith(
      'topzy20@gmail.com',
      'org-1',
    );
    expect(harness.userRepository.create).not.toHaveBeenCalled();
  });

  it('auto-registers with the channel-configured org and role set', async () => {
    const harness = buildHarness({
      OAUTH_CONSOLE_ORGANIZATION_ID: 'console-org',
      OAUTH_CONSOLE_ROLES: 'console_user',
    });
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    harness.roleRepository.listByCodes.mockResolvedValue([{ permissionCodes: [] }] as never);
    stubTokenInfo({
      aud: WEB_CLIENT_ID,
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 600,
      sub: 'g-123',
      email: 'newuser@gmail.com',
      email_verified: true,
    });

    const result = await harness.service.oauthGoogleSignInForChannel(
      { idToken: 'id-token' },
      'console',
    );

    expect(result).toBe(TOKEN_PAIR);
    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.organizationId).toBe('console-org');
    expect(created.roleCodes).toEqual(['console_user']);
    expect(created.username).toBe('google_g-123');
    expect(created.email).toBe('newuser@gmail.com');
  });

  it('rejects a token with the wrong audience', async () => {
    const harness = buildHarness();
    stubTokenInfo({
      aud: 'some-other-client',
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 600,
      sub: 'g-123',
      email: 'a@gmail.com',
      email_verified: true,
    });

    await expect(
      harness.service.oauthGoogleSignInForChannel({ idToken: 'id-token' }, 'website'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requires a token when neither accessToken nor idToken is provided', async () => {
    const harness = buildHarness();
    await expect(
      harness.service.oauthGoogleSignInForChannel({}, 'website'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('WebsiteAuthService — oauthFacebookSignInForChannel', () => {
  const stubGraph = (payload: Record<string, unknown>) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => payload } as never);
  };

  it('links an existing account by verified email', async () => {
    const harness = buildHarness();
    const admin = makeUser({ email: 'meta@ehealthwares.com' });
    harness.userRepository.findByEmail.mockResolvedValue(admin);
    stubGraph({ id: 'fb-1', name: 'Meta', email: 'meta@ehealthwares.com' });

    const result = await harness.service.oauthFacebookSignInForChannel(
      'fb-token',
      'console',
    );

    expect(result).toBe(TOKEN_PAIR);
    expect(harness.userRepository.create).not.toHaveBeenCalled();
  });

  it('auto-registers in the shopper org with the website role by default', async () => {
    const harness = buildHarness({ SHOPPER_DEFAULT_ORGANIZATION_ID: 'shopper-org' });
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    harness.roleRepository.listByCodes.mockResolvedValue([{ permissionCodes: [] }] as never);
    stubGraph({ id: 'fb-2', name: 'Newbie', email: 'new@fb.com' });

    const result = await harness.service.oauthFacebookSignInForChannel(
      'fb-token',
      'website',
    );

    expect(result).toBe(TOKEN_PAIR);
    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.organizationId).toBe('shopper-org');
    expect(created.roleCodes).toEqual(['website_user']);
  });

  it('surfaces an invalid Facebook token as UnauthorizedException', async () => {
    const harness = buildHarness();
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: false, json: async () => ({}) } as never);

    await expect(
      harness.service.oauthFacebookSignInForChannel('bad-token', 'website'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
