import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { LogoutAllUseCase } from './logout-all.use-case';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { TokenIssuerPort } from './token-issuer.port';
import type { TokenPayload } from './token-issuer.port';

describe('LogoutAllUseCase', () => {
  const createUseCase = () => {
    const refreshTokenRepository: jest.Mocked<RefreshTokenRepository> = {
      persist: jest.fn(),
      isValid: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    refreshTokenRepository.revokeAllForUser.mockResolvedValue(undefined);

    const tokenPayload: TokenPayload = {
      sub: 'user-1',
      organizationId: 'org-1',
      locationId: null,
      username: 'jane',
      roles: [],
      permissions: [],
      email: 'jane@example.com',
    };
    const tokenIssuer: jest.Mocked<TokenIssuerPort> = {
      verifyRefreshToken: jest.fn(),
      issuePair: jest.fn(),
    };
    tokenIssuer.verifyRefreshToken.mockResolvedValue(tokenPayload);

    const jwtServiceMock = { verifyAsync: jest.fn() };
    const jwtService = jwtServiceMock as unknown as JwtService;
    const configService = {
      get: jest.fn((_key: string, fallback?: string) => fallback),
    } as unknown as ConfigService;

    const useCase = new LogoutAllUseCase(
      refreshTokenRepository,
      tokenIssuer,
      jwtService,
      configService,
    );
    return { useCase, refreshTokenRepository, tokenIssuer, jwtServiceMock };
  };

  it('revokes all sessions for the user identified by a valid Bearer access token', async () => {
    const { useCase, jwtServiceMock, refreshTokenRepository } = createUseCase();
    jwtServiceMock.verifyAsync.mockResolvedValueOnce({ sub: 'user-1' });

    await useCase.execute('Bearer access-token');

    expect(jwtServiceMock.verifyAsync).toHaveBeenCalled();
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('falls back to the refresh token when the access token is expired/invalid', async () => {
    const { useCase, jwtServiceMock, tokenIssuer, refreshTokenRepository } = createUseCase();
    jwtServiceMock.verifyAsync.mockRejectedValueOnce(new Error('expired'));
    tokenIssuer.verifyRefreshToken.mockResolvedValueOnce({
      sub: 'user-2',
    } as TokenPayload);

    await useCase.execute('Bearer expired-token', 'refresh-token');

    expect(tokenIssuer.verifyRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-2');
  });

  it('revokes using the refresh token alone when no access token is supplied', async () => {
    const { useCase, tokenIssuer, refreshTokenRepository } = createUseCase();
    tokenIssuer.verifyRefreshToken.mockResolvedValueOnce({
      sub: 'user-3',
    } as TokenPayload);

    await useCase.execute(undefined, 'refresh-token');

    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-3');
  });

  it('throws UnauthorizedException when neither token can be verified', async () => {
    const { useCase, jwtServiceMock, tokenIssuer, refreshTokenRepository } = createUseCase();
    jwtServiceMock.verifyAsync.mockRejectedValueOnce(new Error('expired'));
    tokenIssuer.verifyRefreshToken.mockRejectedValueOnce(new Error('expired'));

    await expect(useCase.execute('Bearer bad', 'also-bad')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(refreshTokenRepository.revokeAllForUser).not.toHaveBeenCalled();
  });
});