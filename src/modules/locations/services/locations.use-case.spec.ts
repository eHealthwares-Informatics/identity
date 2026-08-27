import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateLocationUseCase } from './create-location.use-case';
import { UpdateLocationUseCase } from './update-location.use-case';
import { DeleteLocationUseCase } from './delete-location.use-case';
import { Location } from '../domains/location.entity';
import type { LocationRepository } from '../repositories/location.repository';

describe('Location Use Cases', () => {
  const createMockRepo = (): jest.Mocked<LocationRepository> => ({
    list: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    countChildren: jest.fn(),
    create: jest.fn(async (loc: Location) => loc),
    update: jest.fn(async (loc: Location) => loc),
    delete: jest.fn(async (_id: string) => undefined),
  });

  describe('CreateLocationUseCase', () => {
    it('creates a root location', async () => {
      const repo = createMockRepo();
      const useCase = new CreateLocationUseCase(repo);
      const result = await useCase.execute(
        { code: 'HQ', name: 'Headquarters' },
        'org-1',
      );
      expect(result.code).toBe('HQ');
      expect(result.parentId).toBeNull();
      expect(result.organizationId).toBe('org-1');
      expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it('creates a child location under an existing parent', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(new Location('parent-1', 'org-1', 'HQ', 'HQ', null, true));
      const useCase = new CreateLocationUseCase(repo);
      const result = await useCase.execute(
        { code: 'CLINIC-A', name: 'Clinic A', parentId: 'parent-1' },
        'org-1',
      );
      expect(result.code).toBe('CLINIC-A');
      expect(result.parentId).toBe('parent-1');
    });

    it('throws when parent location not found', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const useCase = new CreateLocationUseCase(repo);
      await expect(
        useCase.execute({ code: 'CLINIC-A', name: 'Clinic A', parentId: 'nonexistent' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when code already exists in organisation', async () => {
      const repo = createMockRepo();
      repo.findByCode.mockResolvedValue(new Location('loc-1', 'org-1', 'HQ', 'HQ', null, true));
      const useCase = new CreateLocationUseCase(repo);
      await expect(
        useCase.execute({ code: 'HQ', name: 'Headquarters' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('UpdateLocationUseCase', () => {
    it('detects and rejects self-parenting', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(new Location('loc-1', 'org-1', 'HQ', 'HQ', null, true));
      const useCase = new UpdateLocationUseCase(repo);
      await expect(
        useCase.execute('loc-1', { parentId: 'loc-1' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('detects and rejects hierarchy cycles', async () => {
      const repo = createMockRepo();
      // loc-1 -> parent is loc-2; loc-2 -> parent is loc-3; loc-3 wants parent loc-1 => cycle
      const loc1 = new Location('loc-1', 'org-1', 'L1', 'L1', null, true);
      const loc2 = new Location('loc-2', 'org-1', 'L2', 'L2', 'loc-1', true);
      const loc3 = new Location('loc-3', 'org-1', 'L3', 'L3', 'loc-2', true);

      repo.findById.mockImplementation(async (id: string) => {
        if (id === 'loc-1') return loc1;
        if (id === 'loc-2') return loc2;
        if (id === 'loc-3') return loc3;
        return null;
      });

      const useCase = new UpdateLocationUseCase(repo);
      // Try setting loc-1's parent to loc-3 (which is a descendant of loc-1)
      await expect(
        useCase.execute('loc-1', { parentId: 'loc-3' }, 'org-1'),
      ).rejects.toThrow(/cycle/i);
    });

    it('updates fields successfully', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(new Location('loc-1', 'org-1', 'HQ', 'HQ Old', null, true));
      const useCase = new UpdateLocationUseCase(repo);
      const updated = await useCase.execute('loc-1', { name: 'HQ New' }, 'org-1');
      expect(updated.name).toBe('HQ New');
    });
  });

  describe('DeleteLocationUseCase', () => {
    it('rejects deletion when location has children', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(new Location('loc-1', 'org-1', 'HQ', 'HQ', null, true));
      repo.countChildren.mockResolvedValue(2);
      const useCase = new DeleteLocationUseCase(repo);
      await expect(useCase.execute('loc-1', 'org-1')).rejects.toThrow(BadRequestException);
    });

    it('deletes leaf location successfully', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(new Location('loc-1', 'org-1', 'LEAF', 'Leaf', null, true));
      repo.countChildren.mockResolvedValue(0);
      const useCase = new DeleteLocationUseCase(repo);
      await useCase.execute('loc-1', 'org-1');
      expect(repo.delete).toHaveBeenCalledWith('loc-1');
    });

    it('throws NotFoundException if location does not exist', async () => {
      const repo = createMockRepo();
      repo.findById.mockResolvedValue(null);
      const useCase = new DeleteLocationUseCase(repo);
      await expect(useCase.execute('nonexistent', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });
});
