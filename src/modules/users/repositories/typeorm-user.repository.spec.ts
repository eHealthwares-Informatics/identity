import { Repository } from 'typeorm';
import { User } from '../domains/user.entity';
import { Role } from '../../roles/domains/role.entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { TypeormUserRepository } from './typeorm-user.repository';

describe('TypeormUserRepository', () => {
  const adminRole = new Role('role-admin', 'org-1', 'admin', 'Admin', null, []);
  const auditorRole = new Role('role-auditor', 'org-1', 'auditor', 'Auditor', null, []);

  const baseUser = new User(
    'user-1',
    'org-1',
    null,
    'jane',
    'old-hash',
    true,
    ['admin'],
    [adminRole],
    undefined,
    'jane@example.com',
    30,
  );

  const createRepo = () => {
    const typeormRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<Repository<UserOrmEntity>>;

    const existing: any = {
      id: 'user-1',
      organizationId: 'org-1',
      username: 'jane',
      passwordHash: 'old-hash',
      phone: undefined,
      email: 'jane@example.com',
      loginTimeoutMinutes: 30,
      roles: [adminRole],
    };
    typeormRepo.findOneOrFail.mockResolvedValue(existing);
    typeormRepo.save.mockImplementation(async (entity: any) => entity);

    const repo = new TypeormUserRepository(typeormRepo);
    return { repo, typeormRepo, existing };
  };

  it('persists updated role assignments and username', async () => {
    const { repo, typeormRepo } = createRepo();

    const updated = new User(
      'user-1',
      'org-1',
      null,
      'jane2',
      'old-hash',
      true,
      ['admin', 'auditor'],
      [adminRole, auditorRole],
      undefined,
      'jane@example.com',
      30,
    );

    await repo.update(updated, 'org-1');

    const saved = typeormRepo.save.mock.calls[0][0] as any;
    expect(saved.username).toBe('jane2');
    expect(saved.roles).toEqual([adminRole, auditorRole]);
  });

  it('persists an empty role list when all roles are removed', async () => {
    const { repo, typeormRepo } = createRepo();

    const updated = new User(
      'user-1',
      'org-1',
      null,
      'jane',
      'old-hash',
      true,
      [],
      [],
      undefined,
      'jane@example.com',
      30,
    );

    await repo.update(updated, 'org-1');

    const saved = typeormRepo.save.mock.calls[0][0] as any;
    expect(saved.roles).toEqual([]);
  });
});