import { UnauthorizedException } from '@nestjs/common';
import { LoginUseCase } from './login.use-case';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { UserLoginEventOrmEntity } from '../entities/user-login-event.orm-entity';
import { User } from '../../users/domains/user.entity';

describe('LoginUseCase', () => {
  const createAll = (loginTimeoutMinutes?: number) => {
    const user = new User(
      'user-1',
      'org-1',
      null,
      'jane',
      'valid-hash',
      true,
      ['admin'],
      [{ permissionCodes: ['users:read'] }],
      '0801234567',
      'jane@example.com',
      loginTimeoutMinutes,
    );

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
    userRepository.findByUsername.mockResolvedValue(user);

    const roleRepository: jest.Mocked<RoleRepository> = {
      findByCode: jest.fn(),
      findById: jest.fn(),
      listByCodes: jest.fn(),
      listAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findLastCreated: jest.fn(),
    };
    roleRepository.listByCodes.mockResolvedValue([{ permissionCodes: ['users:read'] }] as never);

    const passwordHasher: jest.Mocked<PasswordHasherPort> = {
      verify: jest.fn(),
      hash: jest.fn(),
    };
    passwordHasher.verify.mockImplementation(async (_raw, digest) => digest === 'valid-hash');
    passwordHasher.hash.mockResolvedValue('token-hash');

    const tokenPair = {
      accessToken: 'at',
      refreshToken: 'rt',
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 604800,
    };
    const tokenIssuer: jest.Mocked<TokenIssuerPort> = {
      issuePair: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    tokenIssuer.issuePair.mockResolvedValue(tokenPair);

    const refreshTokenRepository: jest.Mocked<RefreshTokenRepository> = {
      persist: jest.fn(),
      isValid: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    refreshTokenRepository.persist.mockResolvedValue(undefined);

    const loginEventRepo = { save: jest.fn().mockResolvedValue(undefined) } as unknown as {
      save: (entity: Partial<UserLoginEventOrmEntity>) => Promise<unknown>;
    };

    const useCase = new LoginUseCase(
      userRepository,
      roleRepository,
      passwordHasher,
      tokenIssuer,
      refreshTokenRepository,
      loginEventRepo as never,
    );
    return { useCase, userRepository, passwordHasher, tokenIssuer, refreshTokenRepository, user };
  };

  it('passes the per-user loginTimeoutMinutes into token issuance', async () => {
    const { useCase, tokenIssuer, user } = createAll(480);
    await useCase.execute({ username: 'jane', password: 'whatever' });
    expect(tokenIssuer.issuePair).toHaveBeenCalledWith(expect.anything(), user.loginTimeoutMinutes);
  });

  it('passes undefined when the user has no loginTimeoutMinutes', async () => {
    const { useCase, tokenIssuer } = createAll();
    await useCase.execute({ username: 'jane', password: 'whatever' });
    expect(tokenIssuer.issuePair).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it('rejects unknown users with UnauthorizedException', async () => {
    const { useCase, userRepository } = createAll();
    userRepository.findByUsername.mockResolvedValueOnce(null);
    await expect(
      useCase.execute({ username: 'nobody', password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(userRepository.findByUsername.mock.calls[0]).toEqual(['nobody']);
  });

  it('rejects users whose password does not match', async () => {
    const { useCase, passwordHasher } = createAll();
    passwordHasher.verify.mockResolvedValueOnce(false);
    await expect(
      useCase.execute({ username: 'jane', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('resolves an email identifier via findByEmail', async () => {
    const { useCase, userRepository, user } = createAll();
    userRepository.findByEmail.mockResolvedValue(user);
    await useCase.execute({ username: 'Jane@Example.com', password: 'whatever' });
    expect(userRepository.findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(userRepository.findByUsername).not.toHaveBeenCalled();
  });

  it('resolves a non-email identifier via findByUsername', async () => {
    const { useCase, userRepository } = createAll();
    await useCase.execute({ username: 'jane', password: 'whatever' });
    expect(userRepository.findByUsername).toHaveBeenCalledWith('jane');
    expect(userRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('persists the refresh token hash with the correct expiry window', async () => {
    const { useCase, passwordHasher, refreshTokenRepository } = createAll();
    await useCase.execute({ username: 'jane', password: 'whatever' });
    expect(passwordHasher.hash).toHaveBeenCalledWith('rt');
    expect(refreshTokenRepository.persist).toHaveBeenCalledWith(
      'user-1',
      'token-hash',
      expect.any(Date),
    );
    const expiresAt = refreshTokenRepository.persist.mock.calls[0][2] as Date;
    expect(expiresAt.getTime() - Date.now()).toBeCloseTo(604800 * 1000, -2);
  });

  it('throws UnauthorizedException when the user is inactive', async () => {
    const { useCase, userRepository, user } = createAll();
    userRepository.findByUsername.mockResolvedValueOnce(
      new User(user.id, 'org-1', null, user.username, user.passwordHash, false),
    );
    await expect(
      useCase.execute({ username: 'jane', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});