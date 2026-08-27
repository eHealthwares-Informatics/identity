import { LogoutUseCase } from './logout.use-case';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { TokenPayload } from './token-issuer.port';

describe('LogoutUseCase', () => {
  const tokenPayload: TokenPayload = {
    sub: 'user-1',
    organizationId: 'org-1',
    locationId: null,
    username: 'jane',
    roles: [],
    permissions: [],
    email: 'jane@example.com',
  };

  const createUseCase = () => {
    const refreshTokenRepository: jest.Mocked<RefreshTokenRepository> = {
      persist: jest.fn(),
      isValid: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    refreshTokenRepository.revoke.mockResolvedValue(undefined);

    const passwordHasher: jest.Mocked<PasswordHasherPort> = {
      hash: jest.fn(),
      verify: jest.fn(),
    };
    passwordHasher.hash.mockImplementation(async (raw: string) => `hash:${raw}`);

    const tokenIssuer: jest.Mocked<TokenIssuerPort> = {
      verifyRefreshToken: jest.fn(),
      issuePair: jest.fn(),
    };
    tokenIssuer.verifyRefreshToken.mockResolvedValue(tokenPayload);

    const useCase = new LogoutUseCase(refreshTokenRepository, passwordHasher, tokenIssuer);
    return { useCase, refreshTokenRepository, passwordHasher, tokenIssuer };
  };

  it('revokes the hash of the provided refresh token', async () => {
    const { useCase, passwordHasher, refreshTokenRepository } = createUseCase();
    await useCase.execute({ refreshToken: 'rt-1' });
    expect(passwordHasher.hash).toHaveBeenCalledWith('rt-1');
    expect(refreshTokenRepository.revoke).toHaveBeenCalledWith('user-1', 'hash:rt-1');
  });

  it('is a no-op when the refresh token cannot be verified (already revoked/expired)', async () => {
    const { useCase, tokenIssuer, refreshTokenRepository, passwordHasher } = createUseCase();
    tokenIssuer.verifyRefreshToken.mockRejectedValueOnce(new Error('bad token'));

    await expect(useCase.execute({ refreshToken: 'expired' })).resolves.toBeUndefined();
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });
});