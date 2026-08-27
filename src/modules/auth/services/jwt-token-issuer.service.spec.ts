import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenIssuerService } from './jwt-token-issuer.service';

describe('JwtTokenIssuerService', () => {
  const createIssuer = (env: Record<string, string> = {}) => {
    const configService = {
      get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
    } as unknown as ConfigService;
    const jwtService = {
      signAsync: jest.fn(async () => 'signed-token'),
      verifyAsync: jest.fn(),
    } as unknown as JwtService & { signAsync: jest.Mock };
    const issuer = new JwtTokenIssuerService(jwtService, configService);
    return { issuer, jwtService, configService };
  };

  const payload = {
    sub: 'user-1',
    organizationId: 'org-1',
    locationId: null,
    username: 'jane',
    roles: ['admin'],
    permissions: ['users:update'],
    email: 'jane@example.com',
  };

  it('signs the access token with the default 15-minute TTL (in seconds)', async () => {
    const { issuer, jwtService } = createIssuer();
    await issuer.issuePair(payload);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ expiresIn: 15 * 60 }),
    );
  });

  it('honours the per-user login timeout converted to seconds', async () => {
    const { issuer, jwtService } = createIssuer();
    await issuer.issuePair(payload, 480);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ expiresIn: 480 * 60 }),
    );
  });

  it('clamps unreasonable per-user timeouts to the configured max', async () => {
    const { issuer, jwtService } = createIssuer({
      ACCESS_TOKEN_TTL_MAX_MINUTES: '240',
    });
    await issuer.issuePair(payload, 9999);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ expiresIn: 240 * 60 }),
    );
  });

  it('applies ACCESS_TOKEN_TTL_MINUTES as the global default', async () => {
    const { issuer, jwtService } = createIssuer({
      ACCESS_TOKEN_TTL_MINUTES: '45',
    });
    await issuer.issuePair(payload);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ expiresIn: 45 * 60 }),
    );
  });

  it('returns access token TTL in seconds', async () => {
    const { issuer } = createIssuer();
    const pair = await issuer.issuePair(payload, 10);
    expect(pair.accessTokenExpiresIn).toBe(10 * 60);
  });

  it('signs the refresh token with the fixed 7-day TTL', async () => {
    const { issuer, jwtService } = createIssuer();
    await issuer.issuePair(payload);
    const refreshCall = jwtService.signAsync.mock.calls.find(
      ([callPayload]) => (callPayload as { jti?: string }).jti !== undefined,
    );
    expect(refreshCall).toBeDefined();
    expect(refreshCall![1]).toEqual(
      expect.objectContaining({ expiresIn: 7 * 24 * 60 * 60 }),
    );
  });

  it('falls back to the default when env values are missing or invalid', async () => {
    const { issuer, jwtService } = createIssuer({
      ACCESS_TOKEN_TTL_MINUTES: 'not-a-number',
    });
    await issuer.issuePair(payload);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ expiresIn: 15 * 60 }),
    );
  });
});