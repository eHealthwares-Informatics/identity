import { BadRequestException } from '@nestjs/common';
import { CreateUserUseCase } from './create-user.use-case';
import type { UserRepository } from '../repositories/user.repository';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { User } from '../domains/user.entity';
import { Role } from '../../roles/domains/role.entity';

describe('CreateUserUseCase', () => {
  const createUseCase = () => {
    const userRepository: jest.Mocked<UserRepository> = {
      findByUsername: jest.fn(),
      findByPhone: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
    };
    userRepository.findByUsername.mockResolvedValue(null as never);
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

    const useCase = new CreateUserUseCase(userRepository, passwordHasher, roleRepository);
    return { useCase, userRepository, roleRepository, passwordHasher };
  };

  it('stores the provided loginTimeoutMinutes', async () => {
    const { useCase, userRepository } = createUseCase();
    await useCase.execute(
      { username: 'jane', password: 'secret', loginTimeoutMinutes: 120 },
      'org-1',
    );
    const created = userRepository.create.mock.calls[0][0] as User;
    expect(created.loginTimeoutMinutes).toBe(120);
  });

  it('defaults loginTimeoutMinutes to null when omitted', async () => {
    const { useCase, userRepository } = createUseCase();
    await useCase.execute({ username: 'jane', password: 'secret' }, 'org-1');
    const created = userRepository.create.mock.calls[0][0] as User;
    expect(created.loginTimeoutMinutes).toBeNull();
  });

  it('defaults to the cashier role when roleCodes is omitted', async () => {
    const { useCase, userRepository } = createUseCase();
    await useCase.execute({ username: 'jane', password: 'secret' }, 'org-1');
    const created = userRepository.create.mock.calls[0][0] as User;
    expect(created.roleCodes).toEqual(['cashier']);
  });

  it('throws BadRequestException for a duplicate username', async () => {
    const { useCase, userRepository } = createUseCase();
    userRepository.findByUsername.mockResolvedValueOnce({ id: 'x' } as never);

    await expect(
      useCase.execute({ username: 'jane', password: 'secret' }, 'org-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when any requested role code is invalid', async () => {
    const { useCase, roleRepository } = createUseCase();
    roleRepository.listByCodes.mockResolvedValueOnce([]);

    await expect(
      useCase.execute({ username: 'jane', password: 'secret', roleCodes: ['bogus'] }, 'org-1'),
    ).rejects.toThrow(BadRequestException);
  });
});