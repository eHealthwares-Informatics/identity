import { BadRequestException } from '@nestjs/common';
import { EnsureCustomerUserUseCase } from './ensure-customer-user.use-case';
import type { UserRepository } from '../repositories/user.repository';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { User } from '../domains/user.entity';
import { Role } from '../../roles/domains/role.entity';

describe('EnsureCustomerUserUseCase', () => {
  const makeUseCase = () => {
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
    userRepository.findByPhone.mockResolvedValue(null as never);
    userRepository.findByEmail.mockResolvedValue(null as never);
    userRepository.findByUsername.mockResolvedValue(null as never);
    userRepository.create.mockImplementation(async (user: User) => user);

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
    roleRepository.listByCodes.mockImplementation(
      async (codes: string[], organizationId: string) =>
        codes.map((code) => new Role(code, organizationId, code, code, null, [])),
    );

    const passwordHasher: jest.Mocked<PasswordHasherPort> = {
      hash: jest.fn(async (raw: string) => `hash:${raw}`),
      verify: jest.fn(),
      needsRehash: jest.fn().mockReturnValue(false),
    };

    const useCase = new EnsureCustomerUserUseCase(
      userRepository,
      roleRepository,
      passwordHasher,
    );
    return { useCase, userRepository, roleRepository, passwordHasher };
  };

  const systemUser = {
    sub: 'system',
    organizationId: '',
    locationId: null,
    username: 'system',
    roles: ['super_admin'],
    permissions: [],
  } as any;

  const adminUser = {
    sub: 'u-admin',
    organizationId: 'org-1',
    locationId: null,
    username: 'admin',
    roles: ['admin'],
    permissions: [],
  } as any;

  it('returns an existing user found by phone (no duplicate)', async () => {
    const { useCase, userRepository } = makeUseCase();
    userRepository.findByPhone.mockResolvedValue({ id: 'u-existing' } as never);

    await expect(useCase.execute({ phone: '+234801' }, adminUser)).resolves.toMatchObject({
      id: 'u-existing',
    });
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('creates a website_user with the shopper_<digits> username', async () => {
    const { useCase, userRepository } = makeUseCase();

    await useCase.execute(
      { organizationId: 'org-1', phone: '+234 801-234', email: 'C@X.com' },
      systemUser,
    );

    const created = userRepository.create.mock.calls[0][0] as User;
    expect(created.organizationId).toBe('org-1');
    expect(created.username).toBe('shopper_234801234');
    expect(created.roleCodes).toEqual(['website_user']);
    expect(created.phone).toBe('234801234');
    expect(created.email).toBe('c@x.com');
  });

  it('uses the caller org for non-system callers', async () => {
    const { useCase, userRepository } = makeUseCase();

    await useCase.execute({ phone: '+234801' }, adminUser);

    expect(userRepository.create.mock.calls[0][0].organizationId).toBe('org-1');
  });

  it('requires an organization and a phone', async () => {
    const { useCase } = makeUseCase();

    await expect(
      useCase.execute({ phone: '+234801' }, { ...systemUser, organizationId: '' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(useCase.execute({ phone: '' }, adminUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('recovers from a concurrent create by re-reading the account', async () => {
    const { useCase, userRepository } = makeUseCase();
    userRepository.create.mockRejectedValueOnce(new Error('duplicate'));
    // Variant lookups run before create; the post-create re-read (3rd call+)
    // sees the account the concurrent caller created.
    let calls = 0;
    userRepository.findByPhone.mockImplementation(async () => {
      calls += 1;
      return (calls >= 3 ? { id: 'u-raced' } : null) as never;
    });

    await expect(useCase.execute({ phone: '+234801' }, adminUser)).resolves.toMatchObject({
      id: 'u-raced',
    });
  });
});
