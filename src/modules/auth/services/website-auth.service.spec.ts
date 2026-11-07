import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { WebsiteAuthService } from './website-auth.service';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { User, type UserProfile } from '../../users/domains/user.entity';

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
    undefined,
    (overrides.profile as UserProfile) ?? {},
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
    findByOAuthProvider: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    // Profile sync re-reads the saved row; echo the instance by default.
    update: jest.fn().mockImplementation(async (user: User) => user),
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
      needsRehash: jest.fn().mockReturnValue(false),
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

/**
 * Route `fetch` calls by URL fragment so one stubbed sign-in can cover the
 * Google userinfo + People API (or Facebook Graph) round trips.
 */
function stubFetchByUrl(routes: Array<[fragment: string, payload: unknown, status?: number]>) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation((async (input: unknown) => {
    const url = String(
      typeof input === 'string' ? input : (input as { url?: string })?.url ?? '',
    );
    const match = routes.find(([fragment]) => url.includes(fragment));
    if (!match) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    const [, payload, status = 200] = match;
    return { ok: status < 400, status, json: async () => payload };
  }) as never);
}

afterEach(() => {
  jest.restoreAllMocks();
});

// Hard-coded fallback client id in the service (no env override in tests).
const WEB_CLIENT_ID =
  '763036387173-jml5o3iauj2ms5269dqf7qq24gplh6mq.apps.googleusercontent.com';

function idTokenClaims(overrides: Record<string, unknown> = {}) {
  return {
    aud: WEB_CLIENT_ID,
    iss: 'https://accounts.google.com',
    exp: Math.floor(Date.now() / 1000) + 600,
    sub: 'g-123',
    email: 'newuser@gmail.com',
    email_verified: true,
    ...overrides,
  };
}

