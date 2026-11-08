import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssignRoleUseCase } from './assign-role.use-case';
import type { UserRepository } from '../repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { User } from '../domains/user.entity';
import { Role } from '../../roles/domains/role.entity';

describe('AssignRoleUseCase', () => {
  const createUseCase = () => {
    const user = new User(
      'user-1',
      'org-1',
      null,
      'jane',
      'hash',
      true,
      [],
      [],
    );

    const userRepository: jest.Mocked<UserRepository> = {
      findById: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findByUsername: jest.fn(),
      findByPhone: jest.fn(),
      findByEmail: jest.fn(),
      findByOAuthProvider: jest.fn(),
      list: jest.fn(),
      delete: jest.fn(),
    };
    userRepository.findById.mockResolvedValue(user);
    userRepository.update.mockImplementation(async (u: User) => u);

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
    const adminRole = new Role('role-admin', 'org-1', 'admin', 'Administrator', null, []);
    roleRepository.findByCode.mockResolvedValue(adminRole);
    roleRepository.listByCodes.mockResolvedValue([adminRole]);

    const useCase = new AssignRoleUseCase(userRepository, roleRepository);
    return { useCase, userRepository, roleRepository, user };
  };

  it('persists the resolved role entities, not just the raw code', async () => {
    const { useCase, userRepository, user } = createUseCase();

    await useCase.execute('user-1', { roleCode: 'admin' }, 'org-1');

    expect(user.roleCodes).toEqual(['admin']);
    // The repository persists `roles`; if it is left stale the assignment is
    // dropped and the user gets no permissions/modules on next login.
    expect(user.roles).toHaveLength(1);
    const persisted = userRepository.update.mock.calls[0][0] as User;
    expect(persisted.roles).toHaveLength(1);
    expect((persisted.roles[0] as Role).code).toBe('admin');
  });

  it('is idempotent when the role is already assigned', async () => {
    const { useCase, userRepository, user } = createUseCase();
    user.roleCodes.push('admin');

    await useCase.execute('user-1', { roleCode: 'admin' }, 'org-1');

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the user is missing', async () => {
    const { useCase, userRepository } = createUseCase();
    userRepository.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute('missing', { roleCode: 'admin' }, 'org-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when the role is missing', async () => {
    const { useCase, roleRepository } = createUseCase();
    roleRepository.findByCode.mockResolvedValueOnce(null);

    await expect(
      useCase.execute('user-1', { roleCode: 'ghost' }, 'org-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
