import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { LoginSessionService } from './login-session.service';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { User } from '../../users/domains/user.entity';
import type { UserLoginEventOrmEntity } from '../entities/user-login-event.orm-entity';
import type { Repository } from 'typeorm';

const TOKEN_PAIR = {
  accessToken: 'at-2',
  refreshToken: 'rt-2',
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 604800,
  refreshTokenJti: 'jti-2',
};

function createUseCase() {
  const user = new User(
    'user-1',
    'org-1',
    null,
    'jane',
    'hash',
    true,
    ['admin'],
    [{ permissionCodes: ['users:read'] }],
    undefined,
    'jane@example.com',
    30,
  );

  const refreshTokenRepository: jest.Mocked<RefreshTokenRepository> = {
    persist: jest.fn().mockResolvedValue(undefined),
    isValid: jest.fn().mockResolvedValue(true),
    revoke: jest.fn().mockResolvedValue(undefined),
    revokeAllForUser: jest.fn().mockResolvedValue(undefined),
  };

  const tokenHasher: jest.Mocked<PasswordHasherPort> = {
    hash: jest.fn().mockResolvedValue('sha-rt'),
    verify: jest.fn(),
    needsRehash: jest.fn().mockReturnValue(false),
  };

  const tokenIssuer: jest.Mocked<TokenIssuerPort> = {
    issuePair: jest.fn().mockResolvedValue(TOKEN_PAIR),
    verifyRefreshToken: jest.fn().mockResolvedValue({
      sub: 'user-1',
      organizationId: 'org-1',
      locationId: null,
      username: 'jane',
      roles: ['admin'],
      permissions: ['users:read'],
      email: 'jane@example.com',
      jti: 'jti-1',
    }),
    getPolicy: jest.fn(),
  };

  const userRepository = {
    findById: jest.fn().mockResolvedValue(user),
  } as unknown as jest.Mocked<UserRepository>;

  const roleRepository = {
    listByCodes: jest.fn().mockResolvedValue([{ permissionCodes: [], jwtExpirySeconds: null }]),
  } as unknown as jest.Mocked<RoleRepository>;

  const loginEventRepo = { save: jest.fn().mockResolvedValue(undefined) };
  const loginSessionService = {
    recordRefresh: jest.fn().mockResolvedValue(undefined),
    endByRefreshJti: jest.fn().mockResolvedValue(undefined),
  } as unknown as LoginSessionService;

  const useCase = new RefreshTokenUseCase(
    refreshTokenRepository,
    tokenHasher,
    tokenIssuer,
    userRepository,
    roleRepository,
    loginEventRepo as unknown as Repository<UserLoginEventOrmEntity>,
    loginSessionService,
  );

  return {
    useCase,
    userRepository,
    refreshTokenRepository,
    tokenIssuer,
    loginSessionService,
  };
}

describe('RefreshTokenUseCase (session audit)', () => {
  it('extends the same session row with the new rotation', async () => {
    const { useCase, loginSessionService, refreshTokenRepository } = createUseCase();

    await useCase.execute({ refreshToken: 'rt-1' });

    expect(refreshTokenRepository.persist).toHaveBeenCalledWith(
      'user-1',
      'sha-rt',
      expect.any(Date),
    );
    expect(loginSessionService.recordRefresh).toHaveBeenCalledWith('user-1', 'jti-1', {
      refreshTokenJti: 'jti-2',
      expiresAt: expect.any(Date),
    });
  });

  it('closes the session when the token was already rotated (replay)', async () => {
    const { useCase, refreshTokenRepository, loginSessionService } = createUseCase();
    refreshTokenRepository.isValid.mockResolvedValueOnce(false);

    await expect(useCase.execute({ refreshToken: 'rt-1' })).rejects.toThrow(
      UnauthorizedException,
    );

    expect(loginSessionService.endByRefreshJti).toHaveBeenCalledWith(
      'user-1',
      'jti-1',
      'refresh_reuse',
    );
    expect(loginSessionService.recordRefresh).not.toHaveBeenCalled();
  });

  it('closes the session when the account is no longer active', async () => {
    const { useCase, userRepository, loginSessionService } = createUseCase();
    userRepository.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute({ refreshToken: 'rt-1' })).rejects.toThrow(
      UnauthorizedException,
    );

    expect(loginSessionService.endByRefreshJti).toHaveBeenCalledWith(
      'user-1',
      'jti-1',
      'user_deactivated',
    );
  });
});
