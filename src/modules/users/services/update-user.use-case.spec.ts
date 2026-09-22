import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateUserUseCase } from './update-user.use-case';
import type { UserRepository } from '../repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import type { RefreshTokenRepository } from '../../auth/repositories/refresh-token.repository';
import { User } from '../domains/user.entity';
import { Role } from '../../roles/domains/role.entity';

describe('UpdateUserUseCase', () => {
  const baseUser = new User(
    'user-1',
    'org-1',
    null,
    'jane',
    'old-hash',
    true,
    ['admin'],
    [],
    undefined,
    'jane@example.com',
    30,
  );

  const createUseCase = () => {
    const userRepository: jest.Mocked<UserRepository> = {
      findById: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findByUsername: jest.fn(),
      findByPhone: jest.fn(),
      findByEmail: jest.fn(),
      list: jest.fn(),
      delete: jest.fn(),
    };
    userRepository.findById.mockResolvedValue(baseUser);
    userRepository.update.mockImplementation(async (user: User) => user);

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
    roleRepository.listByCodes.mockImplementation(async (codes: string[], _organizationId: string) =>
      codes.map((code) => new Role(code, 'org-1', code, code, null, [])),
    );

    const passwordHasher: jest.Mocked<PasswordHasherPort> = {
      hash: jest.fn(async (raw: string) => `hash:${raw}`),
      verify: jest.fn(),
    };
    const refreshTokenRepository: jest.Mocked<RefreshTokenRepository> = {
      persist: jest.fn(),
      isValid: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    refreshTokenRepository.revokeAllForUser.mockResolvedValue(undefined);

    const useCase = new UpdateUserUseCase(
      userRepository,
      passwordHasher,
      roleRepository,
      refreshTokenRepository,
    );
    return { useCase, userRepository, roleRepository, passwordHasher, refreshTokenRepository };
  };

  it('revokes all refresh tokens when a new password is set', async () => {
    const { useCase, passwordHasher, refreshTokenRepository } = createUseCase();

    await useCase.execute('user-1', { password: 'new-password' }, 'org-1');

    expect(passwordHasher.hash).toHaveBeenCalledWith('new-password');
    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('keeps the existing password hash and does not revoke sessions when password is omitted', async () => {
    const { useCase, passwordHasher, refreshTokenRepository, userRepository } = createUseCase();

    await useCase.execute('user-1', { email: 'new@example.com' }, 'org-1');

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(refreshTokenRepository.revokeAllForUser).not.toHaveBeenCalled();
    const updated = userRepository.update.mock.calls[0][0] as User;
    expect(updated.passwordHash).toBe('old-hash');
    expect(updated.email).toBe('new@example.com');
  });

  it('throws NotFoundException when the user does not exist', async () => {
    const { useCase, userRepository } = createUseCase();
    userRepository.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute('missing', {}, 'org-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(userRepository.update).not.toHaveBeenCalled();
    expect(userRepository.findById.mock.calls[0]).toEqual(['missing', 'org-1']);
  });

  it('throws BadRequestException when any requested role code is invalid', async () => {
    const { useCase, roleRepository } = createUseCase();
    roleRepository.listByCodes.mockResolvedValueOnce([]);

    await expect(
      useCase.execute('user-1', { roleCodes: ['bogus'] }, 'org-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not validate roles when roleCodes is omitted', async () => {
    const { useCase, roleRepository, userRepository } = createUseCase();

    await useCase.execute('user-1', { username: 'jane2' }, 'org-1');

    expect(roleRepository.listByCodes).not.toHaveBeenCalled();
    const updated = userRepository.update.mock.calls[0][0] as User;
    expect(updated.roleCodes).toEqual(['admin']);
    expect(updated.username).toBe('jane2');
  });

  it('keeps loginTimeoutMinutes when not provided', async () => {
    const { useCase, userRepository } = createUseCase();

    await useCase.execute('user-1', { username: 'jane2' }, 'org-1');

    const updated = userRepository.update.mock.calls[0][0] as User;
    expect(updated.loginTimeoutMinutes).toBe(30);
  });

  it('clears loginTimeoutMinutes back to system default when null is provided', async () => {
    const { useCase, userRepository } = createUseCase();

    await useCase.execute('user-1', { loginTimeoutMinutes: null }, 'org-1');

    const updated = userRepository.update.mock.calls[0][0] as User;
    expect(updated.loginTimeoutMinutes).toBeNull();
  });

  it('stores the updated loginTimeoutMinutes when provided', async () => {
    const { useCase, userRepository } = createUseCase();

    await useCase.execute('user-1', { loginTimeoutMinutes: 120 }, 'org-1');

    const updated = userRepository.update.mock.calls[0][0] as User;
    expect(updated.loginTimeoutMinutes).toBe(120);
  });
});