describe('WebsiteAuthService — oauthGoogleSignInForChannel', () => {
  const stubTokenInfo = (payload: Record<string, unknown>) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => payload,
      } as never);
  };

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
    stubTokenInfo(idTokenClaims());

    const result = await harness.service.oauthGoogleSignInForChannel(
      { idToken: 'id-token' },
      'console',
    );

    expect(result).toBe(TOKEN_PAIR);
    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.organizationId).toBe('console-org');
    expect(created.roleCodes).toEqual(['console_user']);
    // Username comes from the person's own details, not the provider subject.
    expect(created.username).toBe('newuser');
    expect(created.email).toBe('newuser@gmail.com');
  });

  it('populates the full profile from the ID token', async () => {
    const harness = buildHarness();
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    stubTokenInfo(
      idTokenClaims({
        name: 'Ada Lovelace',
        given_name: 'Ada',
        family_name: 'Lovelace',
        picture: 'https://lh3.googleusercontent.com/ada.jpg',
        locale: 'en-GB',
      }),
    );

    await harness.service.oauthGoogleSignInForChannel({ idToken: 'id-token' }, 'website');

    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.username).toBe('ada.lovelace');
    expect(created.email).toBe('newuser@gmail.com');
    expect(created.profile).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      displayName: 'Ada Lovelace',
      pictureUrl: 'https://lh3.googleusercontent.com/ada.jpg',
      locale: 'en-GB',
      oauthProvider: 'google',
      oauthProviderId: 'g-123',
    });
    expect(created.profile.emailVerifiedAt).toBeInstanceOf(Date);
    // The credential column is populated with an unusable, random secret.
    expect(created.passwordHash).toBe('hashed');
  });

  it('derives the username from the email local part when no name is shared', async () => {
    const harness = buildHarness();
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    stubTokenInfo(idTokenClaims({ email: 'jo.bloggs@example.com' }));

    await harness.service.oauthGoogleSignInForChannel({ idToken: 'id-token' }, 'website');

    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.username).toBe('jo.bloggs');
  });

  it('suffixes the username when the derived handle is taken', async () => {
    const harness = buildHarness();
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockImplementation(async (username: string) =>
      username === 'newuser' ? ({ id: 'other' } as User) : null,
    );
    stubTokenInfo(idTokenClaims());

    await harness.service.oauthGoogleSignInForChannel({ idToken: 'id-token' }, 'website');

    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.username).toBe('newuser2');
  });

  it('fills missing profile columns on an existing account without overwriting known values', async () => {
    const harness = buildHarness();
    const existing = makeUser({
      email: 'topzy20@gmail.com',
      username: 'alice',
      profile: { firstName: 'Alicia' },
    });
    harness.userRepository.findByEmail.mockResolvedValue(existing);
    harness.userRepository.update.mockImplementation(async (user: User) => user);
    stubTokenInfo(
      idTokenClaims({
        email: 'topzy20@gmail.com',
        name: 'Alice Kade',
        given_name: 'Alice',
        family_name: 'Kade',
        picture: 'https://pic/alice.jpg',
      }),
    );

    await harness.service.oauthGoogleSignInForChannel({ idToken: 'id-token' }, 'console');

    expect(harness.userRepository.create).not.toHaveBeenCalled();
    const updated = harness.userRepository.update.mock.calls[0][0] as User;
    expect(updated.profile).toMatchObject({
      firstName: 'Alicia', // existing value wins
      lastName: 'Kade',
      displayName: 'Alice Kade',
      pictureUrl: 'https://pic/alice.jpg',
      oauthProvider: 'google',
      oauthProviderId: 'g-123',
    });
  });

  it('does not write when the stored profile is already complete', async () => {
    const harness = buildHarness();
    harness.userRepository.findByOAuthProvider.mockResolvedValue(
      makeUser({
        profile: {
          firstName: 'Alice',
          lastName: 'Kade',
          displayName: 'Alice Kade',
          dateOfBirth: '1990-04-18',
          gender: 'female',
          pictureUrl: 'https://pic/alice.jpg',
          locale: 'en-GB',
          oauthProvider: 'google',
          oauthProviderId: 'g-123',
          emailVerifiedAt: new Date(),
        },
      }),
    );
    stubTokenInfo(
      idTokenClaims({
        email: 'alice@example.com',
        name: 'Alice Kade',
        given_name: 'Alice',
        family_name: 'Kade',
        picture: 'https://pic/alice.jpg',
        locale: 'en-GB',
      }),
    );

    await harness.service.oauthGoogleSignInForChannel({ idToken: 'id-token' }, 'console');

    expect(harness.userRepository.update).not.toHaveBeenCalled();
    expect(harness.userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('rejects a token with the wrong audience', async () => {
    const harness = buildHarness();
    stubTokenInfo(idTokenClaims({ aud: 'some-other-client' }));

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

describe('WebsiteAuthService — Google access-token profile', () => {
  it('collects name parts, photo, locale and People API details', async () => {
    const harness = buildHarness();
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    stubFetchByUrl([
      [
        'oauth2/v3/userinfo',
        {
          sub: 'g-1',
          email: 'ada.lovelace@gmail.com',
          email_verified: true,
          name: 'Ada Lovelace',
          given_name: 'Ada',
          family_name: 'Lovelace',
          picture: 'https://lh3/pic.jpg',
          locale: 'en-GB',
        },
      ],
      [
        'people.googleapis.com',
        {
          names: [{ displayName: 'Ada Lovelace', givenName: 'Ada', familyName: 'Lovelace', metadata: { primary: true } }],
          birthdays: [{ date: { year: 1815, month: 12, day: 10 }, metadata: { primary: true } }],
          genders: [{ value: 'female', formattedValue: 'Female', metadata: { primary: true } }],
          phoneNumbers: [{ canonicalForm: '+447700900123', metadata: { primary: true } }],
          locales: [{ value: 'en-GB', metadata: { primary: true } }],
          photos: [{ url: 'https://lh3/pic-large.jpg', metadata: { primary: true } }],
        },
      ],
    ]);

    await harness.service.oauthGoogleSignInForChannel({ accessToken: 'at' }, 'shopper');

    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.phone).toBe('+447700900123');
    expect(created.profile).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      displayName: 'Ada Lovelace',
      dateOfBirth: '1815-12-10',
      gender: 'Female',
      pictureUrl: 'https://lh3/pic-large.jpg',
      locale: 'en-GB',
      oauthProvider: 'google',
      oauthProviderId: 'g-1',
    });
  });

  it('still signs in when the People API is not granted', async () => {
    const harness = buildHarness();
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    stubFetchByUrl([
      [
        'oauth2/v3/userinfo',
        {
          sub: 'g-2',
          email: 'grace.hopper@gmail.com',
          email_verified: true,
          name: 'Grace Hopper',
          given_name: 'Grace',
          family_name: 'Hopper',
        },
      ],
      ['people.googleapis.com', { error: { code: 403 } }, 403],
    ]);

    await harness.service.oauthGoogleSignInForChannel({ accessToken: 'at' }, 'website');

    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.profile).toMatchObject({ firstName: 'Grace', lastName: 'Hopper' });
    expect(created.profile.dateOfBirth).toBeNull();
  });

  it('ignores a birthday that hides the year', async () => {
    const harness = buildHarness();
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    stubFetchByUrl([
      ['oauth2/v3/userinfo', { sub: 'g-3', email: 'k@example.com', email_verified: true, name: 'K' }],
      ['people.googleapis.com', { birthdays: [{ date: { month: 4, day: 18 } }] }],
    ]);

    await harness.service.oauthGoogleSignInForChannel({ accessToken: 'at' }, 'website');

    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.profile.dateOfBirth).toBeNull();
  });

  it('does not attach an email Google reports as unverified', async () => {
    const harness = buildHarness();
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    stubFetchByUrl([
      [
        'oauth2/v3/userinfo',
        { sub: 'g-4', email: 'unverified@gmail.com', email_verified: false, name: 'Una Verified' },
      ],
      ['people.googleapis.com', {}, 403],
    ]);

    await harness.service.oauthGoogleSignInForChannel({ accessToken: 'at' }, 'website');

    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.email).toBeUndefined();
    expect(created.username).toBe('una.verified');
    expect(created.profile.emailVerifiedAt).toBeNull();
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

  it('maps name parts, birthday, gender and picture', async () => {
    const harness = buildHarness();
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    stubGraph({
      id: 'fb-9',
      name: 'Marie Curie',
      first_name: 'Marie',
      last_name: 'Curie',
      email: 'marie@example.com',
      email_verified: true,
      birthday: '11/07/1867',
      gender: 'female',
      locale: 'fr_FR',
      picture: { data: { url: 'https://fb/pic.jpg' } },
    });

    await harness.service.oauthFacebookSignInForChannel('fb-token', 'website');

    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.username).toBe('marie.curie');
    expect(created.profile).toMatchObject({
      firstName: 'Marie',
      lastName: 'Curie',
      displayName: 'Marie Curie',
      dateOfBirth: '1867-11-07',
      gender: 'female',
      pictureUrl: 'https://fb/pic.jpg',
      locale: 'fr_FR',
      oauthProvider: 'facebook',
      oauthProviderId: 'fb-9',
    });
  });

  it('falls back to the base field set when birthday/gender are not permitted', async () => {
    const harness = buildHarness();
    harness.userRepository.findByEmail.mockResolvedValue(null);
    harness.userRepository.findByUsername.mockResolvedValue(null);
    let calls = 0;
    jest.spyOn(globalThis, 'fetch').mockImplementation((async (input: unknown) => {
      calls += 1;
      const url = String(
        typeof input === 'string' ? input : (input as { url?: string })?.url ?? '',
      );
      if (url.includes('birthday')) {
        return { ok: false, status: 400, json: async () => ({ error: { message: 'Invalid field' } }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'fb-10',
          name: 'Newbie',
          first_name: 'New',
          last_name: 'Bie',
          email: 'new@fb.com',
          email_verified: true,
        }),
      };
    }) as never);

    const result = await harness.service.oauthFacebookSignInForChannel('fb-token', 'website');

    expect(result).toBe(TOKEN_PAIR);
    expect(calls).toBe(2);
    const created = harness.userRepository.create.mock.calls[0][0] as User;
    expect(created.username).toBe('new.bie');
    expect(created.profile.dateOfBirth).toBeNull();
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
